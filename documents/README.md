# Local RAG Documents

Taruh file sumber chatbot di folder ini.

Format yang didukung:

- `.docx`
- `.pptx`
- `.pdf`
- `.xlsx`
- `.xlsm`
- `.txt`
- `.md`
- `.csv`
- `.json`

Setelah menambah, menghapus, atau mengganti dokumen, jalankan:

```bash
npm run knowledge:extract
```

Script akan memperbarui `src/data/knowledgeBase.ts` dari isi folder ini.
Perintah `npm run dev` dan `npm run build` juga menjalankan extractor ini otomatis sebelum aplikasi dimulai atau dibuild.
