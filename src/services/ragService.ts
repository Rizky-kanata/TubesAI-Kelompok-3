import type { KnowledgeChunk } from "../data/knowledgeBase";
import {
  getActiveKnowledgeSources,
  getAllKnowledgeChunks,
  getAllKnowledgeChunksSync,
} from "./knowledgeAdminService";
import type { MessageSource } from "../types/Message";

export interface RetrievedChunk extends KnowledgeChunk {
  score: number;
  excerpt: string;
}

const stopWords = new Set([
  "ada",
  "agar",
  "akan",
  "apa",
  "apakah",
  "atau",
  "bagai",
  "bagaimana",
  "bagi",
  "cara",
  "dan",
  "dari",
  "dengan",
  "di",
  "dalam",
  "harus",
  "ini",
  "itu",
  "jika",
  "ke",
  "kegiatan",
  "mana",
  "melalui",
  "mohon",
  "pada",
  "perlu",
  "saat",
  "saya",
  "sebagai",
  "secara",
  "sesuai",
  "siapa",
  "untuk",
  "yang",
]);

const queryExpansions = [
  {
    matches: ["proposal", "pendanaan", "dana", "pencairan", "rab"],
    terms: ["proposal", "pendanaan", "dana", "pencairan", "rab", "pengesahan"],
  },
  {
    matches: ["lpj", "pertanggungjawaban", "laporan", "nota", "evidence"],
    terms: ["lpj", "pertanggungjawaban", "laporan", "nota", "evidence", "presensi"],
  },
  {
    matches: ["sertifikat", "sertifikasi", "nomor", "tanda", "tangan"],
    terms: ["sertifikat", "sertifikasi", "nomor", "tanda", "tangan", "desain"],
  },
  {
    matches: ["tak", "transkrip", "aktivitas", "kemahasiswaan"],
    terms: ["tak", "transkrip", "aktivitas", "kemahasiswaan", "panduan"],
  },
  {
    matches: ["link", "form", "tautan", "url"],
    terms: ["link", "form", "https", "office", "tel-u"],
  },
  {
    matches: ["kontak", "contact", "cp", "whatsapp", "wa"],
    terms: ["contact", "person", "whatsapp", "wa", "vio", "0821"],
  },
  {
    matches: ["alur", "prosedur", "tahapan", "langkah"],
    terms: ["alur", "prosedur", "tahapan", "langkah", "proses"],
  },
  {
    matches: ["syarat", "dokumen", "lampiran", "kelengkapan"],
    terms: ["syarat", "dokumen", "lampiran", "kelengkapan", "wajib"],
  },
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/.:_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function expandTokens(tokens: string[]): string[] {
  const expanded = new Set(tokens);

  for (const expansion of queryExpansions) {
    if (expansion.matches.some((term) => expanded.has(term))) {
      expansion.terms.forEach((term) => expanded.add(term));
    }
  }

  return [...expanded];
}

function countOccurrences(text: string, term: string): number {
  const normalizedTerm = normalizeText(term);

  if (!normalizedTerm) {
    return 0;
  }

  return normalizeText(text)
    .split(" ")
    .filter((token) => token === normalizedTerm).length;
}

function containsExactTerm(text: string, term: string): boolean {
  return countOccurrences(text, term) > 0;
}

function extractFaqQuestion(content: string): string | null {
  const match = content.match(/^Question\s*:\s*(.+)$/im);
  return match?.[1]?.trim() || null;
}

function extractFaqAnswer(content: string): string | null {
  const marker = /^Answer\s*:\s*/im.exec(content);

  if (!marker || marker.index === undefined) {
    return null;
  }

  const answer = content
    .slice(marker.index + marker[0].length)
    .replace(/\n={5,}\s*\n[^\n]+\n={5,}\s*$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return answer || null;
}

function buildDirectFaqAnswer(
  query: string,
  chunks: RetrievedChunk[]
): string | null {
  const queryTokens = new Set(tokenize(query));

  if (queryTokens.size === 0) {
    return null;
  }

  const candidates = chunks
    .map((chunk) => {
      const question = extractFaqQuestion(chunk.content);
      const answer = extractFaqAnswer(chunk.content);

      if (!question || !answer) {
        return null;
      }

      const questionTokens = tokenize(question);
      const overlap = questionTokens.filter((token) =>
        queryTokens.has(token)
      ).length;
      const overlapRatio = overlap / Math.max(queryTokens.size, 1);
      const exactMatch =
        normalizeText(question) === normalizeText(query);

      return {
        answer,
        score: exactMatch ? 2 : overlapRatio,
      };
    })
    .filter(
      (
        candidate
      ): candidate is {
        answer: string;
        score: number;
      } => Boolean(candidate)
    )
    .sort((a, b) => b.score - a.score);

  if (!candidates.length || candidates[0].score < 0.6) {
    return null;
  }

  return candidates[0].answer;
}

function isFlowQuery(query: string): boolean {
  return /\b(alur|cara|prosedur|tahapan|langkah|proses|mengajukan|pengajuan)\b/i.test(
    query
  );
}

function isLinkQuery(query: string): boolean {
  return /\b(link|tautan|form|url|pengumpulan|unggah|upload)\b/i.test(query);
}

function isFlowChunk(chunk: KnowledgeChunk): boolean {
  return /\balur\b/i.test(`${chunk.title} ${chunk.section} ${chunk.content}`);
}

function isHeadingLine(line: string, chunk: KnowledgeChunk): boolean {
  const normalizedLine = normalizeText(line);
  const normalizedTitle = normalizeText(chunk.title);
  const normalizedSection = normalizeText(chunk.section);

  return (
    normalizedLine === normalizedTitle ||
    normalizedLine === normalizedSection ||
    normalizedLine === "catatan:" ||
    normalizedLine.startsWith("alur pengajuan")
  );
}

function buildNumberedFlowAnswer(
  chunks: RetrievedChunk[],
  allChunks = getAllKnowledgeChunksSync()
): string | null {
  const seedChunk = chunks.find(isFlowChunk);

  if (!seedChunk) {
    return null;
  }

  const relatedChunks = allChunks
    .filter(
      (chunk) =>
        chunk.title === seedChunk.title &&
        chunk.section === seedChunk.section &&
        isFlowChunk(chunk)
    )
    .sort((a, b) => allChunks.indexOf(a) - allChunks.indexOf(b));

  const steps = relatedChunks
    .flatMap((chunk) =>
      chunk.content
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !isHeadingLine(line, chunk))
    )
    .filter((line, index, lines) => lines.indexOf(line) === index);

  if (steps.length === 0) {
    return null;
  }

  const numberedSteps = steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  return `Berikut alurnya:\n${numberedSteps}`;
}

function getLinkLabel(chunk: KnowledgeChunk, line: string): string {
  const context = `${chunk.title} ${chunk.section} ${chunk.content} ${line}`.toLowerCase();

  if (context.includes("tak") || context.includes("transkrip aktivitas")) {
    return "Panduan TAK";
  }

  if (
    context.includes("template") &&
    (context.includes("lpj") || context.includes("pertanggungjawaban"))
  ) {
    return "Template LPJ kegiatan";
  }

  if (context.includes("template") && context.includes("proposal")) {
    return "Template proposal kegiatan";
  }

  if (context.includes("sertifikasi") || context.includes("sertifikat")) {
    return "Pengajuan tanda tangan sertifikat kegiatan";
  }

  if (context.includes("instagram")) {
    return "Instagram SSC/Kemahasiswaan";
  }

  if (context.includes("whatsapp") || context.includes("6281132212000")) {
    return "WhatsApp SSC/Kemahasiswaan";
  }

  if (context.includes("lpj") || context.includes("pertanggungjawaban")) {
    return "Pengumpulan LPJ kegiatan";
  }

  if (context.includes("proposal") || context.includes("pendanaan")) {
    return "Pengajuan proposal kegiatan";
  }

  return chunk.title;
}


function extractUrls(content: string): string[] {
  return (content.match(/https?:\/\/\S+/g) || []).map((url) =>
    url.replace(/[.,;)]$/g, "")
  );
}

