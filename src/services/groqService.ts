import chatbotConfig from "../config/chatbotConfig";
import type { BotReply, Message } from "../types/Message";
import {
  buildDocumentFileRequestAnswer,
  buildLocalFallbackAnswer,
  buildRequestedSubmissionLinkAnswer,
  getDocumentFileRequestChunks,
  buildRagContext,
  retrieveRelevantChunks,
  toMessageSources,
} from "./ragService";

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

function isProtectedKnowledgeRequest(prompt: string): boolean {
  return [...injectionPatterns, ...knowledgeTamperingPatterns].some((pattern) =>
    pattern.test(prompt)
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

export async function sendMessage(
  prompt: string,
  history: Message[]
): Promise<BotReply> {
  if (isProtectedKnowledgeRequest(prompt)) {
    return buildProtectedKnowledgeReply();
  }

  if (isGreetingRequest(prompt)) {
    return buildGreetingReply();
  }

  const submissionLinkAnswer = buildRequestedSubmissionLinkAnswer(prompt);

  if (submissionLinkAnswer) {
    return {
      content: submissionLinkAnswer,
      sources: [],
    };
  }

  const retrievedChunks = await retrieveRelevantChunks(prompt);
  const fileRequestAnswer = buildDocumentFileRequestAnswer(prompt, retrievedChunks);
  const responseChunks = fileRequestAnswer
    ? getDocumentFileRequestChunks(prompt, retrievedChunks)
    : retrievedChunks;
  const sources = toMessageSources(responseChunks);

  if (retrievedChunks.length === 0 && isOutOfDomainRequest(prompt)) {
    return buildOutOfDomainReply();
  }

  if (fileRequestAnswer) {
    return {
      content: fileRequestAnswer,
      sources,
      showDownloads: true,
    };
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
    console.error(`[Groq API Error] Status: ${response.status}`, errorMsg);
    throw new Error(`Groq API Error (${response.status}): ${errorMsg}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error("Respons Groq kosong.");
  }

  return {
    content: sanitizePlainText(reply),
    sources,
  };
}
