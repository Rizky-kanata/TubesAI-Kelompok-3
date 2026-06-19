import { knowledgeChunks, knowledgeSourceCount } from "../data/knowledgeBase";

const ACTIVE_SOURCES_KEY = "ssc-active-knowledge-sources";

export interface KnowledgeDocument {
  source: string;
  title: string;
  sections: string[];
  chunkCount: number;
  isActive: boolean;
}

function getAllSources(): string[] {
  return Array.from(new Set(knowledgeChunks.map((chunk) => chunk.source)));
}

function readStoredActiveSources(): string[] | null {
  const rawValue = localStorage.getItem(ACTIVE_SOURCES_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : null;
  } catch {
    return null;
  }
}

export function getActiveKnowledgeSources(): string[] {
  const allSources = getAllSources();
  const storedSources = readStoredActiveSources();

  if (!storedSources) {
    return allSources;
  }

  const activeSources = storedSources.filter((source) =>
    allSources.includes(source)
  );

  return activeSources.length > 0 ? activeSources : allSources;
}

export function isKnowledgeSourceActive(source: string): boolean {
  return getActiveKnowledgeSources().includes(source);
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
  localStorage.setItem(ACTIVE_SOURCES_KEY, JSON.stringify(nextSources));
}

export function resetActiveKnowledgeSources() {
  localStorage.removeItem(ACTIVE_SOURCES_KEY);
}

export function getKnowledgeDocuments(): KnowledgeDocument[] {
  const activeSources = new Set(getActiveKnowledgeSources());
  const documents = new Map<string, KnowledgeDocument>();

  for (const chunk of knowledgeChunks) {
    const current = documents.get(chunk.source);

    if (!current) {
      documents.set(chunk.source, {
        source: chunk.source,
        title: chunk.title,
        sections: [chunk.section],
        chunkCount: 1,
        isActive: activeSources.has(chunk.source),
      });
      continue;
    }

    current.chunkCount += 1;

    if (!current.sections.includes(chunk.section)) {
      current.sections.push(chunk.section);
    }
  }

  return Array.from(documents.values()).sort((a, b) =>
    a.source.localeCompare(b.source)
  );
}

export function getKnowledgeSummary() {
  const documents = getKnowledgeDocuments();
  const activeDocuments = documents.filter((document) => document.isActive);
  const activeChunkCount = knowledgeChunks.filter((chunk) =>
    activeDocuments.some((document) => document.source === chunk.source)
  ).length;

  return {
    totalDocuments: knowledgeSourceCount,
    activeDocuments: activeDocuments.length,
    totalChunks: knowledgeChunks.length,
    activeChunks: activeChunkCount,
  };
}

