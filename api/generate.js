// Vercel serverless function — proxies question-generation requests to the
// selected AI provider so API keys stay server-side only.
const TIMEOUT_MS = 50000;
const TIMEOUT_MSG = 'AI mengambil masa terlalu lama. Sila jana semula; aplikasi akan menggunakan kelompok soalan lebih kecil.';

async function fetchWithTimeout(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(TIMEOUT_MSG);
    throw err;
  } finally {
    clearTimeout(t);
  }
}

async function callAnthropic({ system, message }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Kunci API Claude belum ditetapkan di pelayan.');

  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 8000, system, messages: [{ role: 'user', content: message }] }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error?.message || 'Ralat API Claude');
  return (d.content || []).map(c => c.text || '').join('');
}

async function callGemini({ system, message }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Kunci API Gemini belum ditetapkan di pelayan.');

  const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: message }] }] }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error?.message || 'Ralat API Gemini');
  return (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
}

async function callOpenAICompatible({ system, message }, { key, url, model, label }) {
  if (!key) throw new Error(`Kunci API ${label} belum ditetapkan di pelayan.`);

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: message }] }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error?.message || `Ralat API ${label}`);
  return d.choices?.[0]?.message?.content || '';
}

async function fetchReferenceContext(tingkatan) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !tingkatan) return '';
  try {
    const q = `${url}/rest/v1/kkq_reference_chunks?select=content,title,kkq_reference_sources!inner(tingkatan,bidang,is_active)&kkq_reference_sources.tingkatan=eq.${tingkatan}&kkq_reference_sources.is_active=eq.true&limit=15`;
    const res = await fetch(q, { headers: { apikey: key, authorization: `Bearer ${key}` } });
    if (!res.ok) return '';
    const rows = await res.json();
    return rows.map(r => r.content).filter(Boolean).join('\n\n').slice(0, 12000);
  } catch {
    return '';
  }
}

const PROVIDERS = {
  anthropic: callAnthropic,
  gemini: callGemini,
  qwen: (p) => callOpenAICompatible(p, {
    key: process.env.QWEN_API_KEY,
    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-plus',
    label: 'Qwen',
  }),
  openai: (p) => callOpenAICompatible(p, {
    key: process.env.OPENAI_API_KEY,
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4.1-mini',
    label: 'ChatGPT',
  }),
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  const { provider, system, message, tingkatan } = req.body || {};
  const impl = PROVIDERS[provider];
  if (!impl) {
    res.status(400).json({ error: { message: 'Penyedia AI tidak sah.' } });
    return;
  }
  if (!message) {
    res.status(400).json({ error: { message: 'Mesej tidak boleh kosong.' } });
    return;
  }

  try {
    const refCtx = await fetchReferenceContext(tingkatan);
    const fullMessage = refCtx
      ? `Rujukan rasmi KKQ (silibus/buku teks) untuk Tingkatan ${tingkatan}:\n${refCtx}\n\nBerdasarkan rujukan di atas, ${message}`
      : message;
    const text = await impl({ system: system || '', message: fullMessage });
    res.status(200).json({ text });
  } catch (err) {
    res.status(502).json({ error: { message: err.message || 'Ralat pelayan tidak dijangka.' } });
  }
};
