import chatbotConfig from "../config/chatbotConfig";
import type { BotReply, DownloadableFile, Message } from "../types/Message";
import { getKnowledgeDocuments } from "./knowledgeAdminService";
import {
  buildKnowledgeExportTitle,
  generateKnowledgeFiles,
  getKnowledgeExportFormatLabels,
  getKnowledgeExportRequest,
} from "./knowledgeExportService";
import {
  buildDocumentFileRequestAnswer,
  buildDirectKnowledgeAnswer,
  buildLocalFallbackAnswer,
  buildRequestedSubmissionLinkAnswer,
  getDocumentFileRequestChunks,
  buildRagContext,
  retrieveRelevantChunks,
  toMessageSources,
} from "./ragService";
import type { RetrievedChunk } from "./ragService";

const API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const injectionPatterns = [
  /ignore\s+.*instruction/i,
  /abaikan\s+.*instruksi/i,
  /system\s+prompt/i,
  /developer\s+mode/i,
  /pretend\s+to\s+be/i,
  /berpura-pura/i,
  /you\s+are\s+now/i,
  /mulai\s+sekarang/i,
  /lupakan\s+.*instruksi/i,
  /bocor(?:kan)?\s+.*instruksi/i,
];

const knowledgeTamperingPatterns = [
  /ubah(?:kan)?\s+data/i,
  /ganti\s+data/i,
  /hapus\s+data/i,
  /tambah(?:kan)?\s+data/i,
  /ubah(?:kan)?\s+dokumen/i,
  /ganti\s+dokumen/i,
  /hapus\s+dokumen/i,
  /tambah(?:kan)?\s+dokumen/i,
  /ubah(?:kan)?\s+knowledge/i,
  /hapus\s+knowledge/i,
  /update\s+knowledge/i,
];

function isProtectedKnowledgeRequest(
  prompt: string,
  isDocumentExport: boolean
): boolean {
  if (injectionPatterns.some((pattern) => pattern.test(prompt))) {
    return true;
  }

  return (
    !isDocumentExport &&
    knowledgeTamperingPatterns.some((pattern) => pattern.test(prompt))
  );
}

function buildProtectedKnowledgeReply(): BotReply {
  return {
    content:
      "Maaf, saya tidak bisa mengubah atau membocorkan instruksi dan data sumber. " +
      "Saya hanya bisa menjawab pertanyaan seputar layanan SSC dan akademik berdasarkan dokumen yang tersedia.",
    sources: [],
  };
}

const greetingPattern =
  /\b(hai|halo|hallo|hello|hi|hei|hey|pagi|siang|sore|malam|assalamualaikum|salam)\b/i;

const greetingOnlyPattern =
  /^(?:hai|halo|hallo|hello|hi|hei|hey|pagi|siang|sore|malam|selamat\s+(?:pagi|siang|sore|malam)|assalamualaikum|salam|kak|admin|min|bot|ssc|permisi|punten|ya|iya|ok|oke|bro|sis|gan|mas|mbak|pak|bu|[\s.,!?])+$/i;

function isGreetingRequest(prompt: string): boolean {
  const trimmedPrompt = prompt.trim();

  return greetingPattern.test(trimmedPrompt) && greetingOnlyPattern.test(trimmedPrompt);
}

function buildGreetingReply(): BotReply {
  return {
    content:
      "Halo! Saya siap membantu pertanyaan seputar layanan SSC, akademik, proposal kegiatan, LPJ, TAK, sertifikasi, Ormawa, dan UKM. Silakan tulis kebutuhan Anda.",
    sources: [],
  };
}

const outOfDomainPatterns = [
  /\b(coding|programming|pemrograman|python|javascript|java|php|html|css|react|laravel|debug|compile)\b/i,
  /\b(resep|masak|cuaca|film|musik|game|saham|crypto|politik|olahraga)\b/i,
  /\b(buatkan|tuliskan|generate)\s+.*\b(kode|script|program|function|class)\b/i,
];

const domainPatterns = [
  /\b(ssc|student service|student service center|akademik|kampus|kuliah|mahasiswa|ormawa|ukm|kemahasiswaan|tak)\b/i,
  /\b(proposal|pendanaan|dana|lpj|laporan|pertanggungjawaban|sertifikat|sertifikasi|template)\b/i,
  /\b(dokumen|syarat|alur|prosedur|pengajuan|layanan|administrasi|form|link|tautan|kontak|whatsapp|wa)\b/i,
  /\b(beasiswa|krs|nilai|semester|skripsi|tugas akhir|praktikum|presensi|transkrip aktivitas kemahasiswaan)\b/i,
];

