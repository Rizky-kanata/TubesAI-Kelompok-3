import type { DownloadableFile } from "../types/Message";

export type KnowledgeExportFormat = "pdf" | "docx" | "xlsx";

export interface KnowledgeExportRequest {
  formats: KnowledgeExportFormat[];
  topic: string;
}

interface GenerateKnowledgeFilesOptions {
  formats: KnowledgeExportFormat[];
  title: string;
  content: string;
}

interface ExportLine {
  text: string;
  number?: number;
}

const formatDefinitions: Record<
  KnowledgeExportFormat,
  { extension: string; label: string; mimeType: string }
> = {
  pdf: {
    extension: "pdf",
    label: "PDF",
    mimeType: "application/pdf",
  },
  docx: {
    extension: "docx",
    label: "Word",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  xlsx: {
    extension: "xlsx",
    label: "Excel",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
};

const exportIntentPattern =
  /\b(buat(?:kan)?|generate|jadikan|susun(?:kan)?|ekspor|export|konversi|ubah(?:kan)?)\b/i;
const outputFormPattern =
  /\bdalam\s+bentuk\s+(?:file\s+)?(?:pdf|word|docx|excel|xlsx|spreadsheet)\b/i;

function getRequestedFormats(prompt: string): KnowledgeExportFormat[] {
  const matches: Array<{ format: KnowledgeExportFormat; index: number }> = [];
  const formatPatterns: Array<{
    format: KnowledgeExportFormat;
    pattern: RegExp;
  }> = [
    { format: "pdf", pattern: /\bpdf\b/gi },
    { format: "docx", pattern: /\b(?:word|docx)\b/gi },
    { format: "xlsx", pattern: /\b(?:excel|xlsx|spreadsheet)\b/gi },
  ];

  for (const { format, pattern } of formatPatterns) {
    for (const match of prompt.matchAll(pattern)) {
      matches.push({ format, index: match.index ?? 0 });
    }
  }

  return matches
    .sort((a, b) => a.index - b.index)
    .map((match) => match.format)
    .filter((format, index, formats) => formats.indexOf(format) === index);
}

function extractExportTopic(prompt: string): string {
  return prompt
    .replace(
      /\b(tolong|mohon|buat(?:kan)?|generate|jadikan|susun(?:kan)?|ekspor|export|konversi|ubah(?:kan)?|menjadi|dalam|bentuk|format|berisi|mengenai|tentang)\b/gi,
      " "
    )
    .replace(/\b(pdf|word|docx|excel|xlsx|spreadsheet)\b/gi, " ")
    .replace(/\b(file|berkas)\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,.:;\s]+|[,.:;\s]+$/g, "")
    .trim();
}

export function getKnowledgeExportRequest(
  prompt: string
): KnowledgeExportRequest | null {
  const formats = getRequestedFormats(prompt);

  if (
    formats.length === 0 ||
    (!exportIntentPattern.test(prompt) && !outputFormPattern.test(prompt))
  ) {
    return null;
  }

  const topic = extractExportTopic(prompt);
  const specificTopic = topic
    .replace(
      /\b(data|dokumen|informasi|isi|dashboard|admin|aktif|yang|ada|di|dari)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  return {
    formats,
    topic: specificTopic ? topic : "",
  };
}

export function getKnowledgeExportFormatLabels(
  formats: KnowledgeExportFormat[]
): string {
  const labels = formats.map((format) => formatDefinitions[format].label);

  if (labels.length <= 1) {
    return labels[0] || "dokumen";
  }

  return `${labels.slice(0, -1).join(", ")} dan ${labels.at(-1)}`;
}

export function buildKnowledgeExportTitle(topic: string): string {
  const normalizedTopic = topic
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  if (!normalizedTopic) {
    return "Data Dokumen";
  }

  return normalizedTopic.replace(/\b\w/g, (character) =>
    character.toUpperCase()
  );
}

function getSafeFileBase(title: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s_-]/gi, " ")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 80) || "data-dokumen"
  );
}

function getExportLines(content: string): ExportLine[] {
  return content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !/^berdasarkan dokumen yang aktif di dashboard admin:?$/i.test(line) &&
        !/^berikut (?:informasi|alurnya|link yang tersedia):?$/i.test(line)
    )
    .map((line) => {
      const numberedLine = line.match(/^(\d+)\.\s+(.+)$/);

      if (!numberedLine) {
        return { text: line };
      }

      return {
        number: Number(numberedLine[1]),
        text: numberedLine[2],
      };
    });
}

