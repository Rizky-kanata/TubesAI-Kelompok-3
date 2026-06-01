export interface KnowledgeChunk {
  id: string;
  title: string;
  section: string;
  source: string;
  content: string;
}

export const knowledgeChunks: KnowledgeChunk[] = [
  {
    id: "contoh-pertanyaan-1",
    title: "Contoh Pertanyaan",
    section: "Contoh Pertanyaan",
    source: "contoh pertanyaan.docx",
    content: "Dataset Tanya Jawab\nPengajuan Proposal Dana Kegiatan\n1\nQuestion: Bagaimana cara mengajukan proposal pendanaan kegiatan UKM?\nAnswer: Pengajuan proposal dilakukan secara online melalui link pengajuan pendanaan Ormawa/UKM yang telah disediakan oleh Bagian Kemahasiswaan.\n2\nQuestion: Di mana link pengajuan proposal pendanaan Ormawa/UKM?\nAnswer: Link pengajuan proposal pendanaan adalah https://tel-u.ac.id/pengajuanpendanaanormawaukm.\n3\nQuestion: Apakah proposal harus menggunakan template tertentu?\nAnswer: Ya, proposal wajib menggunakan template resmi yang telah disediakan oleh Bagian Kemahasiswaan.\n4\nQuestion: Apakah pengajuan proposal online perlu lembar pengesahan?\nAnswer: Tidak, pengajuan proposal online dilakukan tanpa lembar pengesahan.\n5\nQuestion: Apakah hard copy proposal tetap harus dikumpulkan?\nAnswer: Ya, hard copy proposal tetap wajib dikumpulkan lengkap dengan lembar pengesahan.\n6\nQuestion: Siapa yang harus menandatangani lembar pengesahan proposal?\nAnswer: Lembar pengesahan harus ditandatangani hingga Pembina Ormawa dengan tanda tangan basah.",
  },
  {
    id: "contoh-pertanyaan-2",
    title: "Contoh Pertanyaan",
    section: "Contoh Pertanyaan",
    source: "contoh pertanyaan.docx",
    content: "7\nQuestion: Kapan proposal harus diajukan?\nAnswer: Proposal harus diajukan sesuai jadwal yang telah ditentukan pada grup WhatsApp resmi kemahasiswaan.\n8\nQuestion: Apa yang terjadi jika proposal tidak sesuai template?\nAnswer: Proposal yang tidak sesuai template atau ketentuan dapat menyebabkan proses pencairan dana tidak diproses.\n9\nQuestion: Apakah proposal akan direview oleh pihak kemahasiswaan?\nAnswer: Ya, proposal akan direview oleh Bagian Kemahasiswaan dan diberikan feedback.\n10\nQuestion: Apa yang dilakukan jika proposal belum sesuai?\nAnswer: Proposal akan dikembalikan kepada Ormawa/UKM untuk diperbaiki sesuai feedback.\n11\nQuestion: Apa bukti bahwa proposal telah disetujui?\nAnswer: Bagian Kemahasiswaan akan mengeluarkan lembar evaluasi sebagai bukti persetujuan pencairan dana.\n12\nQuestion: Apakah ada presentasi proposal?\nAnswer: Ya, Ormawa/UKM wajib melakukan presentasi proposal sesuai jadwal yang telah ditentukan oleh Bagian Kemahasiswaan.\n13\nQuestion: Apakah pengajuan konsumsi diperbolehkan?",
  },
  {
    id: "contoh-pertanyaan-3",
    title: "Contoh Pertanyaan",
    section: "Contoh Pertanyaan",
    source: "contoh pertanyaan.docx",
    content: "Answer: Ya, pengajuan konsumsi diperbolehkan khusus untuk panitia kegiatan.\n14\nQuestion: Apa saja yang harus diperhatikan dalam penyusunan RAB?\nAnswer: RAB harus jelas, rinci, dan sesuai ketentuan tarif yang berlaku.\n15\nQuestion: Apakah dokumen transaksi harus lengkap?\nAnswer: Ya, seluruh dokumen transaksi harus lengkap dan absah.\n16\nQuestion: Apa yang terjadi jika dokumen transaksi tidak lengkap?\nAnswer: Jika dokumen transaksi tidak lengkap atau tidak sesuai ketentuan, pencairan dana tidak dapat diproses.\nLaporan Pertanggungjawaban (LPJ)\n17\nQuestion: Apa itu LPJ kegiatan?\nAnswer: LPJ atau Laporan Pertanggungjawaban adalah laporan penggunaan dana kegiatan yang disusun setelah kegiatan selesai dilaksanakan.\n18\nQuestion: Apa saja evidence hard copy yang harus dilampirkan pada LPJ?\nAnswer: Evidence hard copy meliputi nota asli, kuitansi asli, presensi kegiatan, foto kegiatan, foto toko, foto barang atau tempat sewa, dan dokumen pendukung lainnya.\n19\nQuestion: Apakah nota asli wajib dilampirkan?",
  },
  {
    id: "contoh-pertanyaan-4",
    title: "Contoh Pertanyaan",
    section: "Contoh Pertanyaan",
    source: "contoh pertanyaan.docx",
    content: "Answer: Ya, nota asli wajib dilampirkan dan harus memiliki kop nota atau stempel nota.\n20\nQuestion: Bagaimana jika nota tidak memiliki stempel atau kop?\nAnswer: Jika nota tidak memiliki kop atau stempel, wajib melampirkan foto toko beserta alamat lengkap toko.\n21\nQuestion: Bagaimana jika pembelian dilakukan melalui marketplace?\nAnswer: Jika pembelian dilakukan melalui marketplace, wajib melampirkan print nota dalam format PDF.\n22\nQuestion: Apakah presensi peserta wajib dilampirkan?\nAnswer: Ya, presensi panitia dan peserta wajib dilampirkan khusus untuk pengajuan konsumsi.\n23\nQuestion: Apakah foto kegiatan wajib dilampirkan dalam LPJ?\nAnswer: Ya, foto kegiatan wajib dilampirkan sebagai bukti pelaksanaan kegiatan.\n24\nQuestion: Kapan foto toko perlu dilampirkan?\nAnswer: Foto toko perlu dilampirkan terutama jika nota tidak memiliki kop atau stempel resmi.\n25\nQuestion: Apakah foto barang atau tempat sewa perlu dilampirkan?\nAnswer: Ya, jika terdapat pengeluaran untuk sewa barang atau tempat maka foto barang atau tempat wajib dilampirkan.",
  },
  {
    id: "contoh-pertanyaan-5",
    title: "Contoh Pertanyaan",
    section: "Contoh Pertanyaan",
    source: "contoh pertanyaan.docx",
    content: "26\nQuestion: Apa syarat jika terdapat fee narasumber?\nAnswer: Jika terdapat pengeluaran untuk fee narasumber, wajib melampirkan CV narasumber.\n27\nQuestion: Apa syarat jika ada reward pemenang?\nAnswer: Jika terdapat reward pemenang, wajib melampirkan daftar penerima reward dalam bentuk tabel.\n28\nQuestion: Data apa saja yang ada pada daftar penerima reward?\nAnswer: Data penerima reward meliputi nama mahasiswa, NIM, program studi, keterangan juara, dan nominal reward.\n29\nQuestion: Apakah identitas penerima reward perlu dilampirkan?\nAnswer: Ya, identitas seperti KTM, KTP, atau identitas relevan lainnya perlu dilampirkan.\n30\nQuestion: Bagaimana penyusunan nota pada LPJ?\nAnswer: Nota harus disusun sesuai urutan pada RAB.\n31\nQuestion: Apakah nota boleh ditempel menggunakan stapler?\nAnswer: Tidak, nota harus ditempel menggunakan lem dan tidak diperbolehkan menggunakan stapler.\n32\nQuestion: Apakah LPJ harus dijilid?\nAnswer: Ya, seluruh evidence hard copy harus dilampirkan pada LPJ sesuai template dan dijilid lengkap dengan lembar pengesahan.",
  },
  {
    id: "contoh-pertanyaan-6",
    title: "Contoh Pertanyaan",
    section: "Contoh Pertanyaan",
    source: "contoh pertanyaan.docx",
    content: "33\nQuestion: Apakah soft copy LPJ juga wajib dikumpulkan?\nAnswer: Ya, soft copy seluruh LPJ wajib diunggah pada link LPJ yang telah disediakan.\n34\nQuestion: Apa saja yang harus ada dalam soft copy LPJ?\nAnswer: Soft copy LPJ harus memuat scan nota asli, presensi, foto barang atau tempat sewa, foto kegiatan, dan dokumen pendukung lainnya.\n35\nQuestion: Apa yang dilakukan Bagian Kemahasiswaan setelah LPJ dikumpulkan?\nAnswer: Bagian Kemahasiswaan akan melakukan pengecekan dan verifikasi dokumen LPJ.\n36\nQuestion: Apa yang terjadi jika LPJ belum lengkap?\nAnswer: LPJ akan dikembalikan untuk diperbaiki jika terdapat kekurangan dokumen.\n37\nQuestion: Kapan proses LPJ dinyatakan selesai?\nAnswer: Proses LPJ dinyatakan selesai apabila seluruh dokumen telah sesuai dan diverifikasi oleh Bagian Kemahasiswaan.",
  },
  {
    id: "contoh-pertanyaan-7",
    title: "Contoh Pertanyaan",
    section: "Pertanyaan Umum",
    source: "contoh pertanyaan.docx",
    content: "38\nQuestion: Apa fungsi Student Service Center (SSC)?\nAnswer: SSC berfungsi sebagai layanan informasi dan bantuan mahasiswa terkait berbagai kebutuhan akademik maupun administrasi kampus.\n39\nQuestion: Apakah chatbot SSC dapat menjawab pertanyaan tentang pendanaan Ormawa?\nAnswer: Ya, chatbot SSC dapat membantu menjawab pertanyaan terkait prosedur pengajuan proposal, LPJ, dan pendanaan kegiatan Ormawa/UKM.\n40\nQuestion: Siapa contact person bagian kemahasiswaan?\nAnswer: Contact person bagian kemahasiswaan adalah Vio dengan nomor 0821-3222-4802.",
  },
  {
    id: "final-project-1",
    title: "Final Project",
    section: "Slide 1",
    source: "final project (2).pptx",
    content: "final project:ai and its application\nTahun Ajaran Semester Genap 2025/2026\nDosen Pengampu\nM. Nizar P. Ma’ady, M.Kom., M.IM.",
  },
  {
    id: "final-project-2",
    title: "Final Project",
    section: "Slide 2",
    source: "final project (2).pptx",
    content: "pengantar\nUnit Akademik TUS memiliki Student Service Center (SSC) yang menjadi layanan kendala atau bertanya mahasiswa seputar bidang akademik. Akan tetapi layanan hanya buka pada jam kantor kerja saja yakni Senin – Jumat dan pada jam 08.00 – 16.00 WIB. Keterbatasan lainnya adalah layanan hanya dibuka secara onsite, mahasiswa harus datang ke TUS ke SSC. Sejatinya ada layanan Chatbot WA namun pertanyaannya harus exact dengan yang telah ditentukan oleh program, sehingga banyak pertanyaan yang tidak dapat dijawab.\nDi sisi lain, informasi terkadang ada pengumuman baru sehingga chatbot perlu ada penyesuaian jawaban yang mana dapat memberi kesulitan bagi staf secara development chatbot. Oleh karena itu, perhatian akan kemudahan bagi staf untuk update informasi untuk chatbot perlu juga diatur.",
  },
  {
    id: "final-project-3",
    title: "Final Project",
    section: "Slide 3",
    source: "final project (2).pptx",
    content: "Rumusan masalah\nBagaimana konsep solusi yang ditawarkan untuk permasalahan di atas? (30 poin)\nBagaimana teknis pengembangan dari usulan solusi tersebut? (30 poin)\nBagaimana kesiapan penerapan dari sistem secara pemodelan? (30 poin)\n\n*10 poin lagi dari skor kontribusi.",
  },
  {
    id: "final-project-4",
    title: "Final Project",
    section: "Slide 4",
    source: "final project (2).pptx",
    content: "presentation day!\nDataset hanya menggunakan dokumen akademik TUS apapun yang ada sebagai sampel, tidak perlu data berupa tanya-jawab atau meminta data ke SSC.\nSumber dokumen dapat diminta bila pengguna chatbot menginginkan.\nStaf SSC memungkinkan memperbarui/menambah dokumen ke sistem.\nMinggu ke-13 hingga 15 adalah masa pengerjaan sekaligus responsi (tidak ada kelas tapi jam kelas diganti dengan bimbingan bila diperlukan). Presensi diganti dengan submit progress seminggu terakhir langsung di LMS (cukup narasi saja) secara individu.\nMinggu ke-16 adalah presentation day, harap menyiapkan slide yang berisi menjawab ketiga rumusan masalah tersebut. Durasi maksimal presentasi tiap kelompok 20 menit.\nLaporan bebas berisi pengantar (termasuk tentang dataset), rumusan masalah, dan tiga bab yang menjawab ketiga rumusan masalah di atas.\nLaporan, kode program, link chatbot dan dataset dijadikan satu di github lalu linknya dikumpulkan via LMS maksimal +7 hari dari presentation day.",
  },
  {
    id: "alur-lpj-1",
    title: "Alur Pengajuan LPJ Kegiatan",
    section: "Alur Pengajuan Laporan Pertanggungjawaban (LPJ) Kegiatan",
    source: "Alur Pengajuan LPJ Kegiatan.docx",
    content: "Alur Pengajuan Laporan Pertanggungjawaban (LPJ) Kegiatan\nOrmawa/UKM menyusun laporan pertanggungjawaban kegiatan sesuai template.\nMengumpulkan seluruh bukti transaksi dan evidence kegiatan.\nMenyusun hard copy LPJ lengkap dengan lembar pengesahan.\nMengunggah soft copy LPJ beserta seluruh dokumen pendukung pada link LPJ.\nBagian Kemahasiswaan melakukan pengecekan dan verifikasi dokumen LPJ.\nJika terdapat kekurangan dokumen, LPJ dikembalikan untuk diperbaiki.\nJika LPJ telah sesuai, proses pertanggungjawaban kegiatan dinyatakan selesai.",
  },
  {
    id: "alur-proposal-1",
    title: "Alur Pengajuan Proposal Dana Kegiatan",
    section: "Alur Pengajuan Proposal Pengajuan Dana Kegiatan",
    source: "Alur Pengajuan Proposal Dana Kegiatan.docx",
    content: "Alur Pengajuan Proposal Pengajuan Dana Kegiatan\nOrmawa/UKM mengakses link pengajuan proposal pendanaan.\nOrmawa/UKM mengunggah proposal pendanaan kegiatan secara online.\nBagian Kemahasiswaan melakukan proses review dan pemberian feedback terhadap proposal.\nJika proposal belum sesuai, proposal dikembalikan kepada Ormawa/UKM untuk diperbaiki.\nJika proposal sudah sesuai, Bagian Kemahasiswaan mengeluarkan lembar evaluasi sebagai bukti persetujuan pencairan dana.\nOrmawa/UKM membuat lembar pengesahan yang ditandatangani pejabat berwenang untuk melengkapi proposal yang telah disetujui.\nProses pengajuan proposal selesai dan dapat dilanjutkan ke tahap pencairan dana.",
  },
  {
    id: "alur-sertifikasi-1",
    title: "Alur Pengajuan Sertifikasi Kegiatan Ormawa UKM",
    section: "Alur Pengajuan Sertifikasi Kegiatan Ormawa/UKM",
    source: "Alur Pengajuan Sertifikasi Kegiatan Ormawa UKM.docx",
    content: "Alur Pengajuan Sertifikasi Kegiatan Ormawa/UKM\nPemohon membuka form pengajuan nomor dan tanda tangan sertifikat kegiatan Ormawa/UKM https://forms.office.com/pages/responsepage.aspx?id=D_6vkKPCCEG7mGzrTpTvFQirFfd-c6lInVc5GFu5s_RUMk9GREVMVUs5TVpWVEpHSEQwQVlMNE1KNS4u\u0026route=shorturl\nPemohon mengisi data diri meliputi nama pemohon, nomor WhatsApp, dan nama Ormawa/UKM.\nPemohon mengisi data kegiatan seperti nama kegiatan, tanggal mulai dan selesai kegiatan.\nPemohon mengisi judul sertifikat dan memilih kategori sertifikat seperti panitia, narasumber, peserta, pemenang, atau kategori lainnya.\nPemohon mengisi tanggal pengajuan sertifikasi.\nPemohon mengunggah lampiran daftar narasumber/panitia/peserta lengkap dengan tanda tangan pembina dan kepala bagian kemahasiswaan.\nPemohon menginput link dokumentasi kegiatan berupa foto dan video kegiatan.\nPemohon mengunggah desain sertifikat kegiatan.\nPemohon melakukan submit form pengajuan sertifikasi.\nBagian Kemahasiswaan menerima dan memeriksa kelengkapan dokumen pengajuan.",
  },
  {
    id: "alur-sertifikasi-2",
    title: "Alur Pengajuan Sertifikasi Kegiatan Ormawa UKM",
    section: "Alur Pengajuan Sertifikasi Kegiatan Ormawa/UKM",
    source: "Alur Pengajuan Sertifikasi Kegiatan Ormawa UKM.docx",
    content: "Jika dokumen belum lengkap atau belum sesuai, pengajuan dikembalikan kepada pemohon untuk diperbaiki.\nJika dokumen lengkap dan sesuai, Bagian Kemahasiswaan melakukan verifikasi data kegiatan dan sertifikat.\nNomor dan tanda tangan sertifikat diproses oleh pihak kemahasiswaan.\nSertifikat selesai diverifikasi dan siap digunakan.\nProses pengajuan sertifikasi kegiatan selesai.",
  },
  {
    id: "alur-sertifikasi-3",
    title: "Alur Pengajuan Sertifikasi Kegiatan Ormawa UKM",
    section: "Catatan:",
    source: "Alur Pengajuan Sertifikasi Kegiatan Ormawa UKM.docx",
    content: "Gunakan template sertifikat yang telah disediakan.\nPastikan seluruh dokumen dapat diakses (open access).",
  },
  {
    id: "syarat-lpj-1",
    title: "Syarat Pengajuan LPJ Kegiatan",
    section: "Syarat Pengajuan Laporan Pertanggungjawaban (LPJ) Kegiatan",
    source: "Syarat Pengajuan LPJ Kegiatan.docx",
    content: "Syarat Pengajuan Laporan Pertanggungjawaban (LPJ) Kegiatan\nMenyediakan evidence hard copy berupa nota asli berstempel/kop atau kuitansi asli bertanda tangan.\nJika pembelian dilakukan melalui marketplace, wajib melampirkan print nota PDF.\nMelampirkan presensi panitia dan peserta kegiatan khusus untuk pengajuan konsumsi.\nBagi toko yang tidak memiliki evidence transaksi yang kurang sesuai wajib melampirkan foto toko beserta alamat toko.\nMelampirkan foto barang atau tempat apabila terdapat penyewaan.\nMelampirkan foto kegiatan sebagai bukti pelaksanaan.\nMelampirkan foto sertifikasi kegiatan\nJika terdapat pengeluaran untuk fee narasumber, wajib melampirkan CV narasumber.\nJika terdapat reward pemenang, wajib melampirkan daftar penerima reward dalam bentuk tabel.\nSemua evidence dilampirkan pada LPJ sesuai template dan dijilid lengkap dengan lembar pengesahan.\nSoft copy seluruh LPJ wajib diunggah pada link LPJ yang telah disediakan https://forms.office.com/Pages/ResponsePage.aspx?id=D_6vkKPCCEG7mGzrTpTvFQirFfd-c6lInVc5GFu5s_RUQ05GSE5OQlRHWlNNVEI2S1dNMlBQWldUNC4u",
  },
  {
    id: "syarat-lpj-2",
    title: "Syarat Pengajuan LPJ Kegiatan",
    section: "Syarat Pengajuan Laporan Pertanggungjawaban (LPJ) Kegiatan",
    source: "Syarat Pengajuan LPJ Kegiatan.docx",
    content: "Nota harus disusun sesuai urutan pada RAB.\nNota wajib memiliki kop atau stempel nota.\nJika nota tidak memiliki kop/stempel, wajib melampirkan foto toko beserta alamat lengkap.\nNota ditempel rapi menggunakan lem dan tidak diperbolehkan menggunakan stapler.",
  },
  {
    id: "syarat-proposal-1",
    title: "Syarat Pengajuan Proposal Dana Kegiatan",
    section: "Syarat Pengajuan Proposal Pengajuan Dana Kegiatan",
    source: "Syarat Pengajuan Proposal Dana Kegiatan.docx",
    content: "Syarat Pengajuan Proposal Pengajuan Dana Kegiatan\nProposal wajib menggunakan template resmi yang telah disediakan oleh Bagian Kemahasiswaan.\nPengajuan proposal dilakukan secara online melalui link: https://tel-u.ac.id/pengajuanpendanaanormawaukm\nPengajuan online dilakukan tanpa lembar pengesahan.\nHard copy proposal wajib dikumpulkan dan dilengkapi dengan lembar pengesahan bertanda tangan basah hingga Pembina Ormawa.\nPengajuan proposal harus sesuai dengan jadwal yang telah ditentukan pada grup WhatsApp resmi kemahasiswaan.\nRencana Anggaran Biaya (RAB) harus jelas, rinci, dan sesuai ketentuan yang berlaku.",
  },
  {
    id: "syarat-proposal-2",
    title: "Syarat Pengajuan Proposal Dana Kegiatan",
    section: "Dokumen transaksi harus lengkap dan absah.",
    source: "Syarat Pengajuan Proposal Dana Kegiatan.docx",
    content: "Pengajuan konsumsi hanya berlaku untuk panitia kegiatan.\nTarif pengeluaran harus mengacu pada ketentuan yang berlaku.\nJika dokumen kurang lengkap atau tidak sesuai ketentuan/template, maka pencairan dana tidak dapat diproses.",
  },
];

export const knowledgeSourceCount = 7;
export const knowledgeChunkCount = 20;