function buildOutOfDomainReply(): BotReply {
  return {
    content:
      "Maaf, saya hanya dapat membantu pertanyaan seputar layanan SSC dan akademik.",
    sources: [],
  };
}

function isOutOfDomainRequest(prompt: string): boolean {
  if (outOfDomainPatterns.some((pattern) => pattern.test(prompt))) {
    return true;
  }

  return !domainPatterns.some((pattern) => pattern.test(prompt));
}

function formatLinkList(reply: string): string {
  const urlPattern = /https?:\/\/\S+/g;
  const matches = [...reply.matchAll(urlPattern)];

  if (matches.length < 2 || matches[0].index === undefined) {
    return reply;
  }

  const intro =
    reply
      .slice(0, matches[0].index)
      .replace(/[:\s]+$/g, "")
      .trim() || "Berikut link yang tersedia";

  const items = matches.map((match, index) => {
    const url = match[0].replace(/[.,;)]$/g, "");
    const nextIndex = matches[index + 1]?.index ?? reply.length;
    const description = reply
      .slice((match.index ?? 0) + match[0].length, nextIndex)
      .replace(/^[:\s,-]*(untuk|sebagai)\s+/i, "")
      .replace(/[:\s,-]+$/g, "")
      .trim();
    const label = description || `Link ${index + 1}`;

    return `${index + 1}. ${label}\nLink: ${url}`;
  });

  return `${intro}:\n${items.join("\n\n")}`;
}

function sanitizePlainText(reply: string): string {
  const cleaned = reply
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[*+-]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return formatLinkList(cleaned);
}

function buildDownloadableFiles(chunks: RetrievedChunk[]): DownloadableFile[] {
  const documents = getKnowledgeDocuments();
  const seenSources = new Set<string>();

  return chunks
    .map<DownloadableFile | null>((chunk) => {
      if (seenSources.has(chunk.source)) {
        return null;
      }

      seenSources.add(chunk.source);

      const document = documents.find(
        (item) => item.source === chunk.source || item.id === chunk.source
      );

      if (!document?.fileData && !document?.fileUrl) {
        return null;
      }

      return {
        id: document.id,
        title: document.title || chunk.title,
        source: document.source || chunk.source,
        fileName: document.fileName || document.source || chunk.source,
        fileType: document.fileType,
        fileData: document.fileData,
        fileUrl: document.fileUrl,
      };
    })
    .filter((file): file is DownloadableFile => Boolean(file));
}

