export const SUPPORTED_DOCUMENT_ACCEPT =
  ".txt,.md,.csv,.json,.doc,.docx,.pdf,.xlsx,.xlsm,.xls";

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

function isOleCompoundDocument(data: Uint8Array): boolean {
  const oleMagic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return oleMagic.every((byte, index) => data[index] === byte);
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

function decodeAscii85(data: Uint8Array): Uint8Array {
  const bytes: number[] = [];
  const group: number[] = [];

  for (let index = 0; index < data.length; index += 1) {
    const byte = data[index];
    const character = String.fromCharCode(byte);

    if (/\s/.test(character)) {
      continue;
    }

    if (
      character === "<" &&
      String.fromCharCode(data[index + 1] || 0) === "~" &&
      group.length === 0
    ) {
      index += 1;
      continue;
    }

    if (character === "~") {
      break;
    }

    if (character === "z" && group.length === 0) {
      bytes.push(0, 0, 0, 0);
      continue;
    }

    const value = byte - 33;

    if (value < 0 || value > 84) {
      continue;
    }

    group.push(value);

    if (group.length === 5) {
      let accumulator = 0;

      for (const item of group) {
        accumulator = accumulator * 85 + item;
      }

      bytes.push(
        (accumulator >>> 24) & 0xff,
        (accumulator >>> 16) & 0xff,
        (accumulator >>> 8) & 0xff,
        accumulator & 0xff
      );
      group.length = 0;
    }
  }

  if (group.length > 0) {
    const outputLength = group.length - 1;

    while (group.length < 5) {
      group.push(84);
    }

    let accumulator = 0;

    for (const item of group) {
      accumulator = accumulator * 85 + item;
    }

    bytes.push(
      ...[
        (accumulator >>> 24) & 0xff,
        (accumulator >>> 16) & 0xff,
        (accumulator >>> 8) & 0xff,
        accumulator & 0xff,
      ].slice(0, outputLength)
    );
  }

  return new Uint8Array(bytes);
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

function readRelationshipTargets(
  entries: ZipEntryMap,
  relationshipPath: string,
  typePattern?: RegExp
): string[] {
  const relationshipEntry = entries.get(relationshipPath);

  if (!relationshipEntry) {
    return [];
  }

  const xmlDocument = parseXml(
    decodeText(relationshipEntry),
    "Format relasi dokumen tidak valid."
  );

  return getElementsByLocalName(xmlDocument, "Relationship")
    .filter((relationship) => {
      const type = relationship.getAttribute("Type") || "";
      const targetMode = relationship.getAttribute("TargetMode") || "";
      const target = relationship.getAttribute("Target") || "";

      return (
        /^https?:\/\//i.test(target) &&
        (!typePattern || typePattern.test(type)) &&
        (!targetMode || targetMode.toLowerCase() === "external")
      );
    })
    .map((relationship) => relationship.getAttribute("Target") || "")
    .filter(Boolean);
}

async function extractDocxText(file: File): Promise<string> {
  const entries = await readZipEntries(new Uint8Array(await file.arrayBuffer()));
  const documentEntryNames = [
    "word/document.xml",
    ...Array.from(entries.keys()).filter((entryName) =>
      /^word\/(?:header|footer|footnotes|endnotes)\d*\.xml$/i.test(entryName)
    ),
  ];
  const lines = documentEntryNames.flatMap((entryName) => {
    const entry = entries.get(entryName);

    if (!entry) {
      return [];
    }

    const xmlDocument = parseXml(
      decodeText(entry),
      entryName === "word/document.xml"
        ? "Format DOCX tidak valid."
        : "Format bagian DOCX tidak valid."
    );

    return getElementsByLocalName(xmlDocument, "p")
      .map((paragraph) =>
        getElementsByLocalName(paragraph, "t")
          .map((node) => node.textContent || "")
          .join("")
          .trim()
      )
      .filter(Boolean);
  });
  const hyperlinkTargets = readRelationshipTargets(
    entries,
    "word/_rels/document.xml.rels",
    /\/hyperlink$/i
  );

  return normalizeExtractedText([...lines, ...hyperlinkTargets].join("\n"));
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

function getWorksheetRelationshipPath(sheetPath: string): string {
  const slashIndex = sheetPath.lastIndexOf("/");
  const directory = slashIndex === -1 ? "" : sheetPath.slice(0, slashIndex + 1);
  const fileName = slashIndex === -1 ? sheetPath : sheetPath.slice(slashIndex + 1);

  return `${directory}_rels/${fileName}.rels`;
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
      const hyperlinkTargets = readRelationshipTargets(
        entries,
        getWorksheetRelationshipPath(sheet.path),
        /\/hyperlink$/i
      );

      if (!rows.length && !hyperlinkTargets.length) {
        return "";
      }

      return [`Sheet: ${sheet.name}`, ...rows, ...hyperlinkTargets].join("\n");
    })
    .filter(Boolean);

  return normalizeExtractedText(sheetTexts.join("\n\n"));
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

      try {
        const decodedStreamData = await decodePdfStreamData(
          streamData,
          dictionaryText
        );

        if (decodedStreamData) {
          streams.push(decodeText(decodedStreamData, "windows-1252"));
        }
      } catch {
        // Ignore streams that are not text or use unsupported filters.
      }
    }

    streamIndex = findNextPdfStreamIndex(pdfText, streamIndex + 6);
  }

  return streams;
}

