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
