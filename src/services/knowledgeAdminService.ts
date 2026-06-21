import {
  knowledgeChunks,
  knowledgeSourceFiles,
  type KnowledgeChunk,
} from "../data/knowledgeBase";

const ACTIVE_SOURCES_KEY = "ssc-active-knowledge-sources";
const UPLOADED_DOCUMENTS_KEY = "ssc-uploaded-knowledge-documents";
const STATIC_OVERRIDES_KEY = "ssc-static-knowledge-overrides";
const DELETED_STATIC_SOURCES_KEY = "ssc-deleted-static-knowledge-sources";
const API_BASE_URL =
  import.meta.env.VITE_DOCUMENT_API_URL || "http://localhost:3001/api";

export interface UploadedKnowledgeDocument {
  id: string;
  title: string;
  source: string;
  section: string;
  content: string;
  fileName?: string;
  fileType?: string;
  fileData?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  source: string;
  title: string;
  sections: string[];
  chunkCount: number;
  isActive: boolean;
  isUploaded: boolean;
  content?: string;
  fileName?: string;
  fileType?: string;
  fileData?: string;
  fileUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeDocumentInput {
  title: string;
  source: string;
  content: string;
  section?: string;
  fileName?: string;
  fileType?: string;
  fileData?: string;
  isActive?: boolean;
}

interface StaticKnowledgeOverride {
  source: string;
  title: string;
  section: string;
  content: string;
  updatedAt: string;
}

function canUseStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function readJsonFromStorage<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }

  const rawValue = localStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function writeJsonToStorage<T>(key: string, value: T) {
  if (canUseStorage()) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

function getStaticSources(): string[] {
  return Array.from(new Set(getStaticKnowledgeChunks().map((chunk) => chunk.source)));
}

function normalizeStaticOverride(value: unknown): StaticKnowledgeOverride | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<StaticKnowledgeOverride>;
  const source = String(item.source || "").trim();
  const title = String(item.title || "").trim();
  const content = String(item.content || "").trim();

  if (!source || !title || !content) {
    return null;
  }

  return {
    source,
    title,
    section: String(item.section || "Dokumen Bawaan").trim(),
    content,
    updatedAt: String(item.updatedAt || new Date().toISOString()),
  };
}

function readStaticOverrides(): Map<string, StaticKnowledgeOverride> {
  const overrides = readJsonFromStorage<unknown[]>(STATIC_OVERRIDES_KEY, []);
  return new Map(
    overrides
      .map(normalizeStaticOverride)
      .filter((override): override is StaticKnowledgeOverride =>
        Boolean(override)
      )
      .map((override) => [override.source, override])
  );
}

function writeStaticOverrides(overrides: Map<string, StaticKnowledgeOverride>) {
  writeJsonToStorage(STATIC_OVERRIDES_KEY, [...overrides.values()]);
}

function readDeletedStaticSources(): Set<string> {
  const sources = readJsonFromStorage<unknown[]>(DELETED_STATIC_SOURCES_KEY, []);
  return new Set(
    sources.filter((source): source is string => typeof source === "string")
  );
}

function writeDeletedStaticSources(sources: Set<string>) {
  writeJsonToStorage(DELETED_STATIC_SOURCES_KEY, [...sources]);
}

function normalizeDocument(value: unknown): UploadedKnowledgeDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<UploadedKnowledgeDocument>;
  const title = String(item.title || "").trim();
  const source = String(item.source || "").trim();
  const content = String(item.content || "").trim();

  if (!title || !source || !content) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id: String(item.id || `local-${Date.now()}`),
    title,
    source,
    section: String(item.section || "Dokumen Upload Admin").trim(),
    content,
    fileName: String(item.fileName || "").trim() || undefined,
    fileType: String(item.fileType || "").trim() || undefined,
    fileData: String(item.fileData || "").trim() || undefined,
    isActive: item.isActive !== false,
    createdAt: String(item.createdAt || now),
    updatedAt: String(item.updatedAt || item.createdAt || now),
  };
}

function readUploadedDocumentsCache(): UploadedKnowledgeDocument[] {
  const documents = readJsonFromStorage<unknown[]>(UPLOADED_DOCUMENTS_KEY, []);
  return documents
    .map(normalizeDocument)
    .filter((document): document is UploadedKnowledgeDocument => Boolean(document));
}

function writeUploadedDocumentsCache(documents: UploadedKnowledgeDocument[]) {
  writeJsonToStorage(UPLOADED_DOCUMENTS_KEY, documents);
}

