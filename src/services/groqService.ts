import chatbotConfig from "../config/chatbotConfig";
import type { BotReply, Message } from "../types/Message";
import {
  buildLocalFallbackAnswer,
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
      "Saya hanya bisa menjawab pertanyaan berdasarkan dokumen pendanaan Ormawa/UKM yang tersedia.",
    sources: [],
  };
}

function sanitizePlainText(reply: string): string {
  return reply
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[*+-]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendMessage(
  prompt: string,
  history: Message[]
): Promise<BotReply> {
  if (isProtectedKnowledgeRequest(prompt)) {
    return buildProtectedKnowledgeReply();
  }

  const retrievedChunks = retrieveRelevantChunks(prompt);
  const sources = toMessageSources(retrievedChunks);

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
        "\n\nGunakan hanya konteks di atas. Jika tidak cukup, jawab bahwa informasi belum ditemukan pada dokumen yang tersedia.",
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
