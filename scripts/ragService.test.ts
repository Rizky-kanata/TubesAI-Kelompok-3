import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKnowledgeExportTitle,
  generateKnowledgeFiles,
  getKnowledgeExportRequest,
} from "../src/services/knowledgeExportService";
import {
  buildLocalFallbackAnswer,
  retrieveRelevantChunks,
} from "../src/services/ragService";
import {
  getActiveKnowledgeSources,
  resetActiveKnowledgeSources,
  setKnowledgeSourceActive,
} from "../src/services/knowledgeAdminService";

test("ekspor alur proposal memilih jawaban FAQ proposal yang lengkap", async () => {
  const prompt =
    "buatkan file pdf berisi alur cara mengajukan proposal pendanaan kegiatan";
  const exportRequest = getKnowledgeExportRequest(prompt);

  assert.ok(exportRequest);
  assert.equal(
    exportRequest.topic,
    "alur cara mengajukan proposal pendanaan kegiatan"
  );

  const chunks = await retrieveRelevantChunks(exportRequest.topic);
  const answer = buildLocalFallbackAnswer(exportRequest.topic, chunks);

  assert.equal(
    chunks[0]?.section,
    "Bagaimana cara mengajukan proposal pendanaan kegiatan Ormawa/UKM?"
  );
  assert.match(
    answer,
    /1\. Unduh dan gunakan template proposal resmi yang disediakan oleh Bagian Kemahasiswaan\./
  );
  assert.match(
    answer,
    /6\. Perbaiki proposal apabila terdapat umpan balik dari Bagian Kemahasiswaan\./
  );
  assert.doesNotMatch(answer, /syarat yang harus dilengkapi dalam LPJ/i);
});

test("alur proposal dapat diekspor menjadi PDF, Word, dan Excel valid", async () => {
  const query = "alur cara mengajukan proposal pendanaan kegiatan";
  const chunks = await retrieveRelevantChunks(query);
  const content = buildLocalFallbackAnswer(query, chunks);
  const files = await generateKnowledgeFiles({
    formats: ["pdf", "docx", "xlsx"],
    title: buildKnowledgeExportTitle(query),
    content,
  });
  const signatures = files.map((file) => {
    const base64 = file.fileData?.split(",")[1] || "";
    return Buffer.from(base64, "base64").subarray(0, 5).toString();
  });

  assert.deepEqual(
    files.map((file) => file.fileName.split(".").at(-1)),
    ["pdf", "docx", "xlsx"]
  );
  assert.equal(signatures[0], "%PDF-");
  assert.match(signatures[1], /^PK/);
  assert.match(signatures[2], /^PK/);
});

test("satu-satunya dokumen aktif dapat dinonaktifkan", () => {
  const values = new Map<string, string>();
  const localStorageMock: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage"
  );

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });

  try {
    resetActiveKnowledgeSources();
    const [onlySource] = getActiveKnowledgeSources();

    assert.ok(onlySource);
    localStorageMock.setItem(
      "ssc-active-knowledge-sources",
      JSON.stringify([onlySource])
    );
    setKnowledgeSourceActive(onlySource, false);
    assert.deepEqual(getActiveKnowledgeSources(), []);
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "localStorage", originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "localStorage");
    }
  }
});
