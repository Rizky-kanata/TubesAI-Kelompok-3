# Chatbot Layanan Administrasi UKM dan Ormawa

Chatbot RAG berbasis React + Vite untuk menjawab pertanyaan seputar pengajuan proposal dana kegiatan, LPJ, dan sertifikasi kegiatan Ormawa/UKM.

## Link Chatbot

Chatbot dapat diakses melalui link berikut:

https://tubes-ai-kelompok-3.vercel.app

## Akun Admin

Gunakan akun berikut untuk masuk ke halaman admin:

```bash
Email    : admin@admin.com
Password : admin123
```

## Laporan Tugas Besar

Dokumen laporan tugas besar dapat diakses melalui link berikut:

https://drive.google.com/drive/folders/180y89pTdM5BhkzYISbPIHvIEYYE-hljz?usp=sharing

## Dataset Chatbot

Dataset atau dokumen sumber yang digunakan untuk knowledge base chatbot dapat diakses melalui link berikut:

https://drive.google.com/drive/folders/1u4NUCzTzMFOWBvmo3Y7gLywBKpxDEtp6?usp=sharing

## Hasil Analisis Evaluasi

Hasil analisis dari chatbot dapat diakses melalui link berikut:

https://drive.google.com/drive/folders/1QtpdLppMjMKwKKA2MWuPiW2JTs7Glcer?usp=sharing

## Menjalankan Aplikasi

```bash
npm run dev
```

Aplikasi membutuhkan `VITE_GROQ_API_KEY` di file `.env` agar jawaban dapat diproses oleh Groq. Jika key tidak tersedia, aplikasi tetap menampilkan jawaban fallback dari hasil retrieval lokal.

## Mengambil Data Dokumen

Taruh file `.docx` atau `.pptx` di folder `documents`, lalu jalankan:

```bash
npm run knowledge:extract
```

Script `scripts/extract-knowledge.ps1` membaca isi folder `documents`, lalu menghasilkan `src/data/knowledgeBase.ts`.

## Verifikasi

```bash
npm run lint
npm run build
```
