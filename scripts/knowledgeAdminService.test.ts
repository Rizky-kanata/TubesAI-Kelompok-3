import assert from "node:assert/strict";
import test from "node:test";
import { knowledgeDatasetRevision } from "../src/data/knowledgeBase";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("dokumen yang ditambahkan lagi tidak disembunyikan tanda hapus lama", async () => {
  const storage = new MemoryStorage();
  const deletedSourcesKey = "ssc-deleted-static-knowledge-sources";
  storage.setItem(
    deletedSourcesKey,
    JSON.stringify(["Syarat Pengajuan Proposal Dana Kegiatan.docx"])
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

  try {
    const { getKnowledgeDocuments } = await import(
      "../src/services/knowledgeAdminService"
    );
    const documents = getKnowledgeDocuments();
    const storedState = JSON.parse(storage.getItem(deletedSourcesKey) || "{}");

    assert.ok(
      documents.some(
        (document) =>
          document.source ===
          "Syarat Pengajuan Proposal Dana Kegiatan.docx"
      )
    );
    assert.deepEqual(storedState, {
      datasetRevision: knowledgeDatasetRevision,
      sources: [],
    });
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("sumber aktif terakhir dapat dinonaktifkan", async () => {
  const storage = new MemoryStorage();
  const activeSourcesKey = "ssc-active-knowledge-sources";
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

  try {
    const {
      getActiveKnowledgeSources,
      getKnowledgeDocuments,
      setKnowledgeSourceActive,
    } = await import("../src/services/knowledgeAdminService");
    const [document] = getKnowledgeDocuments();

    assert.ok(document);
    storage.setItem(activeSourcesKey, JSON.stringify([document.source]));

    setKnowledgeSourceActive(document.source, false);

    assert.deepEqual(getActiveKnowledgeSources(), []);
    assert.equal(
      getKnowledgeDocuments().find((item) => item.id === document.id)?.isActive,
      false
    );
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
  }
});