function findSubmissionUrl(
  entity: "proposal" | "lpj",
  chunks: KnowledgeChunk[]
): string | null {
  const candidates = chunks
    .map((chunk) => {
      const text = normalizeText(`${chunk.section} ${chunk.content}`);
      const urls = extractUrls(chunk.content);

      if (urls.length === 0) {
        return null;
      }

      const hasEntity =
        entity === "proposal"
          ? containsExactTerm(text, "proposal")
          : containsExactTerm(text, "lpj") || text.includes("pertanggungjawaban");

      if (!hasEntity) {
        return null;
      }

      let score = 0;

      if (/dikumpulkan|pengumpulan|unggah|upload/.test(text)) {
        score += 30;
      }

      if (entity === "proposal" && /proposal kegiatan dapat dikumpulkan/.test(text)) {
        score += 35;
      }

      if (entity === "lpj" && /lpj kegiatan dapat dikumpulkan|soft copy lpj/.test(text)) {
        score += 35;
      }

      if (/template/.test(text)) {
        score -= 50;
      }

      const preferredUrl =
        urls.find((url) => /forms\.office\.com/i.test(url)) || urls[0];

      if (/forms\.office\.com/i.test(preferredUrl)) {
        score += 15;
      }

      return { url: preferredUrl, score };
    })
    .filter(
      (candidate): candidate is { url: string; score: number } =>
        Boolean(candidate)
    )
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.score > 0 ? candidates[0].url : null;
}

