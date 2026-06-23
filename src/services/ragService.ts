import type { KnowledgeChunk } from "../data/knowledgeBase";
import {
  getActiveKnowledgeSources,
  getAllKnowledgeChunks,
  getAllKnowledgeChunksSync,
  getKnowledgeDocuments,
  type KnowledgeDocument,
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
  "isi",
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
    matches: ["lpj", "pertanggungjawaban", "nota", "evidence"],
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
    matches: ["file", "download", "unduh", "pdf", "word", "docx", "excel", "xlsx"],
    terms: ["file", "dokumen", "download", "unduh", "pdf", "word", "excel"],
  },
  {
    matches: [
      "kontak",
      "contact",
      "cp",
      "nomor",
      "telepon",
      "whatsapp",
      "hotline",
      "email",
      "instagram",
      "wa",
    ],
    terms: [
      "contact",
      "person",
      "kontak",
      "nomor",
      "telepon",
      "whatsapp",
      "hotline",
      "email",
      "instagram",
      "wa",
      "0811",
      "0812",
    ],
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

const tokenAliases: Record<string, string[]> = {
  lpj: ["lpg", "lpjj", "lpjnya"],
  lampiran: ["lompiran", "lampirn", "lampran", "lampirann", "lampirannya"],
  laporan: ["lpaoran", "laproan", "lapran", "lapoan", "lapora", "laporann"],
  pengajuan: ["pengajuaan", "pengajun", "pngajuan", "pengajuann"],
  pertanggungjawaban: [
    "pertangungjawaban",
    "pertanggungjawban",
    "pertanggungjawabn",
    "pertangung",
  ],
  pengujian: ["pengujuan", "pengujan", "pengjian", "pegujian", "pengujin"],
  proposal: ["propsal", "proposl", "porposal", "proposalnya"],
  sertifikat: ["sertifkat", "sertfikasi", "sertfikat", "sertipikat"],
  sertifikasi: ["sertifkasi", "sertfikasi", "sertipikasi"],
  syarat: ["syrat", "sarat", "syart"],
  alur: ["allur", "alurrr", "alurr"],
  dokumen: ["dokmen", "document", "dokumenn"],
  template: ["templete", "templte"],
  unggah: ["ungah", "unggahh", "unggha"],
  upload: ["uplod", "uplot", "aplod"],
  nomor: ["nomer", "nmr", "number"],
  telepon: ["telpon", "telp", "phone", "ponsel"],
  whatsapp: ["whatsap", "watshapp", "wahtsapp", "whatapp", "watsap", "wa"],
  hotline: ["hot line", "hotlain"],
  email: ["e-mail", "mail"],
  instagram: ["ig", "insta"],
  kontak: ["contact", "kontrak", "kontakknya", "cp"],
};

const aliasLookup = new Map(
  Object.entries(tokenAliases).flatMap(([canonical, aliases]) =>
    aliases.map((alias) => [alias, canonical])
  )
);

const fuzzyCanonicalTokens = Object.keys(tokenAliases);
const dynamicCorrectionCache = new WeakMap<KnowledgeChunk[], Map<string, number>>();

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/.:_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEditDistance(a: string, b: string): number {
  const distances = Array.from({ length: a.length + 1 }, (_, row) =>
    Array.from({ length: b.length + 1 }, (_, column) =>
      row === 0 ? column : column === 0 ? row : 0
    )
  );

  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      const substitutionCost = a[row - 1] === b[column - 1] ? 0 : 1;
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + substitutionCost
      );
    }
  }

  return distances[a.length][b.length];
}

