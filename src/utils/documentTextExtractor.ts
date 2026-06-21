export const SUPPORTED_DOCUMENT_ACCEPT =
  ".txt,.md,.csv,.json,.docx,.pdf,.xlsx,.xlsm,.xls";

type ZipEntryMap = Map<string, Uint8Array>;

function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function readUint16(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readUint32(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

function decodeText(data: Uint8Array, encoding = "utf-8"): string {
  return new TextDecoder(encoding).decode(data);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
}

async function inflate(
  data: Uint8Array,
  format: "deflate" | "deflate-raw"
): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Browser belum mendukung ekstraksi dokumen otomatis.");
  }

  const stream = new Blob([toArrayBuffer(data)])
    .stream()
    .pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateZipEntry(data: Uint8Array): Promise<Uint8Array> {
  return inflate(data, "deflate-raw");
}

async function inflatePdfStream(data: Uint8Array): Promise<Uint8Array> {
  try {
    return await inflate(data, "deflate");
  } catch {
    return inflate(data, "deflate-raw");
  }
}

async function readZipEntries(data: Uint8Array): Promise<ZipEntryMap> {
  let endDirectoryOffset = -1;

  for (let offset = data.length - 22; offset >= 0; offset -= 1) {
    if (readUint32(data, offset) === 0x06054b50) {
      endDirectoryOffset = offset;
      break;
    }
  }

  if (endDirectoryOffset === -1) {
    throw new Error("Format dokumen tidak valid.");
  }

  const entryCount = readUint16(data, endDirectoryOffset + 10);
  let directoryOffset = readUint32(data, endDirectoryOffset + 16);
  const entries: ZipEntryMap = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(data, directoryOffset) !== 0x02014b50) {
      break;
    }

    const compressionMethod = readUint16(data, directoryOffset + 10);
    const compressedSize = readUint32(data, directoryOffset + 20);
    const fileNameLength = readUint16(data, directoryOffset + 28);
    const extraLength = readUint16(data, directoryOffset + 30);
    const commentLength = readUint16(data, directoryOffset + 32);
    const localHeaderOffset = readUint32(data, directoryOffset + 42);
    const fileName = decodeText(
      data.slice(directoryOffset + 46, directoryOffset + 46 + fileNameLength)
    );

    const localFileNameLength = readUint16(data, localHeaderOffset + 26);
    const localExtraLength = readUint16(data, localHeaderOffset + 28);
    const dataStart =
      localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = data.slice(dataStart, dataStart + compressedSize);

    if (compressionMethod === 0) {
      entries.set(fileName, compressedData);
    } else if (compressionMethod === 8) {
      entries.set(fileName, await inflateZipEntry(compressedData));
    }

    directoryOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function getZipEntry(entries: ZipEntryMap, fileName: string): Uint8Array {
  const entry = entries.get(fileName);

  if (!entry) {
    throw new Error("Isi dokumen tidak ditemukan.");
  }

  return entry;
}

function parseXml(xmlText: string, errorMessage: string): Document {
  const documentXml = new DOMParser().parseFromString(
    xmlText,
    "application/xml"
  );

  if (documentXml.getElementsByTagName("parsererror").length > 0) {
    throw new Error(errorMessage);
  }

  return documentXml;
}

function getElementsByLocalName(parent: ParentNode, localName: string): Element[] {
  return Array.from(parent.querySelectorAll("*")).filter(
    (element) => element.localName === localName
  );
}

function getTextByLocalName(parent: ParentNode, localName: string): string {
  return getElementsByLocalName(parent, localName)
    .map((element) => element.textContent || "")
    .join("");
}

function getDirectTextByLocalName(parent: ParentNode, localName: string): string {
  return getElementsByLocalName(parent, localName)
    .map((element) => element.textContent || "")
    .join("");
}

async function extractDocxText(file: File): Promise<string> {
  const entries = await readZipEntries(new Uint8Array(await file.arrayBuffer()));
  const documentXml = decodeText(getZipEntry(entries, "word/document.xml"));
  const xmlDocument = parseXml(documentXml, "Format DOCX tidak valid.");
  const paragraphs = getElementsByLocalName(xmlDocument, "p");
  const lines = paragraphs
    .map((paragraph) =>
      getElementsByLocalName(paragraph, "t")
        .map((node) => node.textContent || "")
        .join("")
        .trim()
    )
    .filter(Boolean);

  return lines.join("\n");
}

function readSharedStrings(entries: ZipEntryMap): string[] {
  const sharedStringsEntry = entries.get("xl/sharedStrings.xml");

  if (!sharedStringsEntry) {
    return [];
  }

  const xmlDocument = parseXml(
    decodeText(sharedStringsEntry),
    "Format shared string Excel tidak valid."
  );

  return getElementsByLocalName(xmlDocument, "si").map((item) =>
    getElementsByLocalName(item, "t")
      .map((node) => node.textContent || "")
      .join("")
      .trim()
  );
}

function resolveWorkbookTarget(target: string): string {
  const normalizedTarget = target.replace(/^\/+/, "");
  const targetPath = normalizedTarget.startsWith("xl/")
    ? normalizedTarget
    : `xl/${normalizedTarget}`;
  const pathParts: string[] = [];

  for (const part of targetPath.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      pathParts.pop();
      continue;
    }

    pathParts.push(part);
  }

  return pathParts.join("/");
}