export function buildRequestedSubmissionLinkAnswer(
  query: string,
  allChunks = getAllKnowledgeChunksSync()
): string | null {
  const normalizedQuery = normalizeText(query);
  const asksForCollection =
    /pengumpulan|dikumpulkan|mengumpulkan|kumpul|unggah|upload/.test(
      normalizedQuery
    );

  if (!asksForCollection) {
    return null;
  }

  const activeSources = new Set(getActiveKnowledgeSources());
  const activeChunks = allChunks.filter((chunk) =>
    activeSources.has(chunk.source)
  );
  const wantsProposal = containsExactTerm(normalizedQuery, "proposal");
  const wantsLpj =
    containsExactTerm(normalizedQuery, "lpj") ||
    normalizedQuery.includes("pertanggungjawaban");
  const items: Array<{ label: string; url: string }> = [];

  if (wantsProposal) {
    const proposalUrl = findSubmissionUrl("proposal", activeChunks);

    if (proposalUrl) {
      items.push({
        label: "Pengumpulan proposal kegiatan",
        url: proposalUrl,
      });
    }
  }

  if (wantsLpj) {
    const lpjUrl = findSubmissionUrl("lpj", activeChunks);

    if (lpjUrl) {
      items.push({
        label: "Pengumpulan LPJ kegiatan",
        url: lpjUrl,
      });
    }
  }

  if (items.length === 0) {
    return null;
  }

  const formattedItems = items
    .map(({ label, url }, index) => `${index + 1}. ${label}\nLink: ${url}`)
    .join("\n\n");

  return `Berikut link pengumpulan yang tersedia:\n${formattedItems}`;
}

function buildNumberedLinkAnswer(chunks: RetrievedChunk[]): string | null {
  const links = new Map<string, string>();

  for (const chunk of chunks) {
    const lines = chunk.content.split(/\n+/).map((line) => line.trim());

    for (const line of lines) {
      const urls = line.match(/https?:\/\/\S+/g);

      if (!urls) {
        continue;
      }

      for (const rawUrl of urls) {
        const url = rawUrl.replace(/[.,;)]$/g, "");

        if (!links.has(url)) {
          links.set(url, getLinkLabel(chunk, line));
        }
      }
    }
  }

  if (links.size === 0) {
    return null;
  }

  const items = [...links.entries()]
    .slice(0, 5)
    .map(([url, label], index) => `${index + 1}. ${label}\nLink: ${url}`)
    .join("\n\n");

  return `Berikut link yang tersedia:\n${items}`;
}

function buildExcerpt(chunk: KnowledgeChunk, queryTokens: string[]): string {
  const faqAnswer = extractFaqAnswer(chunk.content);

  if (faqAnswer) {
    return faqAnswer.length > 700
      ? `${faqAnswer.slice(0, 697).trim()}...`
      : faqAnswer;
  }

  const lines = chunk.content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const matchingLine = lines.find((line) =>
    queryTokens.some((token) => containsExactTerm(line, token))
  );

  const excerpt = matchingLine || lines.slice(0, 2).join(" ");
  return excerpt.length > 400 ? `${excerpt.slice(0, 397).trim()}...` : excerpt;
}

