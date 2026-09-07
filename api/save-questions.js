// Best-effort cache of AI-generated questions into Supabase for future
// fast lookup/reuse. Never blocks or fails the user's generation flow —
// errors here are swallowed and just reported back, not thrown.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.status(200).json({ saved: 0, skipped: 'Supabase belum ditetapkan di pelayan.' });
    return;
  }

  const { tingkatan, bidang, tajuk, soalan } = req.body || {};
  if (!tingkatan || !Array.isArray(soalan) || !soalan.length) {
    res.status(400).json({ error: { message: 'Data soalan tidak sah.' } });
    return;
  }

  const rows = soalan.map(q => ({
    tingkatan,
    bidang: bidang || null,
    tajuk: tajuk || null,
    bahagian: q._tajuk || null,
    tahap: q.tahap || null,
    jumlah_pilihan: q.pilihan ? Object.keys(q.pilihan).length : null,
    soalan_jawi: q.soalan_jawi || '',
    soalan_rumi: q.soalan_rumi || null,
    pilihan: q.pilihan || {},
    jawapan: q.jawapan || null,
    penerangan: q.penerangan || null,
  })).filter(r => r.soalan_jawi);

  if (!rows.length) {
    res.status(200).json({ saved: 0 });
    return;
  }

  try {
    const r = await fetch(`${url}/rest/v1/kkq_generated_questions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: key,
        authorization: `Bearer ${key}`,
        prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (!r.ok) {
      const d = await r.text();
      res.status(200).json({ saved: 0, skipped: d });
      return;
    }
    res.status(200).json({ saved: rows.length });
  } catch (err) {
    res.status(200).json({ saved: 0, skipped: err.message });
  }
};
