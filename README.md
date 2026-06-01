# SSC Ormawa RAG Chatbot

Chatbot RAG berbasis React + Vite untuk menjawab pertanyaan seputar pengajuan proposal dana kegiatan, LPJ, dan sertifikasi kegiatan Ormawa/UKM.

## Menjalankan Aplikasi

```bash
npm run dev
```

Aplikasi membutuhkan `VITE_GROQ_API_KEY` di file `.env` agar jawaban dapat diproses oleh Groq. Jika key tidak tersedia, aplikasi tetap menampilkan jawaban fallback dari hasil retrieval lokal.

## Mengambil Data Dokumen

```bash
npm run knowledge:extract
```

Script `scripts/extract-knowledge.ps1` membaca file `.docx` dan `.pptx`, lalu menghasilkan `src/data/knowledgeBase.ts`. Jika lokasi dokumen berubah, sesuaikan daftar `$documents` di script tersebut.

## Verifikasi

```bash
npm run lint
npm run build
```
