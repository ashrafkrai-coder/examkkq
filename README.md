# Exam KKQ

App `examkkq.vercel.app` — penjana soalan peperiksaan KKQ dalam Tulisan Jawi.

## Sebelum deploy

1. Tambah `GEMINI_API_KEY` di Vercel Project Settings > Environment Variables.
2. (Pilihan) Tambah `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` untuk aktifkan rujukan rasmi KKQ dari Bank Rujukan Supabase mengikut Tingkatan.
3. Deploy folder ini sebagai projek Vercel.

Kunci API hanya digunakan oleh `api/generate.js` di pelayan dan tidak pernah dihantar ke pelayar.
