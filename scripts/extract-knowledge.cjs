const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const repoRoot = path.resolve(__dirname, "..");
const documentsPath = path.join(repoRoot, "documents");
const outputPath = path.join(repoRoot, "src", "data", "knowledgeBase.ts");
const publicDocumentsPath = path.join(repoRoot, "public", "knowledge-documents");

const supportedExtensions = new Set([
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".docx",
  ".pptx",
  ".pdf",
  ".xlsx",
  ".xlsm",
]);

function readUint16(data, offset) {
  return data[offset] | (data[offset + 1] << 8);
}

function readUint32(data, offset) {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

function toSlug(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "document"
  );
}

function getDocumentTitle(filePath) {
  return path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, " ").trim();
}

function getFileType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const fileTypes = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
    ".csv": "text/csv",
    ".json": "application/json",
    ".md": "text/markdown",
    ".txt": "text/plain",
  };

  return fileTypes[extension] || "application/octet-stream";
}

function copyDocumentToPublic(document) {
  fs.mkdirSync(publicDocumentsPath, { recursive: true });

  const extension = path.extname(document.path).toLowerCase();
  const publicFileName = `${document.id}${extension}`;
  const publicFilePath = path.join(publicDocumentsPath, publicFileName);

  fs.copyFileSync(document.path, publicFilePath);

  return {
    source: path.basename(document.path),
    fileName: path.basename(document.path),
    fileType: getFileType(document.path),
    fileUrl: `/knowledge-documents/${publicFileName}`,
  };
}

function normalizeExtractedText(text) {
  return text
    .replace(/\0/g, " ")
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .join("\n");
}

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function readZipEntries(filePath) {
  const data = fs.readFileSync(filePath);
  let endDirectoryOffset = -1;

  for (let offset = data.length - 22; offset >= 0; offset -= 1) {
    if (readUint32(data, offset) === 0x06054b50) {
      endDirectoryOffset = offset;
      break;
    }
  }

  if (endDirectoryOffset === -1) {
    throw new Error(`Format ZIP tidak valid: ${path.basename(filePath)}`);
  }

  const entryCount = readUint16(data, endDirectoryOffset + 10);
  let directoryOffset = readUint32(data, endDirectoryOffset + 16);
  const entries = new Map();

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
    const fileName = data
      .subarray(directoryOffset + 46, directoryOffset + 46 + fileNameLength)
      .toString("utf8");
    const localFileNameLength = readUint16(data, localHeaderOffset + 26);
    const localExtraLength = readUint16(data, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = data.subarray(dataStart, dataStart + compressedSize);

    if (compressionMethod === 0) {
      entries.set(fileName, compressedData);
    } else if (compressionMethod === 8) {
      entries.set(fileName, zlib.inflateRawSync(compressedData));
    }

    directoryOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function getZipText(entries, entryName) {
  const entry = entries.get(entryName);

  if (!entry) {
    return "";
  }

  return entry.toString("utf8");
}

function extractRelationshipTargets(entries, relationshipPath, typePattern) {
  const relationshipText = getZipText(entries, relationshipPath);

  if (!relationshipText) {
    return [];
  }

  return [...relationshipText.matchAll(/<Relationship\b([^>]*)\/?>/g)]
    .map((match) => {
      const attributes = match[1];
      const target = attributes.match(/\bTarget="([^"]+)"/)?.[1] || "";
      const targetMode = attributes.match(/\bTargetMode="([^"]+)"/)?.[1] || "";
      const type = attributes.match(/\bType="([^"]+)"/)?.[1] || "";

      if (!/^https?:\/\//i.test(target)) {
        return "";
      }

      if (typePattern && !typePattern.test(type)) {
        return "";
      }

      if (targetMode && targetMode.toLowerCase() !== "external") {
        return "";
      }

      return decodeXml(target);
    })
    .filter(Boolean);
}

function extractWordParagraphs(xmlText) {
  const lines = [];
  const paragraphMatches = [...xmlText.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)];

  for (const paragraphMatch of paragraphMatches) {
    const paragraph = paragraphMatch[0];
    const text = [...paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g)]
      .map((match) => {
        if (match[1] !== undefined) {
          return decodeXml(match[1]);
        }

        return " ";
      })
      .join("")
      .trim();

    if (text) {
      lines.push(text);
    }
  }

  return lines;
}

