# Exam KKQ

Versi pembaikan setempat untuk `examkkq.vercel.app`. Belum dideploy.

## Sebelum deploy

1. Tambah kunci penyedia yang diperlukan di Vercel Project Settings > Environment Variables: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `QWEN_API_KEY`, atau `OPENAI_API_KEY`.
2. Deploy folder ini sebagai projek Vercel.

Kunci API hanya digunakan oleh `api/generate.js` di pelayan dan tidak pernah dihantar ke pelayar. Claude dan Gemini menyokong sumber PDF/Word; untuk Qwen dan ChatGPT, gunakan sumber Teks.