function scoreChunk(chunk: KnowledgeChunk, query: string, queryTokens: string[]): number {
  const titleText = normalizeText(`${chunk.title} ${chunk.section} ${chunk.source}`);
  const contentText = normalizeText(chunk.content);
  const normalizedQuery = normalizeText(query);
  let score = 0;

  for (const token of queryTokens) {
    if (containsExactTerm(titleText, token)) {
      score += 8;
    }

    const occurrences = countOccurrences(contentText, token);
    if (occurrences > 0) {
      score += 1.2 + occurrences * 0.8;
    }
  }

  const phrases = normalizedQuery
    .split(" ")
    .filter((token) => token.length > 2)
    .reduce<string[]>((result, token, index, tokens) => {
      if (index < tokens.length - 1) {
        result.push(`${token} ${tokens[index + 1]}`);
      }

      return result;
    }, []);

  for (const phrase of phrases) {
    if (titleText.includes(phrase)) {
      score += 10;
    }

    if (contentText.includes(phrase)) {
      score += 6;
    }
  }

  return score;
}

export async function retrieveRelevantChunks(
  query: string,
  limit = 5
): Promise<RetrievedChunk[]> {
  const baseTokens = tokenize(query);
  const queryTokens = expandTokens(baseTokens);
  const activeSources = new Set(getActiveKnowledgeSources());
  const allChunks = await getAllKnowledgeChunks();

  if (queryTokens.length === 0) {
    return [];
  }

  return allChunks
    .filter((chunk) => activeSources.has(chunk.source))
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk, query, queryTokens),
      excerpt: buildExcerpt(chunk, queryTokens),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildRagContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, index) => {
      const content =
        chunk.content.length > 1600 ? `${chunk.content.slice(0, 1597).trim()}...` : chunk.content;

      return [
        `Sumber [${index + 1}]`,
        `Judul: ${chunk.title}`,
        `Bagian: ${chunk.section}`,
        `Isi: ${content}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function toMessageSources(chunks: RetrievedChunk[], limit = 4): MessageSource[] {
  const sources = new Map<string, MessageSource>();

  for (const chunk of chunks) {
    const key = `${chunk.title}-${chunk.section}-${chunk.source}`;

    if (!sources.has(key)) {
      sources.set(key, {
        id: chunk.id,
        title: chunk.title,
        section: chunk.section,
        source: chunk.source,
      });
    }

    if (sources.size >= limit) {
      break;
    }
  }

  return [...sources.values()];
}

export function buildLocalFallbackAnswer(
  query: string,
  chunks: RetrievedChunk[],
  allChunks = getAllKnowledgeChunksSync()
): string {
  if (chunks.length === 0) {
    return (
      "Saya belum menemukan informasi yang cocok pada dokumen yang tersedia. " +
      "Coba gunakan kata kunci seperti proposal, LPJ, sertifikasi, link, atau contact person."
    );
  }

  const wantsSources = /\b(sumber|dokumen|file|referensi)\b/i.test(query);

  if (wantsSources) {
    return (
      "Sumber data tersimpan di knowledge base internal aplikasi dan tidak ditampilkan di halaman. " +
      "Silakan tanyakan isi informasi yang dibutuhkan, seperti alur proposal, syarat LPJ, atau sertifikasi."
    );
  }

  const submissionLinkAnswer = buildRequestedSubmissionLinkAnswer(query, allChunks);

  if (submissionLinkAnswer) {
    return submissionLinkAnswer;
  }

  if (isLinkQuery(query)) {
    const linkAnswer = buildNumberedLinkAnswer(chunks);

    if (linkAnswer) {
      return linkAnswer;
    }
  }

  const directFaqAnswer = buildDirectFaqAnswer(query, chunks);

  if (directFaqAnswer) {
    return directFaqAnswer;
  }

  if (isFlowQuery(query)) {
    const flowAnswer = buildNumberedFlowAnswer(chunks, allChunks);

    if (flowAnswer) {
      return flowAnswer;
    }
  }

  const facts = chunks
    .slice(0, 3)
    .map((chunk, index) => `${index + 1}. ${chunk.excerpt}`)
    .join("\n");

  return `Berikut informasi yang saya temukan dari dokumen:\n${facts}`;
}
