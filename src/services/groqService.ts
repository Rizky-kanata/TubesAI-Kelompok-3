import type { Message } from "../types/Message";
import chatbotConfig, {
  formatPrice,
  menuCatalog,
} from "../config/chatbotConfig";

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
];

const menuTamperingPatterns = [
  /ubah(?:kan)?\s+harga/i,
  /ganti\s+harga/i,
  /naikkan\s+harga/i,
  /turunkan\s+harga/i,
  /ubah(?:kan)?\s+menu/i,
  /ganti\s+menu/i,
  /hapus\s+menu/i,
  /tambah(?:kan)?\s+menu/i,
  /beri(?:kan)?\s+diskon/i,
  /buat(?:kan)?\s+promo/i,
];

function isProtectedMenuRequest(prompt: string): boolean {
  return [...injectionPatterns, ...menuTamperingPatterns].some((pattern) =>
    pattern.test(prompt)
  );
}

function buildProtectedMenuReply(): string {
  return (
    "Maaf, saya tidak bisa mengubah daftar menu atau harga resmi ChefBot. " +
    "Saya hanya bisa merekomendasikan menu yang tersedia. " +
    "Coba beri budget atau preferensi makan Anda, ya."
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeMenuPrices(reply: string): string {
  return menuCatalog.reduce((safeReply, item) => {
    const pattern = new RegExp(
      `(${escapeRegExp(item.name)}[^\\n]*?)Rp\\s*[0-9.]+`,
      "gi"
    );

    return safeReply.replace(
      pattern,
      (_match, prefix: string) => `${prefix}${formatPrice(item.price)}`
    );
  }, reply);
}

export async function sendMessage(
  prompt: string,
  history: Message[]
): Promise<string> {
  if (!API_KEY) {
    throw new Error(
      "API Key tidak ditemukan! Pastikan file .env berisi VITE_GROQ_API_KEY dan restart dev server (npm run dev)."
    );
  }

  if (isProtectedMenuRequest(prompt)) {
    return buildProtectedMenuReply();
  }

  const messages = [
    { role: "system", content: chatbotConfig.systemInstruction },
    ...history.map((msg) => ({
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
      temperature: 0.2,
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

  return normalizeMenuPrices(reply);
}
