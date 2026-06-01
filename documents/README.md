# Local RAG Documents

Taruh file sumber chatbot di folder ini.

Format yang didukung:

- `.docx`
- `.pptx`

Setelah menambah, menghapus, atau mengganti dokumen, jalankan:

```bash
npm run knowledge:extract
```

Script akan memperbarui `src/data/knowledgeBase.ts` dari isi folder ini.