function readDocxText(filePath) {
  const entries = readZipEntries(filePath);
  const entryNames = [
    "word/document.xml",
    ...[...entries.keys()].filter((entryName) =>
      /^word\/(?:header|footer|footnotes|endnotes)\d*\.xml$/i.test(entryName)
    ),
  ];
  const lines = entryNames.flatMap((entryName) => extractWordParagraphs(getZipText(entries, entryName)));
  const links = extractRelationshipTargets(entries, "word/_rels/document.xml.rels", /\/hyperlink$/i);

  return normalizeExtractedText([...lines, ...links].join("\n"));
}

function readPptxSlides(filePath) {
  const entries = readZipEntries(filePath);
  const slideNames = [...entries.keys()]
    .filter((entryName) => /^ppt\/slides\/slide\d+\.xml$/i.test(entryName))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));

  return slideNames
    .map((entryName) => {
      const slideNumber = Number(entryName.match(/\d+/)?.[0] || 0);
      const raw = getZipText(entries, entryName);
      const text = normalizeExtractedText(
        [...raw.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>|<a:br\b[^>]*\/>/g)]
          .map((match) => (match[1] !== undefined ? decodeXml(match[1]) : "\n"))
          .join("")
      );

      return text
        ? {
            section: `Slide ${slideNumber}`,
            content: text,
          }
        : null;
    })
    .filter(Boolean);
}

function readSharedStrings(entries) {
  const raw = getZipText(entries, "xl/sharedStrings.xml");

  if (!raw) {
    return [];
  }

  return [...raw.matchAll(/<si\b[\s\S]*?<\/si>/g)].map((match) =>
    [...match[0].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => decodeXml(textMatch[1]))
      .join("")
      .trim()
  );
}

function resolveWorkbookTarget(target) {
  const targetPath = target.replace(/^\/+/, "").startsWith("xl/")
    ? target.replace(/^\/+/, "")
    : `xl/${target.replace(/^\/+/, "")}`;
  const parts = [];

  for (const part of targetPath.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }

  return parts.join("/");
}

function readWorkbookSheets(entries) {
  const workbookText = getZipText(entries, "xl/workbook.xml");
  const relationshipsText = getZipText(entries, "xl/_rels/workbook.xml.rels");

  if (!workbookText || !relationshipsText) {
    return [...entries.keys()]
      .filter((entryName) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entryName))
      .sort()
      .map((entryName, index) => ({
        name: `Sheet ${index + 1}`,
        path: entryName,
      }));
  }

  const targets = new Map(
    [...relationshipsText.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((match) => {
      const attributes = match[1];
      const id = attributes.match(/\bId="([^"]+)"/)?.[1] || "";
      const target = attributes.match(/\bTarget="([^"]+)"/)?.[1] || "";

      return [id, resolveWorkbookTarget(target)];
    })
  );

  return [...workbookText.matchAll(/<sheet\b([^>]*)\/?>/g)]
    .map((match, index) => {
      const attributes = match[1];
      const name = decodeXml(attributes.match(/\bname="([^"]+)"/)?.[1] || `Sheet ${index + 1}`);
      const relationshipId = attributes.match(/\br:id="([^"]+)"/)?.[1] || "";

      return {
        name,
        path: targets.get(relationshipId) || "",
      };
    })
    .filter((sheet) => sheet.path && entries.has(sheet.path));
}

function getWorksheetRelationshipPath(sheetPath) {
  const directory = sheetPath.slice(0, sheetPath.lastIndexOf("/") + 1);
  const fileName = sheetPath.slice(sheetPath.lastIndexOf("/") + 1);

  return `${directory}_rels/${fileName}.rels`;
}

function readExcelCellValue(cellXml, sharedStrings) {
  const type = cellXml.match(/\bt="([^"]+)"/)?.[1] || "";

  if (type === "inlineStr") {
    return [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((match) => decodeXml(match[1]))
      .join("")
      .trim();
  }

  const rawValue = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1]?.trim() || "";

  if (!rawValue) {
    return "";
  }

  if (type === "s") {
    return sharedStrings[Number(rawValue)] || "";
  }

  if (type === "b") {
    return rawValue === "1" ? "TRUE" : "FALSE";
  }

  return decodeXml(rawValue);
}