function readWorkbookSheets(entries: ZipEntryMap) {
  const workbookEntry = entries.get("xl/workbook.xml");
  const relationshipsEntry = entries.get("xl/_rels/workbook.xml.rels");

  if (!workbookEntry || !relationshipsEntry) {
    return Array.from(entries.keys())
      .filter((entryName) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entryName))
      .sort()
      .map((path, index) => ({
        name: `Sheet ${index + 1}`,
        path,
      }));
  }

  const workbookXml = parseXml(
    decodeText(workbookEntry),
    "Format workbook Excel tidak valid."
  );
  const relationshipsXml = parseXml(
    decodeText(relationshipsEntry),
    "Format relasi Excel tidak valid."
  );
  const targets = new Map(
    getElementsByLocalName(relationshipsXml, "Relationship").map((item) => [
      item.getAttribute("Id") || "",
      resolveWorkbookTarget(item.getAttribute("Target") || ""),
    ])
  );

  return getElementsByLocalName(workbookXml, "sheet")
    .map((sheet, index) => {
      const relationshipId = sheet.getAttribute("r:id") || "";
      return {
        name: sheet.getAttribute("name") || `Sheet ${index + 1}`,
        path: targets.get(relationshipId) || "",
      };
    })
    .filter((sheet) => sheet.path && entries.has(sheet.path));
}

function readExcelCellValue(cell: Element, sharedStrings: string[]): string {
  const type = cell.getAttribute("t");

  if (type === "inlineStr") {
    return getTextByLocalName(cell, "t").trim();
  }

  const rawValue = getDirectTextByLocalName(cell, "v").trim();

  if (!rawValue) {
    return "";
  }

  if (type === "s") {
    return sharedStrings[Number(rawValue)] || "";
  }

  if (type === "b") {
    return rawValue === "1" ? "TRUE" : "FALSE";
  }

  return rawValue;
}

async function extractXlsxText(file: File): Promise<string> {
  const entries = await readZipEntries(new Uint8Array(await file.arrayBuffer()));
  const sharedStrings = readSharedStrings(entries);
  const sheets = readWorkbookSheets(entries);
  const sheetTexts = sheets
    .map((sheet) => {
      const sheetXml = parseXml(
        decodeText(getZipEntry(entries, sheet.path)),
        "Format worksheet Excel tidak valid."
      );
      const rows = getElementsByLocalName(sheetXml, "row")
        .map((row) =>
          getElementsByLocalName(row, "c")
            .map((cell) => readExcelCellValue(cell, sharedStrings))
            .filter(Boolean)
            .join("\t")
        )
        .filter(Boolean);

      if (!rows.length) {
        return "";
      }

      return [`Sheet: ${sheet.name}`, ...rows].join("\n");
    })
    .filter(Boolean);

  return sheetTexts.join("\n\n");
}

function decodeUtf16Be(bytes: Uint8Array): string {
  let output = "";

  for (let index = 0; index + 1 < bytes.length; index += 2) {
    output += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
  }

  return output;
}

function decodePdfStringBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUtf16Be(bytes.slice(2));
  }

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.slice(2));
  }

  const likelyUtf16Be =
    bytes.length > 3 &&
    bytes.length % 2 === 0 &&
    bytes.filter((_, index) => index % 2 === 0 && bytes[index] === 0).length >=
      bytes.length / 4;

  if (likelyUtf16Be) {
    return decodeUtf16Be(bytes);
  }

  return decodeText(bytes, "windows-1252");
}

function decodePdfStringValue(value: string): string {
  const bytes = new Uint8Array(
    Array.from(value).map((character) => character.charCodeAt(0) & 0xff)
  );
  return decodePdfStringBytes(bytes);
}