function getPdfStreamFilters(dictionaryText: string): string[] {
  const filterArray = dictionaryText.match(/\/Filter\s*\[([^\]]+)\]/)?.[1];

  if (filterArray) {
    return [...filterArray.matchAll(/\/([A-Za-z0-9]+)/g)].map(
      (match) => match[1]
    );
  }

  const singleFilter = dictionaryText.match(/\/Filter\s*\/([A-Za-z0-9]+)/)?.[1];
  return singleFilter ? [singleFilter] : [];
}

async function decodePdfStreamData(
  streamData: Uint8Array,
  dictionaryText: string
): Promise<Uint8Array | null> {
  const filters = getPdfStreamFilters(dictionaryText);

  if (filters.some((filter) => /^(DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|Crypt)$/i.test(filter))) {
    return null;
  }

  let decodedData = streamData;

  for (const filter of filters) {
    if (/^(ASCII85Decode|A85)$/i.test(filter)) {
      decodedData = decodeAscii85(decodedData);
      continue;
    }

    if (/^FlateDecode$/i.test(filter)) {
      decodedData = await inflatePdfStream(decodedData);
      continue;
    }

    if (/^ASCIIHexDecode$/i.test(filter)) {
      decodedData = decodePdfAsciiHex(decodedData);
      continue;
    }

    return null;
  }

  return decodedData;
}

function decodePdfAsciiHex(data: Uint8Array): Uint8Array {
  let hex = "";

  for (const byte of data) {
    const character = String.fromCharCode(byte);

    if (character === ">") {
      break;
    }

    if (/[\da-f]/i.test(character)) {
      hex += character;
    }
  }

  if (hex.length % 2 === 1) {
    hex += "0";
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = parseInt(hex.slice(index, index + 2), 16);
  }

  return bytes;
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
    .replace(/\0/g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .join("\n");
}

function extractTextFromMarkup(text: string): string {
  const trimmedText = text.trim();
  const isMarkup =
    /^<\?xml/i.test(trimmedText) ||
    /^<html/i.test(trimmedText) ||
    /<body[\s>]/i.test(trimmedText);

  if (!isMarkup) {
    return normalizeExtractedText(text);
  }

  const parsedDocument = new DOMParser().parseFromString(
    trimmedText,
    /^<html/i.test(trimmedText) || /<body[\s>]/i.test(trimmedText)
      ? "text/html"
      : "application/xml"
  );
  const bodyText = parsedDocument.body?.textContent || parsedDocument.textContent || "";
  const links = Array.from(parsedDocument.querySelectorAll("a[href]"))
    .map((link) => link.getAttribute("href") || "")
    .filter((href) => /^https?:\/\//i.test(href));

  return normalizeExtractedText([bodyText, ...links].join("\n"));
}

function extractTextFromRtf(text: string): string {
  const cleanedText = text
    .replace(/\\par[d]?/gi, "\n")
    .replace(/\\line/gi, "\n")
    .replace(/\\tab/gi, " ")
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\\[a-z]+\d* ?/gi, " ")
    .replace(/\\./g, " ");

  return normalizeExtractedText(cleanedText);
}

async function extractLegacyOfficeText(
  file: File,
  binaryErrorMessage: string
): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());

  if (isOleCompoundDocument(data)) {
    throw new Error(binaryErrorMessage);
  }

  const text = decodeText(data, "windows-1252");

  if (/^\s*{\\rtf/i.test(text)) {
    return extractTextFromRtf(text);
  }

  return extractTextFromMarkup(text);
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

  if (fileExtension === "doc") {
    return extractLegacyOfficeText(
      file,
      "Format Word lama .doc biner belum didukung. Simpan ulang dokumen sebagai .docx, lalu upload kembali."
    );
  }

  if (fileExtension === "pdf") {
    return extractPdfText(file);
  }

  if (fileExtension === "xlsx" || fileExtension === "xlsm") {
    return extractXlsxText(file);
  }

  if (fileExtension === "xls") {
    return extractLegacyOfficeText(
      file,
      "Format Excel lama .xls biner belum didukung. Simpan ulang spreadsheet sebagai .xlsx atau .csv, lalu upload kembali."
    );
  }

  if (["txt", "md", "csv", "json"].includes(fileExtension)) {
    return file.text();
  }

  throw new Error(
    "Format dokumen belum didukung. Gunakan TXT, MD, CSV, JSON, DOCX, PDF, XLSX, atau XLSM."
  );
}