function readXlsxText(filePath) {
  const entries = readZipEntries(filePath);
  const sharedStrings = readSharedStrings(entries);
  const sheets = readWorkbookSheets(entries);
  const sheetTexts = sheets
    .map((sheet) => {
      const worksheetText = getZipText(entries, sheet.path);
      const rows = [...worksheetText.matchAll(/<row\b[\s\S]*?<\/row>/g)]
        .map((rowMatch) =>
          [...rowMatch[0].matchAll(/<c\b[\s\S]*?<\/c>/g)]
            .map((cellMatch) => readExcelCellValue(cellMatch[0], sharedStrings))
            .filter(Boolean)
            .join("\t")
        )
        .filter(Boolean);
      const links = extractRelationshipTargets(entries, getWorksheetRelationshipPath(sheet.path), /\/hyperlink$/i);

      if (!rows.length && !links.length) {
        return "";
      }

      return [`Sheet: ${sheet.name}`, ...rows, ...links].join("\n");
    })
    .filter(Boolean);

  return normalizeExtractedText(sheetTexts.join("\n\n"));
}

function decodeAscii85(data) {
  const bytes = [];
  const group = [];

  for (let index = 0; index < data.length; index += 1) {
    const byte = data[index];
    const character = String.fromCharCode(byte);

    if (/\s/.test(character)) {
      continue;
    }

    if (character === "<" && String.fromCharCode(data[index + 1] || 0) === "~" && group.length === 0) {
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

  return Buffer.from(bytes);
}

function decodeAsciiHex(data) {
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

  return Buffer.from(hex, "hex");
}

function inflatePdfStream(data) {
  try {
    return zlib.inflateSync(data);
  } catch {
    return zlib.inflateRawSync(data);
  }
}

function getPdfFilters(dictionaryText) {
  const filterArray = dictionaryText.match(/\/Filter\s*\[([^\]]+)\]/)?.[1];

  if (filterArray) {
    return [...filterArray.matchAll(/\/([A-Za-z0-9]+)/g)].map((match) => match[1]);
  }

  const singleFilter = dictionaryText.match(/\/Filter\s*\/([A-Za-z0-9]+)/)?.[1];
  return singleFilter ? [singleFilter] : [];
}

function decodePdfStream(streamData, dictionaryText) {
  const filters = getPdfFilters(dictionaryText);

  if (filters.some((filter) => /^(DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|Crypt)$/i.test(filter))) {
    return null;
  }

  let decoded = streamData;

  for (const filter of filters) {
    if (/^(ASCII85Decode|A85)$/i.test(filter)) {
      decoded = decodeAscii85(decoded);
    } else if (/^ASCIIHexDecode$/i.test(filter)) {
      decoded = decodeAsciiHex(decoded);
    } else if (/^FlateDecode$/i.test(filter)) {
      decoded = inflatePdfStream(decoded);
    } else {
      return null;
    }
  }

  return decoded;
}

function decodePdfLiteralString(value) {
  const bytes = [];

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === "\\") {
      const nextCharacter = value[index + 1] || "";

      if (/\r|\n/.test(nextCharacter)) {
        index += nextCharacter === "\r" && value[index + 2] === "\n" ? 2 : 1;
        continue;
      }

      if (/[0-7]/.test(nextCharacter)) {
        const octal = value.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] || "0";
        bytes.push(parseInt(octal, 8));
        index += octal.length;
        continue;
      }

      const escapedCharacters = {
        b: 8,
        f: 12,
        n: 10,
        r: 13,
        t: 9,
        "(": 40,
        ")": 41,
        "\\": 92,
      };
      bytes.push(escapedCharacters[nextCharacter] ?? nextCharacter.charCodeAt(0));
      index += 1;
      continue;
    }

    bytes.push(character.charCodeAt(0) & 0xff);
  }

  return Buffer.from(bytes).toString("latin1");
}

function readPdfStringToken(text, startIndex) {
  if (text[startIndex] === "(") {
    let value = "";
    let index = startIndex + 1;
    let depth = 1;

    while (index < text.length) {
      const character = text[index];

      if (character === "\\") {
        value += character + (text[index + 1] || "");
        index += 2;
        continue;
      }

      if (character === "(") {
        depth += 1;
      }

      if (character === ")") {
        depth -= 1;

        if (depth === 0) {
          return {
            value: decodePdfLiteralString(value),
            endIndex: index + 1,
          };
        }
      }

      value += character;
      index += 1;
    }
  }

  if (text[startIndex] === "<" && text[startIndex + 1] !== "<") {
    const endIndex = text.indexOf(">", startIndex + 1);

    if (endIndex !== -1) {
      let hex = text.slice(startIndex + 1, endIndex).replace(/\s+/g, "");

      if (hex && /^[\da-f]+$/i.test(hex)) {
        if (hex.length % 2 === 1) {
          hex += "0";
        }

        return {
          value: Buffer.from(hex, "hex").toString("latin1"),
          endIndex: endIndex + 1,
        };
      }
    }
  }

  return null;
}