function readPdfLiteralString(
  text: string,
  startIndex: number
): { value: string; endIndex: number } | null {
  if (text[startIndex] !== "(") {
    return null;
  }

  let result = "";
  let index = startIndex + 1;
  let depth = 1;

  while (index < text.length) {
    const character = text[index];

    if (character === "\\") {
      const nextCharacter = text[index + 1] || "";

      if (/\r|\n/.test(nextCharacter)) {
        index += nextCharacter === "\r" && text[index + 2] === "\n" ? 3 : 2;
        continue;
      }

      if (/[0-7]/.test(nextCharacter)) {
        const octal = text.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0];
        result += String.fromCharCode(parseInt(octal || "0", 8));
        index += 1 + (octal?.length || 1);
        continue;
      }

      const escapedCharacters: Record<string, string> = {
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
        "(": "(",
        ")": ")",
        "\\": "\\",
      };
      result += escapedCharacters[nextCharacter] ?? nextCharacter;
      index += 2;
      continue;
    }

    if (character === "(") {
      depth += 1;
      result += character;
      index += 1;
      continue;
    }

    if (character === ")") {
      depth -= 1;

      if (depth === 0) {
        return {
          value: decodePdfStringValue(result),
          endIndex: index + 1,
        };
      }

      result += character;
      index += 1;
      continue;
    }

    result += character;
    index += 1;
  }

  return null;
}

function readPdfHexString(
  text: string,
  startIndex: number
): { value: string; endIndex: number } | null {
  if (text[startIndex] !== "<" || text[startIndex + 1] === "<") {
    return null;
  }

  const endIndex = text.indexOf(">", startIndex + 1);

  if (endIndex === -1) {
    return null;
  }

  let hex = text.slice(startIndex + 1, endIndex).replace(/\s+/g, "");

  if (!hex || !/^[\da-f]+$/i.test(hex)) {
    return null;
  }

  if (hex.length % 2 === 1) {
    hex += "0";
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = parseInt(hex.slice(index, index + 2), 16);
  }

  return {
    value: decodePdfStringBytes(bytes),
    endIndex: endIndex + 1,
  };
}

function readPdfStringToken(
  text: string,
  startIndex: number
): { value: string; endIndex: number } | null {
  return (
    readPdfLiteralString(text, startIndex) ||
    readPdfHexString(text, startIndex)
  );
}

function skipWhitespace(text: string, startIndex: number): number {
  let index = startIndex;

  while (index < text.length && /\s/.test(text[index])) {
    index += 1;
  }

  return index;
}

function getNextTextOperator(text: string, startIndex: number): string | null {
  const index = skipWhitespace(text, startIndex);

  for (const operator of ["Tj", "TJ", "'", '"']) {
    if (text.startsWith(operator, index)) {
      return operator;
    }
  }

  return null;
}

function findPdfArrayEnd(text: string, startIndex: number): number {
  let index = startIndex + 1;

  while (index < text.length) {
    const token = readPdfStringToken(text, index);

    if (token) {
      index = token.endIndex;
      continue;
    }

    if (text[index] === "]") {
      return index;
    }

    index += 1;
  }

  return -1;
}

function readTextTokensFromPdfArray(text: string): string[] {
  const tokens: string[] = [];
  let index = 0;

  while (index < text.length) {
    const token = readPdfStringToken(text, index);

    if (token) {
      tokens.push(token.value);
      index = token.endIndex;
      continue;
    }

    index += 1;
  }

  return tokens;
}

function appendPdfTextValue(values: string[], value: string) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (normalizedValue) {
    values.push(normalizedValue);
  }
}

function readPdfBlockText(block: string): string {
  const segments: Array<{ index: number; value: string }> = [];
  let index = 0;

  while (index < block.length) {
    if (block[index] === "[") {
      const endIndex = findPdfArrayEnd(block, index);

      if (endIndex !== -1 && getNextTextOperator(block, endIndex + 1) === "TJ") {
        segments.push({
          index,
          value: readTextTokensFromPdfArray(block.slice(index + 1, endIndex))
            .join(" ")
            .trim(),
        });
        index = endIndex + 1;
        continue;
      }
    }

    const token = readPdfStringToken(block, index);

    if (token) {
      const operator = getNextTextOperator(block, token.endIndex);

      if (operator === "Tj" || operator === "'" || operator === '"') {
        segments.push({
          index,
          value: token.value,
        });
      }

      index = token.endIndex;
      continue;
    }

    index += 1;
  }

  const values: string[] = [];

  for (const segment of segments.sort((a, b) => a.index - b.index)) {
    appendPdfTextValue(values, segment.value);
  }

  return values.join(" ");
}