function normalizeToken(token: string): string {
  const alias = aliasLookup.get(token);

  if (alias) {
    return alias;
  }

  const fuzzyMatch = fuzzyCanonicalTokens.find((canonical) => {
    if (Math.abs(canonical.length - token.length) > 2) {
      return false;
    }

    const maxDistance = canonical.length > 6 ? 2 : 1;
    return getEditDistance(token, canonical) <= maxDistance;
  });

  return fuzzyMatch || token;
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map(normalizeToken)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function canFuzzyCorrectToken(token: string): boolean {
  return /^[a-z]+$/.test(token) && token.length >= 4;
}

function getDynamicCorrectionLimit(token: string): number {
  if (token.length >= 10) {
    return 3;
  }

  if (token.length >= 6) {
    return 2;
  }

  return 1;
}

function buildDocumentVocabulary(chunks: KnowledgeChunk[]): Map<string, number> {
  const cachedVocabulary = dynamicCorrectionCache.get(chunks);

  if (cachedVocabulary) {
    return cachedVocabulary;
  }

  const vocabulary = new Map<string, number>();

  for (const chunk of chunks) {
    const tokens = normalizeText(`${chunk.title} ${chunk.section} ${chunk.content}`).split(" ");

    for (const token of tokens) {
      if (token.length <= 2 || stopWords.has(token) || /\d/.test(token)) {
        continue;
      }

      vocabulary.set(token, (vocabulary.get(token) || 0) + 1);
    }
  }

  dynamicCorrectionCache.set(chunks, vocabulary);
  return vocabulary;
}

function findClosestVocabularyToken(
  token: string,
  vocabulary: Map<string, number>
): string | null {
  if (!canFuzzyCorrectToken(token) || vocabulary.has(token)) {
    return null;
  }

  const distanceLimit = getDynamicCorrectionLimit(token);
  let bestToken: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestFrequency = 0;

  for (const [candidate, frequency] of vocabulary) {
    if (!canFuzzyCorrectToken(candidate)) {
      continue;
    }

    if (Math.abs(candidate.length - token.length) > distanceLimit) {
      continue;
    }

    const firstLetterDistance = getEditDistance(token.slice(0, 2), candidate.slice(0, 2));

    if (firstLetterDistance > 1) {
      continue;
    }

    const distance = getEditDistance(token, candidate);

    if (distance > distanceLimit) {
      continue;
    }

    if (
      distance < bestDistance ||
      (distance === bestDistance && frequency > bestFrequency)
    ) {
      bestToken = candidate;
      bestDistance = distance;
      bestFrequency = frequency;
    }
  }

  return bestToken;
}

function correctTokensWithDocumentVocabulary(
  tokens: string[],
  chunks: KnowledgeChunk[]
): string[] {
  const vocabulary = buildDocumentVocabulary(chunks);

  return tokens.map(
    (token) => findClosestVocabularyToken(token, vocabulary) || token
  );
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

function hasNormalizedTerm(text: string, term: string): boolean {
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escapedTerm}(?:$|[^a-z0-9])`).test(text);
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

function isContactQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  const queryTokens = new Set(tokenize(query));

  return (
    /\b(no|nomor|nomer|nmr|number|kontak|contact|cp|whatsapp|whatsap|whatapp|watsap|wa|hotline|telepon|telpon|telp|hp|email|e-mail|instagram|ig)\b/i.test(
      normalizedQuery
    ) ||
    [
      "nomor",
      "kontak",
      "whatsapp",
      "hotline",
      "telepon",
      "email",
      "instagram",
    ].some((token) => queryTokens.has(token))
  );
}

export function isDocumentFileRequest(query: string): boolean {
  return (
    /\b(file|download|unduh|donlod|dolownd)\b/i.test(query) ||
    /\b(minta|mintakan|kasih|beri|berikan|kirim)\b.*\bdokumen\b/i.test(query) ||
    /\b(minta|mintakan|kasih|beri|berikan|kirim)\b.*\b(pdf|word|doc|docx|excel|xls|xlsx|xlsm|csv)\b/i.test(query)
  );
}

function isFlowChunk(chunk: KnowledgeChunk): boolean {
  return /\balur\b/i.test(`${chunk.title} ${chunk.section} ${chunk.content}`);
}

function getChunkSearchText(chunk: KnowledgeChunk): string {
  return normalizeText(`${chunk.title} ${chunk.section} ${chunk.source} ${chunk.content}`);
}

function getQueryTopicTerms(query: string): string[] {
  const queryTokens = new Set(tokenize(query));

  if (
    queryTokens.has("proposal") ||
    queryTokens.has("pendanaan") ||
    queryTokens.has("dana")
  ) {
    return ["proposal", "pendanaan", "dana", "pencairan"];
  }

  if (queryTokens.has("lpj") || queryTokens.has("pertanggungjawaban")) {
    return ["lpj", "pertanggungjawaban", "laporan"];
  }

  if (queryTokens.has("sertifikat") || queryTokens.has("sertifikasi")) {
    return ["sertifikat", "sertifikasi"];
  }

  if (queryTokens.has("tak") || queryTokens.has("transkrip")) {
    return ["tak", "transkrip", "aktivitas", "kemahasiswaan"];
  }

  return [];
}

function focusChunksByQueryTopic<T extends KnowledgeChunk>(
  query: string,
  chunks: T[]
): T[] {
  const topicTerms = getQueryTopicTerms(query);

  if (topicTerms.length === 0) {
    return chunks;
  }

  const focusedChunks = chunks.filter((chunk) =>
    matchesAnyTerm(getChunkSearchText(chunk), topicTerms)
  );

  return focusedChunks;
}

function findFlowSeedChunk(
  query: string,
  chunks: RetrievedChunk[]
): RetrievedChunk | null {
  const flowChunks = chunks.filter(isFlowChunk);

  if (flowChunks.length === 0) {
    return null;
  }

  const topicTerms = getQueryTopicTerms(query);

  if (topicTerms.length === 0) {
    return flowChunks[0];
  }

  return (
    flowChunks.find((chunk) =>
      matchesAnyTerm(getChunkSearchText(chunk), topicTerms)
    ) || null
  );
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

function isSectionHeadingLine(line: string): boolean {
  return /^[A-Z]\.\s+/.test(line);
}

function isNumberedStepLine(line: string): boolean {
  return /^\d+[.)]\s+/.test(line);
}

function stripStepNumber(line: string): string {
  return line.replace(/^\d+[.)]\s+/, "").trim();
}

function normalizeFlowLines(lines: string[]): string[] {
  const normalizedLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      continue;
    }

    if (/^\d+[.)]?$/.test(line) && lines[index + 1]) {
      normalizedLines.push(`${line.replace(/[.)]?$/, ".")} ${lines[index + 1].trim()}`);
      index += 1;
      continue;
    }

    normalizedLines.push(line);
  }

  return normalizedLines;
}

function getFocusedFlowLines(lines: string[]): string[] {
  const preferredFlowHeadingIndex = lines.findIndex(
    (line) =>
      (/^[A-Z]\.\s+/.test(line) || /\balur\s+umum\b/i.test(line)) &&
      /\balur\b/i.test(line) &&
      /\b(umum|menghubungi|pengajuan|prosedur|tahapan|langkah)\b/i.test(line)
  );
  const flowHeadingIndex =
    preferredFlowHeadingIndex !== -1
      ? preferredFlowHeadingIndex
      : lines.findIndex((line) =>
          /\balur\b/i.test(line) &&
          /\b(umum|menghubungi|pengajuan|prosedur|tahapan|langkah)\b/i.test(line)
  );

  if (flowHeadingIndex === -1) {
    return lines;
  }

  const nextSectionIndex = lines.findIndex(
    (line, index) => index > flowHeadingIndex && isSectionHeadingLine(line)
  );

  return lines.slice(
    flowHeadingIndex + 1,
    nextSectionIndex === -1 ? lines.length : nextSectionIndex
  );
}

function buildNumberedFlowAnswer(
  query: string,
  chunks: RetrievedChunk[],
  allChunks = getAllKnowledgeChunksSync()
): string | null {
  const seedChunk = findFlowSeedChunk(query, chunks);

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

  const focusedLines = getFocusedFlowLines(normalizeFlowLines(steps));
  const numberedSteps = focusedLines
    .filter(isNumberedStepLine)
    .map(stripStepNumber)
    .filter(Boolean);
  const finalSteps =
    numberedSteps.length >= 2
      ? numberedSteps
      : focusedLines.filter((line) => !isSectionHeadingLine(line));

  if (finalSteps.length === 0) {
    return null;
  }

  const formattedSteps = finalSteps
    .map((step, index) => `${index + 1}. ${step}`)
    .join("\n");
  return `Berikut alurnya:\n${formattedSteps}`;
}

interface ContactItem {
  label: string;
  type: "WhatsApp" | "Hotline" | "Nomor" | "Email" | "Instagram";
  value: string;
  location?: string;
}

function extractPhoneNumbers(line: string): string[] {
  return (line.match(/(?:\+?62|0)\d[\d\s-]{6,}\d/g) || [])
    .map((number) => number.replace(/\s+/g, " ").trim())
    .filter((number, index, numbers) => numbers.indexOf(number) === index);
}

function extractEmails(line: string): string[] {
  return (line.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [])
    .map((email) => email.trim())
    .filter((email, index, emails) => emails.indexOf(email) === index);
}

function extractInstagramHandles(line: string): string[] {
  return (line.match(/@[a-z0-9._]{3,}/gi) || [])
    .map((handle) => handle.trim())
    .filter((handle, index, handles) => handles.indexOf(handle) === index);
}

function getContactLocation(sectionHeading: string, line: string): string | undefined {
  const text = normalizeText(`${sectionHeading} ${line}`);

  if (text.includes("surabaya") || text.includes("sby")) {
    return "Telkom University Surabaya";
  }

  if (text.includes("bandung") || text.includes("kampus utama")) {
    return "Telkom University Bandung";
  }

  return undefined;
}

function getPhoneContactType(line: string): ContactItem["type"] {
  const normalizedLine = normalizeText(line);

  if (normalizedLine.includes("whatsapp") || /\bwa\b/.test(normalizedLine)) {
    return "WhatsApp";
  }

  if (normalizedLine.includes("hotline")) {
    return "Hotline";
  }

  return "Nomor";
}

function getContactLabel(line: string, type: ContactItem["type"]): string {
  const cleanedLine = line.replace(/^\d+[.)]\s*/, "").trim();
  const colonLabel = cleanedLine.split(":")[0]?.trim();

  if (colonLabel && colonLabel.length <= 80 && colonLabel !== cleanedLine) {
    return colonLabel;
  }

  const normalizedLine = normalizeText(line);

  if (normalizedLine.includes("admin keuangan") || normalizedLine.includes("bpp")) {
    return "Admin Keuangan BPP";
  }

  if (normalizedLine.includes("admisi")) {
    return "Layanan Admisi";
  }

  if (normalizedLine.includes("instagram")) {
    return "Instagram SSC";
  }

  if (normalizedLine.includes("email")) {
    return "Email SSC";
  }

  if (normalizedLine.includes("hotline")) {
    return "Hotline";
  }

  return `Kontak ${type}`;
}

function extractContactItemsFromChunks(chunks: KnowledgeChunk[]): ContactItem[] {
  const contacts: ContactItem[] = [];

  for (const chunk of chunks) {
    let sectionHeading = "";
    const lines = chunk.content
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (/^[A-Z]\.\s+/.test(line) && /\bkontak\b/i.test(line)) {
        sectionHeading = line;
        continue;
      }

      const location = getContactLocation(sectionHeading, line);
      const phoneNumbers = extractPhoneNumbers(line);
      const emails = extractEmails(line);
      const instagramHandles = extractInstagramHandles(line);

      for (const value of phoneNumbers) {
        const type = getPhoneContactType(line);
        contacts.push({
          label: getContactLabel(line, type),
          type,
          value,
          location,
        });
      }

      for (const value of emails) {
        contacts.push({
          label: getContactLabel(line, "Email"),
          type: "Email",
          value,
          location,
        });
      }

      for (const value of instagramHandles) {
        contacts.push({
          label: getContactLabel(line, "Instagram"),
          type: "Instagram",
          value,
          location,
        });
      }
    }
  }

  const seenContacts = new Set<string>();
  return contacts.filter((contact) => {
    const key = `${contact.type}-${contact.value}-${contact.location || ""}`;

    if (seenContacts.has(key)) {
      return false;
    }

    seenContacts.add(key);
    return true;
  });
}

function filterContactItems(query: string, contacts: ContactItem[]): ContactItem[] {
  const normalizedQuery = normalizeText(query);
  const wantsSurabaya = /\b(surabaya|sby)\b/.test(normalizedQuery);
  const wantsBandung = /\b(bandung|bdg|kampus utama)\b/.test(normalizedQuery);
  const wantsWhatsapp = /\b(whatsapp|whatsap|whatapp|watsap|wa)\b/.test(normalizedQuery);
  const wantsHotline = /\b(hotline|hot line)\b/.test(normalizedQuery);
  const wantsEmail = /\b(email|e-mail|mail)\b/.test(normalizedQuery);
  const wantsInstagram = /\b(instagram|ig|insta)\b/.test(normalizedQuery);
  const wantsPhone =
    /\b(no|nomor|nomer|nmr|number|telepon|telpon|telp|hp)\b/.test(
      normalizedQuery
    ) ||
    wantsWhatsapp ||
    wantsHotline;

  let filteredContacts = contacts;

  if (wantsSurabaya) {
    const locationMatches = filteredContacts.filter((contact) =>
      normalizeText(contact.location || "").includes("surabaya")
    );

    if (locationMatches.length > 0) {
      filteredContacts = locationMatches;
    }
  }

  if (wantsBandung) {
    const locationMatches = filteredContacts.filter((contact) =>
      normalizeText(contact.location || "").includes("bandung")
    );

    if (locationMatches.length > 0) {
      filteredContacts = locationMatches;
    }
  }

  const requestedTypes = new Set<ContactItem["type"]>();

  if (wantsWhatsapp) {
    requestedTypes.add("WhatsApp");
  }

  if (wantsHotline) {
    requestedTypes.add("Hotline");
  }

  if (wantsEmail) {
    requestedTypes.add("Email");
  }

  if (wantsInstagram) {
    requestedTypes.add("Instagram");
  }

  if (wantsPhone && requestedTypes.size === 0) {
    requestedTypes.add("WhatsApp");
    requestedTypes.add("Hotline");
    requestedTypes.add("Nomor");
  }

  if (requestedTypes.size > 0) {
    const typeMatches = filteredContacts.filter((contact) =>
      requestedTypes.has(contact.type)
    );

    if (typeMatches.length > 0) {
      filteredContacts = typeMatches;
    }
  }

  return filteredContacts;
}

function buildContactAnswer(
  query: string,
  chunks: RetrievedChunk[],
  allChunks = getAllKnowledgeChunksSync()
): string | null {
  if (!isContactQuery(query)) {
    return null;
  }

  const activeSources = new Set(getActiveKnowledgeSources());
  const activeChunks = allChunks.filter((chunk) => activeSources.has(chunk.source));
  const chunkContacts = filterContactItems(
    query,
    extractContactItemsFromChunks(chunks)
  );
  const contacts =
    chunkContacts.length > 0
      ? chunkContacts
      : filterContactItems(query, extractContactItemsFromChunks(activeChunks));

  if (contacts.length === 0) {
    return null;
  }

  const formattedContacts = contacts
    .slice(0, 6)
    .map((contact, index) => {
      const valueLabel =
        contact.type === "Email"
          ? "Email"
          : contact.type === "Instagram"
            ? "Instagram"
            : "Nomor";
      const location = contact.location ? ` - ${contact.location}` : "";

      return `${index + 1}. ${contact.label} (${contact.type})${location}\n${valueLabel}: ${contact.value}`;
    })
    .join("\n\n");

  return `Berikut kontak yang ditemukan pada dokumen:\n${formattedContacts}`;
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

function scoreChunk(
  chunk: KnowledgeChunk,
  query: string,
  queryTokens: string[],
  baseTokens: string[]
): number {
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

  const matchedBaseTokens = baseTokens.filter(
    (token) =>
      containsExactTerm(titleText, token) || containsExactTerm(contentText, token)
  );

  if (baseTokens.length > 1) {
    score += matchedBaseTokens.length * 5;
    score += (matchedBaseTokens.length / baseTokens.length) * 8;
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

  const correctedPhrases = baseTokens.reduce<string[]>((result, token, index, tokens) => {
    if (index < tokens.length - 1) {
      result.push(`${token} ${tokens[index + 1]}`);
    }

    return result;
  }, []);

  for (const phrase of correctedPhrases) {
    if (titleText.includes(phrase)) {
      score += 14;
    }

    if (contentText.includes(phrase)) {
      score += 9;
    }
  }

  return score;
}

export async function retrieveRelevantChunks(
  query: string,
  limit = 5
): Promise<RetrievedChunk[]> {
  const allChunks = await getAllKnowledgeChunks();
  const activeSources = new Set(getActiveKnowledgeSources());
  const activeChunks = allChunks.filter((chunk) =>
    activeSources.has(chunk.source)
  );
  const baseTokens = correctTokensWithDocumentVocabulary(
    tokenize(query),
    activeChunks
  );
  const queryTokens = expandTokens(baseTokens);

  if (queryTokens.length === 0) {
    return [];
  }

  const scoredChunks = activeChunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk, query, queryTokens, baseTokens),
      excerpt: buildExcerpt(chunk, queryTokens),
    }))
    .filter((chunk) => chunk.score > 0);

  return focusChunksByQueryTopic(query, scoredChunks)
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

function matchesAnyTerm(text: string, terms: string[]): boolean {
  return terms.some(
    (term) => containsExactTerm(text, term) || text.includes(term)
  );
}

function getRequestedFileExtensions(query: string): string[] {
  const normalizedQuery = normalizeText(query);
  const extensions = new Set<string>();

  if (hasNormalizedTerm(normalizedQuery, "pdf")) {
    extensions.add("pdf");
  }

  if (
    hasNormalizedTerm(normalizedQuery, "word") ||
    hasNormalizedTerm(normalizedQuery, "doc") ||
    hasNormalizedTerm(normalizedQuery, "docx")
  ) {
    extensions.add("doc");
    extensions.add("docx");
  }

  if (
    hasNormalizedTerm(normalizedQuery, "excel") ||
    hasNormalizedTerm(normalizedQuery, "xls") ||
    hasNormalizedTerm(normalizedQuery, "xlsx") ||
    hasNormalizedTerm(normalizedQuery, "xlsm") ||
    hasNormalizedTerm(normalizedQuery, "csv") ||
    hasNormalizedTerm(normalizedQuery, "spreadsheet")
  ) {
    extensions.add("xls");
    extensions.add("xlsx");
    extensions.add("xlsm");
    extensions.add("csv");
  }

  return [...extensions];
}

function getFileExtension(value = ""): string {
  return value.match(/\.([a-z0-9]{1,10})(?:$|[?#])/i)?.[1]?.toLowerCase() || "";
}

function getExtensionFromFileType(fileType = ""): string {
  const extensionByType: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel.sheet.macroenabled.12": "xlsm",
    "text/csv": "csv",
  };

  return extensionByType[fileType.toLowerCase()] || "";
}

function documentMatchesExtensions(
  document: KnowledgeDocument,
  extensions: string[]
): boolean {
  const candidateExtensions = [
    getFileExtension(document.source),
    getFileExtension(document?.fileName),
    getFileExtension(document?.fileUrl),
    getExtensionFromFileType(document?.fileType),
  ].filter(Boolean);

  return candidateExtensions.some((extension) => extensions.includes(extension));
}

const fileRequestNoiseTokens = new Set([
  "beri",
  "berikan",
  "bentuk",
  "csv",
  "data",
  "doc",
  "docx",
  "dokumen",
  "dolownd",
  "donlod",
  "download",
  "excel",
  "file",
  "format",
  "kasih",
  "kirim",
  "minta",
  "mintakan",
  "pdf",
  "spreadsheet",
  "tolong",
  "unduh",
  "word",
  "xls",
  "xlsm",
  "xlsx",
]);

const knownDocumentIntentTokens = new Set([
  "alur",
  "aktivitas",
  "dana",
  "kelengkapan",
  "lampiran",
  "lpj",
  "pendanaan",
  "pengajuan",
  "pertanggungjawaban",
  "proposal",
  "prosedur",
  "sertifikat",
  "sertifikasi",
  "syarat",
  "tak",
  "template",
  "transkrip",
]);

function getRequestedFileNameTokens(query: string): string[] {
  const uniqueTokens = new Set(
    tokenize(query).filter((token) => !fileRequestNoiseTokens.has(token))
  );

  return [...uniqueTokens];
}

function getDocumentNameSearchText(document: KnowledgeDocument): string {
  return normalizeText(
    [
      document.fileName,
      document.source,
      document.title,
      document.sections.join(" "),
      document.fileUrl,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getDocumentFullSearchText(document: KnowledgeDocument): string {
  return normalizeText(
    [
      getDocumentNameSearchText(document),
      document.content,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function documentMatchesAllNameTokens(
  document: KnowledgeDocument,
  tokens: string[]
): boolean {
  const nameText = getDocumentNameSearchText(document);
  return tokens.every((token) => matchesAnyTerm(nameText, [token]));
}

function documentMatchesAnyNameToken(
  document: KnowledgeDocument,
  tokens: string[]
): boolean {
  const nameText = getDocumentNameSearchText(document);
  return tokens.some((token) => matchesAnyTerm(nameText, [token]));
}

function filterDocumentsByNameRequest(
  documents: KnowledgeDocument[],
  nameTokens: string[]
): KnowledgeDocument[] {
  if (nameTokens.length === 0) {
    return documents;
  }

  const exactNameMatches = documents.filter((document) =>
    documentMatchesAllNameTokens(document, nameTokens)
  );

  if (exactNameMatches.length > 0) {
    return exactNameMatches;
  }

  const strictNameTokens = nameTokens.filter(
    (token) => !knownDocumentIntentTokens.has(token)
  );

  if (strictNameTokens.length > 0) {
    return documents.filter((document) =>
      documentMatchesAllNameTokens(document, strictNameTokens)
    );
  }

  const partialNameMatches = documents.filter((document) =>
    documentMatchesAnyNameToken(document, nameTokens)
  );

  return partialNameMatches.length > 0 ? partialNameMatches : documents;
}

function filterDocumentsByTerms(
  documents: KnowledgeDocument[],
  terms: string[]
): KnowledgeDocument[] {
  return documents.filter((document) =>
    matchesAnyTerm(getDocumentFullSearchText(document), terms)
  );
}

function pickDocumentChunk(
  document: KnowledgeDocument,
  query: string,
  allChunks: KnowledgeChunk[]
): RetrievedChunk {
  const queryTokens = expandTokens(tokenize(query));
  const documentChunks = allChunks.filter(
    (chunk) => chunk.source === document.source || chunk.source === document.id
  );
  const selectedChunk =
    documentChunks
      .map((chunk) => ({
        chunk,
        score: scoreChunk(chunk, query, queryTokens, queryTokens),
      }))
      .sort((a, b) => b.score - a.score)[0]?.chunk ||
    ({
      id: document.id,
      title: document.title,
      section: document.sections[0] || "Dokumen",
      source: document.source,
      content: document.content || "",
    } satisfies KnowledgeChunk);

  return {
    ...selectedChunk,
    title: document.title || selectedChunk.title,
    section: selectedChunk.section || document.sections[0] || "Dokumen",
    source: document.source,
    score: scoreChunk(selectedChunk, query, queryTokens, queryTokens),
    excerpt: buildExcerpt(selectedChunk, queryTokens),
  };
}

function scoreFileDocumentCandidate(
  document: KnowledgeDocument,
  nameTokens: string[],
  requestedExtensions: string[],
  retrievedScore: number
): number {
  const nameText = getDocumentNameSearchText(document);
  const fullText = getDocumentFullSearchText(document);
  let score = retrievedScore;

  if (
    requestedExtensions.length > 0 &&
    documentMatchesExtensions(document, requestedExtensions)
  ) {
    score += 30;
  }

  for (const token of nameTokens) {
    if (matchesAnyTerm(nameText, [token])) {
      score += 20;
      continue;
    }

    if (matchesAnyTerm(fullText, [token])) {
      score += 4;
    }
  }

  if (document.isUploaded) {
    score += 2;
  }

  return score;
}

function getFileRequestDocumentChunks(
  query: string,
  retrievedChunks: RetrievedChunk[],
  limit: number
): RetrievedChunk[] {
  const activeSources = new Set(getActiveKnowledgeSources());
  const requestedExtensions = getRequestedFileExtensions(query);
  const nameTokens = getRequestedFileNameTokens(query);
  let candidates = getKnowledgeDocuments().filter(
    (document) =>
      document.isActive &&
      (activeSources.has(document.source) || activeSources.has(document.id))
  );

  if (requestedExtensions.length > 0) {
    candidates = candidates.filter((document) =>
      documentMatchesExtensions(document, requestedExtensions)
    );
  }

  candidates = filterDocumentsByNameRequest(candidates, nameTokens);

  const queryTokens = new Set(tokenize(query));
  const entityFilters: Array<{ active: boolean; terms: string[] }> = [
    {
      active: queryTokens.has("lpj") || queryTokens.has("pertanggungjawaban"),
      terms: ["lpj", "pertanggungjawaban"],
    },
    {
      active:
        queryTokens.has("proposal") ||
        queryTokens.has("pendanaan") ||
        queryTokens.has("dana"),
      terms: ["proposal", "pendanaan", "dana"],
    },
    {
      active: queryTokens.has("sertifikat") || queryTokens.has("sertifikasi"),
      terms: ["sertifikat", "sertifikasi"],
    },
    {
      active: queryTokens.has("tak") || queryTokens.has("transkrip"),
      terms: ["tak", "transkrip", "aktivitas", "kemahasiswaan"],
    },
  ];

  for (const filter of entityFilters) {
    if (!filter.active || candidates.length === 0) {
      continue;
    }

    const filteredCandidates = filterDocumentsByTerms(candidates, filter.terms);

    if (filteredCandidates.length > 0) {
      candidates = filteredCandidates;
    }
  }

  const detailFilters: Array<{ active: boolean; terms: string[] }> = [
    {
      active:
        queryTokens.has("syarat") ||
        queryTokens.has("dokumen") ||
        queryTokens.has("lampiran") ||
        queryTokens.has("kelengkapan"),
      terms: ["syarat", "dokumen", "lampiran", "kelengkapan"],
    },
    {
      active: queryTokens.has("alur") || queryTokens.has("prosedur"),
      terms: ["alur", "prosedur", "tahapan", "langkah"],
    },
    {
      active: queryTokens.has("template"),
      terms: ["template"],
    },
  ];

  for (const filter of detailFilters) {
    if (!filter.active || candidates.length === 0) {
      continue;
    }

    const filteredCandidates = filterDocumentsByTerms(candidates, filter.terms);

    if (filteredCandidates.length > 0) {
      candidates = filteredCandidates;
    }
  }

  const retrievedScoreBySource = new Map(
    retrievedChunks.map((chunk) => [chunk.source, chunk.score])
  );
  const allChunks = getAllKnowledgeChunksSync();

  return candidates
    .map((document, index) => {
      const chunk = pickDocumentChunk(document, query, allChunks);

      return {
        ...chunk,
        score:
          scoreFileDocumentCandidate(
            document,
            nameTokens,
            requestedExtensions,
            retrievedScoreBySource.get(document.source) || 0
          ) - index * 0.001,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getDocumentFileRequestChunks(
  query: string,
  chunks: RetrievedChunk[],
  limit = 4
): RetrievedChunk[] {
  if (!isDocumentFileRequest(query)) {
    return chunks.slice(0, limit);
  }

  return getFileRequestDocumentChunks(query, chunks, limit);
}

export function buildDocumentFileRequestAnswer(
  query: string,
  chunks: RetrievedChunk[]
): string | null {
  if (!isDocumentFileRequest(query)) {
    return null;
  }

  const fileChunks = getDocumentFileRequestChunks(query, chunks);

  if (fileChunks.length === 0) {
    return "Saya belum menemukan file yang cocok dengan permintaan tersebut.";
  }

  return "Berikut file yang sesuai. Silakan klik tombol download di bawah jawaban ini.";
}

export function buildDirectKnowledgeAnswer(
  query: string,
  chunks: RetrievedChunk[],
  allChunks = getAllKnowledgeChunksSync()
): string | null {
  if (isDocumentFileRequest(query)) {
    return null;
  }

  const contactAnswer = buildContactAnswer(query, chunks, allChunks);

  if (contactAnswer) {
    return contactAnswer;
  }

  if (chunks.length === 0) {
    return null;
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
    const flowAnswer = buildNumberedFlowAnswer(query, chunks, allChunks);

    if (flowAnswer) {
      return flowAnswer;
    }
  }

  return null;
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

  const fileRequestAnswer = buildDocumentFileRequestAnswer(query, chunks);

  if (fileRequestAnswer) {
    return fileRequestAnswer;
  }

  const wantsSources = /\b(sumber|referensi)\b/i.test(query);

  if (wantsSources) {
    return (
      "Sumber data tersimpan di knowledge base internal aplikasi dan tidak ditampilkan di halaman. " +
      "Silakan tanyakan isi informasi yang dibutuhkan, seperti alur proposal, syarat LPJ, atau sertifikasi."
    );
  }

  const directKnowledgeAnswer = buildDirectKnowledgeAnswer(query, chunks, allChunks);

  if (directKnowledgeAnswer) {
    return directKnowledgeAnswer;
  }

  const facts = chunks
    .slice(0, 3)
    .map((chunk, index) => `${index + 1}. ${chunk.excerpt}`)
    .join("\n");

  return `Berikut informasi yang saya temukan dari dokumen:\n${facts}`;
}
