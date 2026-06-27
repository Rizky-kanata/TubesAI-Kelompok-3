const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  normalizeExtractedText,
  splitFaqSections,
} = require("./extract-knowledge.cjs");

const faqPath = path.join(
  __dirname,
  "..",
  "documents",
  "FAQ SSC - Revisi.txt"
);

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