function extractPdfUrls(text: string): string[] {
  const urls = new Set<string>();
  const urlMatches = text.match(/https?:\/\/[^\s<>()\]{}"']+/gi) || [];

  for (const url of urlMatches) {
    urls.add(url.replace(/[.,;:!?]+$/, ""));
  }

  let uriIndex = text.indexOf("/URI");

  while (uriIndex !== -1) {
    const tokenStart = skipWhitespace(text, uriIndex + 4);
    const token = readPdfStringToken(text, tokenStart);

    if (token && /^https?:\/\//i.test(token.value)) {
      urls.add(token.value);
    }

    uriIndex = text.indexOf("/URI", uriIndex + 4);
  }

  return Array.from(urls);
}

function extractTextFromPdfContentStream(streamText: string): string {
  const blocks = streamText.match(/BT\b[\s\S]*?\bET/g) || [];
  const lines = blocks
    .map((block) => readPdfBlockText(block))
    .filter(Boolean);

  return lines.join("\n");
}

function getPdfStreamStart(text: string, streamIndex: number): number {
  let startIndex = streamIndex + "stream".length;

  if (text[startIndex] === "\r" && text[startIndex + 1] === "\n") {
    startIndex += 2;
  } else if (text[startIndex] === "\n" || text[startIndex] === "\r") {
    startIndex += 1;
  }

  return startIndex;
}

function getPdfStreamEnd(
  text: string,
  dictionaryText: string,
  streamStart: number
): number {
  const length = dictionaryText.match(/\/Length\s+(\d+)/)?.[1];

  if (length) {
    return streamStart + Number(length);
  }

  const endStreamIndex = text.indexOf("endstream", streamStart);
  return endStreamIndex === -1 ? streamStart : endStreamIndex;
}

async function readPdfStreams(data: Uint8Array, pdfText: string): Promise<string[]> {
  const streams: string[] = [];
  let streamIndex = findNextPdfStreamIndex(pdfText, 0);

  while (streamIndex !== -1) {
    const dictionaryStart = pdfText.lastIndexOf("<<", streamIndex);
    const dictionaryEnd = pdfText.lastIndexOf(">>", streamIndex);

    if (dictionaryStart !== -1 && dictionaryEnd > dictionaryStart) {
      const dictionaryText = pdfText.slice(dictionaryStart, dictionaryEnd + 2);
      const streamStart = getPdfStreamStart(pdfText, streamIndex);
      const streamEnd = getPdfStreamEnd(pdfText, dictionaryText, streamStart);
      const streamData = data.slice(streamStart, streamEnd);

      if (/\/FlateDecode\b/.test(dictionaryText)) {
        try {
          streams.push(decodeText(await inflatePdfStream(streamData), "windows-1252"));
        } catch {
          // Ignore streams that are not text or use unsupported filters.
        }
      } else if (!/\/(DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|Crypt)\b/.test(dictionaryText)) {
        streams.push(decodeText(streamData, "windows-1252"));
      }
    }

    streamIndex = findNextPdfStreamIndex(pdfText, streamIndex + 6);
  }

  return streams;
}

function findNextPdfStreamIndex(text: string, startIndex: number): number {
  let index = text.indexOf("stream", startIndex);

  while (index !== -1) {
    const previousCharacter = text[index - 1] || "";
    const nextCharacter = text[index + 6] || "";

    if (!/[A-Za-z]/.test(previousCharacter) && !/[A-Za-z]/.test(nextCharacter)) {
      return index;
    }

    index = text.indexOf("stream", index + 6);
  }

  return -1;
}

function normalizeExtractedText(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .join("\n");
}

async function extractPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdfText = decodeText(data, "windows-1252");
  const streamTexts = await readPdfStreams(data, pdfText);
  const extractedText = normalizeExtractedText(
    [
      ...extractPdfUrls(pdfText),
      ...streamTexts.flatMap((streamText) => [
        ...extractPdfUrls(streamText),
        extractTextFromPdfContentStream(streamText),
      ]),
    ].join("\n")
  );

  if (!extractedText) {
    throw new Error(
      "PDF tidak berisi teks yang dapat diekstrak. Jika PDF berupa scan gambar, salin isi dokumen ke kolom isi dokumen."
    );
  }

  return extractedText;
}

export async function extractDocumentText(file: File): Promise<string> {
  const fileExtension = getFileExtension(file.name);

  if (fileExtension === "docx") {
    return extractDocxText(file);
  }

  if (fileExtension === "pdf") {
    return extractPdfText(file);
  }

  if (fileExtension === "xlsx" || fileExtension === "xlsm") {
    return extractXlsxText(file);
  }

  if (fileExtension === "xls") {
    throw new Error(
      "Format Excel lama .xls belum didukung. Simpan ulang sebagai .xlsx atau .csv, lalu upload kembali."
    );
  }

  if (["txt", "md", "csv", "json"].includes(fileExtension)) {
    return file.text();
  }

  throw new Error(
    "Format dokumen belum didukung. Gunakan TXT, MD, CSV, JSON, DOCX, PDF, atau XLSX."
  );
}