export async function sendMessage(
  prompt: string,
  history: Message[]
): Promise<BotReply> {
  const exportRequest = getKnowledgeExportRequest(prompt);

  if (isProtectedKnowledgeRequest(prompt, Boolean(exportRequest))) {
    return buildProtectedKnowledgeReply();
  }

  if (isGreetingRequest(prompt)) {
    return buildGreetingReply();
  }

  if (exportRequest && !exportRequest.topic) {
    return {
      content:
        "Sebutkan data yang ingin dibuat menjadi file, misalnya: \"Buatkan PDF syarat LPJ kegiatan.\"",
      sources: [],
    };
  }

  if (!exportRequest) {
    const submissionLinkAnswer = buildRequestedSubmissionLinkAnswer(prompt);

    if (submissionLinkAnswer) {
      return {
        content: submissionLinkAnswer,
        sources: [],
      };
    }
  }

  const knowledgeQuery = exportRequest?.topic || prompt;
  const retrievedChunks = await retrieveRelevantChunks(knowledgeQuery);

  if (exportRequest) {
    const sources = toMessageSources(retrievedChunks);

    if (retrievedChunks.length === 0) {
      return {
        content:
          "File belum dapat dibuat karena data yang diminta tidak ditemukan pada dokumen aktif di Dashboard Admin.",
        sources: [],
      };
    }

    const exportContent = buildLocalFallbackAnswer(
      knowledgeQuery,
      retrievedChunks
    );
    const exportTitle = buildKnowledgeExportTitle(exportRequest.topic);

    try {
      const downloads = await generateKnowledgeFiles({
        formats: exportRequest.formats,
        title: exportTitle,
        content: exportContent,
      });

      if (downloads.length === 0) {
        return {
          content:
            "File belum dapat dibuat karena isi yang sesuai tidak ditemukan pada dokumen aktif di Dashboard Admin.",
          sources,
        };
      }

      const formatLabels = getKnowledgeExportFormatLabels(
        exportRequest.formats
      );

      return {
        content:
          `File ${formatLabels} berhasil dibuat berdasarkan data pada dokumen aktif di Dashboard Admin. ` +
          "Silakan klik tombol download di bawah ini.",
        sources,
        showDownloads: true,
        downloads,
      };
    } catch (error) {
      console.error("File dokumen gagal dibuat.", error);

      return {
        content:
          "Data berhasil ditemukan, tetapi file belum dapat dibuat. Silakan coba kembali.",
        sources,
      };
    }
  }

  const fileRequestAnswer = buildDocumentFileRequestAnswer(prompt, retrievedChunks);
  const responseChunks = fileRequestAnswer
    ? getDocumentFileRequestChunks(prompt, retrievedChunks)
    : retrievedChunks;
  const sources = toMessageSources(responseChunks);

  if (fileRequestAnswer) {
    const downloads = buildDownloadableFiles(responseChunks);

    if (responseChunks.length === 0) {
      return {
        content: fileRequestAnswer,
        sources: [],
        showDownloads: false,
        downloads: [],
      };
    }

    return {
      content: downloads.length
        ? fileRequestAnswer
        : "Saya menemukan informasi yang cocok, tetapi file asli belum tersedia untuk diunduh. Upload ulang file melalui dashboard admin atau pastikan file ada di folder documents.",
      sources,
      showDownloads: downloads.length > 0,
      downloads,
    };
  }

  const directKnowledgeAnswer = buildDirectKnowledgeAnswer(
    prompt,
    retrievedChunks
  );

  if (directKnowledgeAnswer) {
    return {
      content: directKnowledgeAnswer,
      sources,
    };
  }

  if (retrievedChunks.length === 0 && isOutOfDomainRequest(prompt)) {
    return buildOutOfDomainReply();
  }

  if (retrievedChunks.length === 0) {
    return {
      content: buildLocalFallbackAnswer(prompt, retrievedChunks),
      sources,
    };
  }

  if (!API_KEY) {
    return {
      content: buildLocalFallbackAnswer(prompt, retrievedChunks),
      sources,
    };
  }

  const ragContext = retrievedChunks.length
    ? buildRagContext(retrievedChunks)
    : "Tidak ada konteks dokumen yang relevan untuk pertanyaan ini.";

  const messages = [
    { role: "system", content: chatbotConfig.systemInstruction },
    {
      role: "system",
      content:
        "Konteks Dokumen:\n" +
        ragContext +
        "\n\nGunakan hanya konteks di atas. Jika tidak cukup, jawab bahwa informasi belum ditemukan pada dokumen yang tersedia. " +
        "Jika pertanyaan meminta alur, cara, prosedur, tahapan, atau proses, susun jawaban sebagai langkah bernomor 1, 2, 3, dan seterusnya. " +
        'Jika jawaban berisi link, tulis tiap link sebagai item bernomor dengan format "Nama kebutuhan" lalu baris "Link: URL".',
    },
    ...history.slice(-6).map((msg) => ({
      role: msg.role === "model" ? "assistant" : "user",
      content: msg.content,
    })),
    { role: "user", content: prompt },
  ];

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.15,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || response.statusText;
      console.warn(
        `[Groq API unavailable] Status: ${response.status}. Using local fallback.`,
        errorMsg
      );

      return {
        content: buildLocalFallbackAnswer(prompt, retrievedChunks),
        sources,
      };
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      console.warn("Respons Groq kosong. Menggunakan jawaban lokal.");
      return {
        content: buildLocalFallbackAnswer(prompt, retrievedChunks),
        sources,
      };
    }

    return {
      content: sanitizePlainText(reply),
      sources,
    };
  } catch (error) {
    console.warn(
      "Groq API tidak dapat diakses. Menggunakan jawaban lokal.",
      error
    );

    return {
      content: buildLocalFallbackAnswer(prompt, retrievedChunks),
      sources,
    };
  }
}
