const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createKnowledgeDatasetRevision,
  normalizeExtractedText,
  splitFaqSections,
} = require("./extract-knowledge.cjs");

const faqPath = path.join(
  __dirname,
  "..",
  "documents",
  "FAQ SSC - Revisi.txt"
);

test("revisi dataset deterministik dan berubah saat dokumen berubah", () => {
  const chunks = [
    {
      id: "document-1",
      title: "Document",
      section: "Section",
      source: "document.docx",
      content: "Isi awal",
    },
  ];
  const sourceFiles = [
    {
      source: "document.docx",
      fileName: "document.docx",
      fileType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileUrl: "/knowledge-documents/document.docx",
    },
  ];

  const revision = createKnowledgeDatasetRevision(chunks, sourceFiles);

  assert.equal(
    createKnowledgeDatasetRevision(chunks, sourceFiles),
    revision
  );
  assert.notEqual(
    createKnowledgeDatasetRevision(
      [{ ...chunks[0], content: "Isi diperbarui" }],
      sourceFiles
    ),
    revision
  );
});

test("normalisasi mempertahankan penanda Answer pada setiap FAQ", () => {
  const source = fs.readFileSync(faqPath, "utf8");
  const normalized = normalizeExtractedText(source);
  const questionCount = (normalized.match(/^Question\s*:/gim) || []).length;
  const answerCount = (normalized.match(/^Answer\s*:/gim) || []).length;

  assert.ok(questionCount > 1);
  assert.equal(answerCount, questionCount);
});

test("jawaban alur proposal tersimpan utuh dan tidak tercampur LPJ", () => {
  const source = normalizeExtractedText(fs.readFileSync(faqPath, "utf8"));
  const sections = splitFaqSections(source);
  const proposalSection = sections?.find(
    (section) =>
      section.section ===
      "Bagaimana cara mengajukan proposal pendanaan kegiatan Ormawa/UKM?"
  );

  assert.ok(proposalSection);
  assert.match(
    proposalSection.content,
    /1\. Unduh dan gunakan template proposal resmi/
  );
  assert.match(
    proposalSection.content,
    /6\. Perbaiki proposal apabila terdapat umpan balik/
  );
  assert.doesNotMatch(proposalSection.content, /syarat yang harus dilengkapi dalam LPJ/i);
});