function extractTextFromPdfContentStream(streamText) {
  const textBlocks = streamText.match(/BT\b[\s\S]*?\bET/g) || [];
  const values = [];

  for (const block of textBlocks) {
    let index = 0;

    while (index < block.length) {
      const token = readPdfStringToken(block, index);

      if (token) {
        const operator = block.slice(token.endIndex).match(/^\s*(Tj|'|")/);

        if (operator) {
          values.push(token.value.replace(/\s+/g, " ").trim());
        }

        index = token.endIndex;
        continue;
      }

      if (block[index] === "[") {
        const endIndex = block.indexOf("]", index + 1);

        if (endIndex !== -1 && /^\s*TJ/.test(block.slice(endIndex + 1))) {
          const arrayText = block.slice(index + 1, endIndex);
          const arrayValues = [];
          let arrayIndex = 0;

          while (arrayIndex < arrayText.length) {
            const arrayToken = readPdfStringToken(arrayText, arrayIndex);

            if (arrayToken) {
              arrayValues.push(arrayToken.value.replace(/\s+/g, " ").trim());
              arrayIndex = arrayToken.endIndex;
              continue;
            }

            arrayIndex += 1;
          }

          values.push(arrayValues.filter(Boolean).join(" "));
          index = endIndex + 1;
          continue;
        }
      }

      index += 1;
    }
  }

  return values.filter(Boolean).join("\n");
}

function extractPdfUrls(text) {
  const urls = new Set(text.match(/https?:\/\/[^\s<>()\]{}"']+/gi) || []);
  let uriIndex = text.indexOf("/URI");

  while (uriIndex !== -1) {
    const tokenStart = text.slice(uriIndex + 4).search(/\S/);
    const token = tokenStart >= 0 ? readPdfStringToken(text, uriIndex + 4 + tokenStart) : null;

    if (token && /^https?:\/\//i.test(token.value)) {
      urls.add(token.value);
    }

    uriIndex = text.indexOf("/URI", uriIndex + 4);
  }

  return [...urls].map((url) => url.replace(/[.,;:!?]+$/g, ""));
}

function readPdfText(filePath) {
  const data = fs.readFileSync(filePath);
  const pdfText = data.toString("latin1");
  const texts = [...extractPdfUrls(pdfText)];
  let streamIndex = findNextPdfStreamIndex(pdfText, 0);

  while (streamIndex !== -1) {
    const dictionaryStart = pdfText.lastIndexOf("<<", streamIndex);
    const dictionaryEnd = pdfText.lastIndexOf(">>", streamIndex);

    if (dictionaryStart !== -1 && dictionaryEnd > dictionaryStart) {
      const dictionaryText = pdfText.slice(dictionaryStart, dictionaryEnd + 2);
      let streamStart = streamIndex + "stream".length;

      if (pdfText[streamStart] === "\r" && pdfText[streamStart + 1] === "\n") {
        streamStart += 2;
      } else if (pdfText[streamStart] === "\n" || pdfText[streamStart] === "\r") {
        streamStart += 1;
      }

      const length = Number(dictionaryText.match(/\/Length\s+(\d+)/)?.[1] || 0);
      const streamEnd = length ? streamStart + length : pdfText.indexOf("endstream", streamStart);
      const decodedStream = decodePdfStream(data.subarray(streamStart, streamEnd), dictionaryText);

      if (decodedStream) {
        const streamText = decodedStream.toString("latin1");
        texts.push(...extractPdfUrls(streamText), extractTextFromPdfContentStream(streamText));
      }

      streamIndex = findNextPdfStreamIndex(pdfText, streamEnd);
      continue;
    }

    streamIndex = findNextPdfStreamIndex(pdfText, streamIndex + 6);
  }

  const extractedText = normalizeExtractedText(texts.join("\n"));

  if (!extractedText) {
    throw new Error(`${path.basename(filePath)} tidak berisi teks yang dapat diekstrak.`);
  }

  return extractedText;
}

function findNextPdfStreamIndex(text, startIndex) {
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

function splitTextSections(text, fallbackSection) {
  const paragraphs = text.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks = [];
  let buffer = [];
  let section = fallbackSection;

  for (const paragraph of paragraphs) {
    const looksLikeHeading =
      paragraph.length <= 100 &&
      (/^(alur|syarat|dokumen|tahapan|catatan|contoh|pertanyaan|jawaban|proposal|lpj|sertifikasi|faq|panduan|template|tak|ssc)\b/i.test(paragraph) ||
        /^[0-9]+[.)]\s+\S+/.test(paragraph));

    if (looksLikeHeading && buffer.length >= 2) {
      chunks.push({
        section,
        content: buffer.join("\n"),
      });
      buffer = [paragraph];
      section = paragraph;
      continue;
    }

    if (looksLikeHeading && buffer.length === 0) {
      section = paragraph;
    }

    buffer.push(paragraph);

    if (buffer.join(" ").length > 1100) {
      chunks.push({
        section,
        content: buffer.join("\n"),
      });
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    chunks.push({
      section,
      content: buffer.join("\n"),
    });
  }

  return chunks;
}

function getLocalDocuments() {
  if (!fs.existsSync(documentsPath)) {
    return [];
  }

  const slugCounts = new Map();

  return fs
    .readdirSync(documentsPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(documentsPath, entry.name))
    .filter((filePath) => {
      const extension = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);

      return supportedExtensions.has(extension) && !/^~\$/.test(fileName) && !/^readme\.md$/i.test(fileName);
    })
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))
    .map((filePath) => {
      const baseName = path.basename(filePath, path.extname(filePath));
      const slug = toSlug(baseName);
      const count = (slugCounts.get(slug) || 0) + 1;
      slugCounts.set(slug, count);

      return {
        id: count === 1 ? slug : `${slug}-${count}`,
        title: getDocumentTitle(filePath),
        type: path.extname(filePath).slice(1).toLowerCase(),
        path: filePath,
      };
    });
}

function readDocumentSections(document) {
  if (document.type === "pptx") {
    return readPptxSlides(document.path);
  }

  if (document.type === "docx") {
    return splitTextSections(readDocxText(document.path), document.title);
  }

  if (document.type === "pdf") {
    return splitTextSections(readPdfText(document.path), document.title);
  }

  if (document.type === "xlsx" || document.type === "xlsm") {
    return splitTextSections(readXlsxText(document.path), document.title);
  }

  return splitTextSections(normalizeExtractedText(fs.readFileSync(document.path, "utf8")), document.title);
}

function toTsString(value) {
  return JSON.stringify(value);
}

function main() {
  const documents = getLocalDocuments();

  if (documents.length === 0) {
    throw new Error(`Tidak ada dokumen yang didukung di ${documentsPath}`);
  }

  const knowledgeChunks = [];
  const sourceFiles = [];

  for (const document of documents) {
    sourceFiles.push(copyDocumentToPublic(document));

    const sections = readDocumentSections(document);
    let index = 1;

    for (const section of sections) {
      const content = normalizeExtractedText(section.content);

      if (!content) {
        continue;
      }

      knowledgeChunks.push({
        id: `${document.id}-${index}`,
        title: document.title,
        section: section.section,
        source: path.basename(document.path),
        content,
      });
      index += 1;
    }
  }

  const lines = [
    "export interface KnowledgeChunk {",
    "  id: string;",
    "  title: string;",
    "  section: string;",
    "  source: string;",
    "  content: string;",
    "}",
    "",
    "export interface KnowledgeSourceFile {",
    "  source: string;",
    "  fileName: string;",
    "  fileType: string;",
    "  fileUrl: string;",
    "}",
    "",
    "export const knowledgeChunks: KnowledgeChunk[] = [",
  ];

  for (const chunk of knowledgeChunks) {
    lines.push("  {");
    lines.push(`    id: ${toTsString(chunk.id)},`);
    lines.push(`    title: ${toTsString(chunk.title)},`);
    lines.push(`    section: ${toTsString(chunk.section)},`);
    lines.push(`    source: ${toTsString(chunk.source)},`);
    lines.push(`    content: ${toTsString(chunk.content)},`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");
  lines.push("export const knowledgeSourceFiles: KnowledgeSourceFile[] = [");

  for (const sourceFile of sourceFiles) {
    lines.push("  {");
    lines.push(`    source: ${toTsString(sourceFile.source)},`);
    lines.push(`    fileName: ${toTsString(sourceFile.fileName)},`);
    lines.push(`    fileType: ${toTsString(sourceFile.fileType)},`);
    lines.push(`    fileUrl: ${toTsString(sourceFile.fileUrl)},`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");
  lines.push(`export const knowledgeSourceCount = ${documents.length};`);
  lines.push(`export const knowledgeChunkCount = ${knowledgeChunks.length};`);
  lines.push("");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
  console.log(`Generated ${outputPath} with ${knowledgeChunks.length} chunks from ${documents.length} documents.`);
}

main();