function formatExportLine(line: ExportLine, fallbackNumber: number): string {
  return `${line.number ?? fallbackNumber}. ${line.text}`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return `data:${blob.type};base64,${btoa(binary)}`;
}

async function generatePdfData(
  title: string,
  lines: ExportLine[]
): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const document = new jsPDF({ format: "a4", unit: "mm" });
  const margin = 18;
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = 22;

  const addWrappedText = (
    text: string,
    options: { fontSize: number; bold?: boolean; gapAfter?: number }
  ) => {
    document.setFont("helvetica", options.bold ? "bold" : "normal");
    document.setFontSize(options.fontSize);
    const wrappedLines = document.splitTextToSize(text, contentWidth) as string[];
    const lineHeight = options.fontSize * 0.42;

    for (const wrappedLine of wrappedLines) {
      if (y + lineHeight > pageHeight - margin) {
        document.addPage();
        y = 22;
      }

      document.text(wrappedLine, margin, y);
      y += lineHeight;
    }

    y += options.gapAfter ?? 0;
  };

  addWrappedText(title, { bold: true, fontSize: 16, gapAfter: 4 });
  addWrappedText("Sumber data: dokumen aktif Dashboard Admin", {
    fontSize: 9,
    gapAfter: 5,
  });

  lines.forEach((line, index) => {
    addWrappedText(formatExportLine(line, index + 1), {
      fontSize: 11,
      gapAfter: 2,
    });
  });

  return document.output("datauristring");
}

async function generateWordData(
  title: string,
  lines: ExportLine[]
): Promise<string> {
  const {
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    TextRun,
  } = await import("docx");
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            text: title,
          }),
          new Paragraph({
            children: [
              new TextRun({
                color: "666666",
                italics: true,
                text: "Sumber data: dokumen aktif Dashboard Admin",
              }),
            ],
            spacing: { after: 260 },
          }),
          ...lines.map(
            (line, index) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: formatExportLine(line, index + 1),
                  }),
                ],
                spacing: { after: 140 },
              })
          ),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(document);

  return blobToDataUrl(blob);
}

async function generateExcelData(
  title: string,
  lines: ExportLine[]
): Promise<string> {
  const { default: writeExcelFile } = await import(
    "write-excel-file/browser"
  );
  const sheetData = [
    [
      {
        backgroundColor: "#800019",
        columnSpan: 2,
        fontSize: 16,
        fontWeight: "bold" as const,
        textColor: "#FFFFFF",
        value: title,
      },
    ],
    [
      {
        fontWeight: "bold" as const,
        value: "Sumber data",
      },
      {
        value: "Dokumen aktif Dashboard Admin",
      },
    ],
    [null, null],
    [
      {
        backgroundColor: "#EAD2D7",
        fontWeight: "bold" as const,
        value: "No.",
      },
      {
        backgroundColor: "#EAD2D7",
        fontWeight: "bold" as const,
        value: "Informasi",
      },
    ],
    ...lines.map((line, index) => [
      {
        align: "center" as const,
        type: Number,
        value: line.number ?? index + 1,
      },
      {
        value: line.text,
        wrap: true,
      },
    ]),
  ];
  const blob = await writeExcelFile(sheetData, {
    columns: [{ width: 8 }, { width: 80 }],
    sheet: "Data",
    stickyRowsCount: 4,
  }).toBlob();

  return blobToDataUrl(blob);
}

async function generateFileData(
  format: KnowledgeExportFormat,
  title: string,
  lines: ExportLine[]
): Promise<string> {
  if (format === "pdf") {
    return generatePdfData(title, lines);
  }

  if (format === "docx") {
    return generateWordData(title, lines);
  }

  return generateExcelData(title, lines);
}

export async function generateKnowledgeFiles({
  formats,
  title,
  content,
}: GenerateKnowledgeFilesOptions): Promise<DownloadableFile[]> {
  const lines = getExportLines(content);

  if (lines.length === 0) {
    return [];
  }

  const fileBase = getSafeFileBase(title);
  const generatedAt = Date.now();

  return Promise.all(
    formats.map(async (format) => {
      const definition = formatDefinitions[format];

      return {
        id: `generated-${format}-${generatedAt}`,
        title,
        source: "Data dokumen aktif",
        fileName: `${fileBase}.${definition.extension}`,
        fileType: definition.mimeType,
        fileData: await generateFileData(format, title, lines),
      };
    })
  );
}