async function requestApi<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.message || response.statusText);
  }

  return response.json() as Promise<T>;
}

export async function fetchUploadedKnowledgeDocuments(): Promise<
  UploadedKnowledgeDocument[]
> {
  try {
    const documents = await requestApi<UploadedKnowledgeDocument[]>(
      "/knowledge-documents"
    );
    const normalizedDocuments = documents
      .map(normalizeDocument)
      .filter((document): document is UploadedKnowledgeDocument =>
        Boolean(document)
      );
    writeUploadedDocumentsCache(normalizedDocuments);
    return normalizedDocuments;
  } catch {
    return readUploadedDocumentsCache();
  }
}

export function getCachedUploadedKnowledgeDocuments(): UploadedKnowledgeDocument[] {
  return readUploadedDocumentsCache();
}

export async function createUploadedKnowledgeDocument(
  input: KnowledgeDocumentInput
): Promise<UploadedKnowledgeDocument> {
  const payload = {
    title: input.title.trim(),
    source: input.source.trim(),
    section: input.section?.trim() || "Dokumen Upload Admin",
    content: input.content.trim(),
    fileName: input.fileName?.trim(),
    fileType: input.fileType?.trim(),
    fileData: input.fileData?.trim(),
    isActive: input.isActive ?? true,
  };

  try {
    const document = await requestApi<UploadedKnowledgeDocument>(
      "/knowledge-documents",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    const documents = [document, ...readUploadedDocumentsCache()].filter(
      (item, index, items) => items.findIndex((match) => match.id === item.id) === index
    );
    writeUploadedDocumentsCache(documents);
    return document;
  } catch {
    const now = new Date().toISOString();
    const document: UploadedKnowledgeDocument = {
      id: `local-${Date.now()}`,
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
    writeUploadedDocumentsCache([document, ...readUploadedDocumentsCache()]);
    return document;
  }
}

export async function updateUploadedKnowledgeDocument(
  documentId: string,
  input: Partial<KnowledgeDocumentInput>
): Promise<UploadedKnowledgeDocument> {
  const currentDocument = readUploadedDocumentsCache().find(
    (document) => document.id === documentId
  );

  const payload = {
    title: input.title?.trim() || currentDocument?.title || "",
    source: input.source?.trim() || currentDocument?.source || "",
    section:
      input.section?.trim() ||
      currentDocument?.section ||
      "Dokumen Upload Admin",
    content: input.content?.trim() || currentDocument?.content || "",
    fileName: input.fileName?.trim() || currentDocument?.fileName,
    fileType: input.fileType?.trim() || currentDocument?.fileType,
    fileData: input.fileData?.trim() || currentDocument?.fileData,
    isActive: input.isActive ?? currentDocument?.isActive ?? true,
  };

  try {
    const document = await requestApi<UploadedKnowledgeDocument>(
      `/knowledge-documents/${encodeURIComponent(documentId)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
    writeUploadedDocumentsCache(
      readUploadedDocumentsCache().map((item) =>
        item.id === documentId ? document : item
      )
    );
    return document;
  } catch {
    if (!currentDocument) {
      throw new Error("Dokumen tidak ditemukan.");
    }

    const document: UploadedKnowledgeDocument = {
      ...currentDocument,
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    writeUploadedDocumentsCache(
      readUploadedDocumentsCache().map((item) =>
        item.id === documentId ? document : item
      )
    );
    return document;
  }
}

export async function deleteUploadedKnowledgeDocument(documentId: string) {
  try {
    await requestApi<{ ok: boolean }>(
      `/knowledge-documents/${encodeURIComponent(documentId)}`,
      { method: "DELETE" }
    );
  } finally {
    writeUploadedDocumentsCache(
      readUploadedDocumentsCache().filter((document) => document.id !== documentId)
    );
  }
}

export function updateStaticKnowledgeDocument(
  source: string,
  input: Partial<KnowledgeDocumentInput>
) {
  const groupedChunks = groupStaticChunks();
  const currentChunks = groupedChunks.get(source);

  if (!currentChunks?.length) {
    throw new Error("Dokumen bawaan tidak ditemukan.");
  }

  const overrides = readStaticOverrides();
  const currentOverride = overrides.get(source);
  const firstChunk = currentChunks[0];
  const nextOverride: StaticKnowledgeOverride = {
    source,
    title:
      input.title?.trim() ||
      currentOverride?.title ||
      firstChunk.title,
    section:
      input.section?.trim() ||
      currentOverride?.section ||
      firstChunk.section,
    content:
      input.content?.trim() ||
      currentOverride?.content ||
      buildStaticDocumentContent(currentChunks),
    updatedAt: new Date().toISOString(),
  };

  overrides.set(source, nextOverride);
  writeStaticOverrides(overrides);
}

export function deleteStaticKnowledgeDocument(source: string) {
  const deletedSources = readDeletedStaticSources();
  deletedSources.add(source);
  writeDeletedStaticSources(deletedSources);

  const overrides = readStaticOverrides();
  overrides.delete(source);
  writeStaticOverrides(overrides);

  const activeSources = readStoredActiveSources();
  if (activeSources) {
    writeJsonToStorage(
      ACTIVE_SOURCES_KEY,
      activeSources.filter((activeSource) => activeSource !== source)
    );
  }
}

function readStoredActiveSources(): string[] | null {
  const rawSources = readJsonFromStorage<unknown>(ACTIVE_SOURCES_KEY, null);

  if (!Array.isArray(rawSources)) {
    return null;
  }

  return rawSources.filter((source): source is string => typeof source === "string");
}

function getAllSources(): string[] {
  return Array.from(
    new Set([
      ...getStaticSources(),
      ...readUploadedDocumentsCache().map((document) => document.source),
    ])
  );
}

export function getActiveKnowledgeSources(): string[] {
  const allSources = getAllSources();
  const storedSources = readStoredActiveSources();
  const activeUploadedSources = readUploadedDocumentsCache()
    .filter((document) => document.isActive)
    .map((document) => document.source);

  if (!storedSources) {
    return allSources;
  }

  const activeSources = [
    ...new Set([
      ...storedSources.filter((source) => allSources.includes(source)),
      ...activeUploadedSources.filter((source) => allSources.includes(source)),
    ]),
  ];

  return activeSources.length > 0 ? activeSources : allSources;
}

export function setKnowledgeSourceActive(source: string, isActive: boolean) {
  const allSources = getAllSources();
  const activeSources = new Set(getActiveKnowledgeSources());

  if (isActive) {
    activeSources.add(source);
  } else if (activeSources.size > 1) {
    activeSources.delete(source);
  }

  const nextSources = allSources.filter((item) => activeSources.has(item));
  writeJsonToStorage(ACTIVE_SOURCES_KEY, nextSources);
}

export function resetActiveKnowledgeSources() {
  if (canUseStorage()) {
    localStorage.removeItem(ACTIVE_SOURCES_KEY);
  }
}

function chunkFaqDocumentContent(document: {
  id: string;
  title: string;
  section: string;
  source: string;
  content: string;
}): KnowledgeChunk[] | null {
  const normalizedContent = document.content
    .replace(/\r\n?/g, "\n")
    .trim();
  const questionPattern = /^Question\s*:\s*(.+)$/gim;
  const matches = [...normalizedContent.matchAll(questionPattern)];

  if (matches.length < 2) {
    return null;
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? normalizedContent.length;
    const question = match[1].trim();
    const content = normalizedContent
      .slice(start, end)
      .replace(/\n={5,}\s*\n[^\n]+\n={5,}\s*$/g, "")
      .trim();

    return {
      id: `${document.id}-faq-${index + 1}`,
      title: document.title,
      section: `${document.section} - ${question}`.slice(0, 180),
      source: document.source,
      content,
    };
  });
}

function chunkDocumentContent(document: {
  id: string;
  title: string;
  section: string;
  source: string;
  content: string;
}): KnowledgeChunk[] {
  const faqChunks = chunkFaqDocumentContent(document);

  if (faqChunks) {
    return faqChunks;
  }

  const paragraphs = document.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs.length ? paragraphs : [document.content]) {
    const nextChunk = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;

    if (nextChunk.length > 1200 && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      currentChunk = nextChunk;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.map((content, index) => ({
    id: `${document.id}-chunk-${index + 1}`,
    title: document.title,
    section:
      chunks.length > 1
        ? `${document.section} ${index + 1}`
        : document.section,
    source: document.source,
    content,
  }));
}

function chunkUploadedDocument(document: UploadedKnowledgeDocument): KnowledgeChunk[] {
  if (!document.isActive) {
    return [];
  }

  return chunkDocumentContent(document);
}

function groupStaticChunks(): Map<string, KnowledgeChunk[]> {
  const deletedSources = readDeletedStaticSources();
  const groupedChunks = new Map<string, KnowledgeChunk[]>();

  for (const chunk of knowledgeChunks) {
    if (deletedSources.has(chunk.source)) {
      continue;
    }

    const chunks = groupedChunks.get(chunk.source) || [];
    chunks.push(chunk);
    groupedChunks.set(chunk.source, chunks);
  }

  return groupedChunks;
}

function getStaticSourceFile(source: string) {
  return knowledgeSourceFiles.find((file) => file.source === source);
}

function buildStaticDocumentContent(chunks: KnowledgeChunk[]): string {
  return chunks
    .map((chunk) => chunk.content.trim())
    .filter(Boolean)
    .filter((content, index, contents) => contents.indexOf(content) === index)
    .join("\n\n");
}

export function getStaticKnowledgeChunks(): KnowledgeChunk[] {
  const groupedChunks = groupStaticChunks();
  const overrides = readStaticOverrides();
  const chunks: KnowledgeChunk[] = [];

  for (const [source, sourceChunks] of groupedChunks) {
    const override = overrides.get(source);

    if (override) {
      chunks.push(
        ...chunkDocumentContent({
          id: `static-${source}`,
          source,
          title: override.title,
          section: override.section,
          content: override.content,
        })
      );
      continue;
    }

    chunks.push(...sourceChunks);
  }

  return chunks;
}

export function getCachedUploadedKnowledgeChunks(): KnowledgeChunk[] {
  return readUploadedDocumentsCache().flatMap(chunkUploadedDocument);
}

export async function getAllKnowledgeChunks(): Promise<KnowledgeChunk[]> {
  const uploadedDocuments = await fetchUploadedKnowledgeDocuments();
  return [
    ...getStaticKnowledgeChunks(),
    ...uploadedDocuments.flatMap(chunkUploadedDocument),
  ];
}

export function getAllKnowledgeChunksSync(): KnowledgeChunk[] {
  return [...getStaticKnowledgeChunks(), ...getCachedUploadedKnowledgeChunks()];
}

export function getKnowledgeDocuments(): KnowledgeDocument[] {
  const activeSources = new Set(getActiveKnowledgeSources());
  const documents = new Map<string, KnowledgeDocument>();
  const groupedStaticChunks = groupStaticChunks();
  const overrides = readStaticOverrides();

  for (const [source, chunks] of groupedStaticChunks) {
    const override = overrides.get(source);
    const sourceFile = getStaticSourceFile(source);
    const content = override?.content || buildStaticDocumentContent(chunks);
    const displayChunks = override
      ? chunkDocumentContent({
          id: `static-${source}`,
          source,
          title: override.title,
          section: override.section,
          content,
        })
      : chunks;

    documents.set(source, {
      id: source,
      source,
      title: override?.title || chunks[0].title,
      sections: override
        ? [override.section]
        : Array.from(new Set(chunks.map((chunk) => chunk.section))),
      chunkCount: displayChunks.length,
      isActive: activeSources.has(source),
      isUploaded: false,
      content,
      fileName: sourceFile?.fileName,
      fileType: sourceFile?.fileType,
      fileUrl: sourceFile?.fileUrl,
      updatedAt: override?.updatedAt,
    });
  }

  for (const document of readUploadedDocumentsCache()) {
    const chunks = chunkUploadedDocument(document);
    documents.set(document.id, {
      id: document.id,
      source: document.source,
      title: document.title,
      sections: [document.section],
      chunkCount: chunks.length || 1,
      isActive: document.isActive,
      isUploaded: true,
      content: document.content,
      fileName: document.fileName,
      fileType: document.fileType,
      fileData: document.fileData,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  }

  return Array.from(documents.values()).sort((a, b) =>
    Number(b.isUploaded) - Number(a.isUploaded) ||
    a.source.localeCompare(b.source)
  );
}

export async function loadKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  await fetchUploadedKnowledgeDocuments();
  return getKnowledgeDocuments();
}

export function getKnowledgeSummary() {
  const documents = getKnowledgeDocuments();
  const activeDocuments = documents.filter((document) => document.isActive);
  const staticChunks = getStaticKnowledgeChunks();
  const uploadedChunks = getCachedUploadedKnowledgeChunks();
  const activeChunkCount = getAllKnowledgeChunksSync().filter((chunk) =>
    activeDocuments.some((document) => document.source === chunk.source)
  ).length;

  return {
    totalDocuments: documents.length,
    activeDocuments: activeDocuments.length,
    totalChunks: staticChunks.length + uploadedChunks.length,
    activeChunks: activeChunkCount,
  };
}
