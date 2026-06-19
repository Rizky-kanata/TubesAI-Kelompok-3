const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "knowledge-documents.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

function readDocuments() {
  ensureDataFile();

  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDocuments(documents) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(documents, null, 2), "utf8");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 2_000_000) {
        request.destroy();
        reject(new Error("Payload terlalu besar."));
      }
    });

    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Body JSON tidak valid."));
      }
    });
  });
}

function getIdFromPath(pathname) {
  const match = pathname.match(/^\/api\/knowledge-documents\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function toDocument(payload, existingDocument) {
  const now = new Date().toISOString();
  const title = String(payload.title || existingDocument?.title || "").trim();
  const source = String(payload.source || existingDocument?.source || "").trim();
  const content = String(payload.content || existingDocument?.content || "").trim();

  if (!title || !source || !content) {
    return null;
  }

  return {
    id:
      existingDocument?.id ||
      `uploaded-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title,
    source,
    section: String(
      payload.section || existingDocument?.section || "Dokumen Upload Admin"
    ).trim(),
    content,
    isActive:
      typeof payload.isActive === "boolean"
        ? payload.isActive
        : existingDocument?.isActive ?? true,
    createdAt: existingDocument?.createdAt || now,
    updatedAt: now,
  };
}

async function handleRequest(request, response) {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (url.pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/knowledge-documents" && request.method === "GET") {
    sendJson(response, 200, readDocuments());
    return;
  }

  if (url.pathname === "/api/knowledge-documents" && request.method === "POST") {
    try {
      const payload = await readBody(request);
      const document = toDocument(payload);

      if (!document) {
        sendJson(response, 400, {
          message: "Judul, nama file, dan isi dokumen wajib diisi.",
        });
        return;
      }

      const documents = readDocuments();
      documents.unshift(document);
      writeDocuments(documents);
      sendJson(response, 201, document);
    } catch (error) {
      sendJson(response, 400, { message: error.message });
    }
    return;
  }

  const documentId = getIdFromPath(url.pathname);

  if (documentId && request.method === "PUT") {
    try {
      const payload = await readBody(request);
      const documents = readDocuments();
      const documentIndex = documents.findIndex((item) => item.id === documentId);

      if (documentIndex === -1) {
        sendJson(response, 404, { message: "Dokumen tidak ditemukan." });
        return;
      }

      const updatedDocument = toDocument(payload, documents[documentIndex]);

      if (!updatedDocument) {
        sendJson(response, 400, {
          message: "Judul, nama file, dan isi dokumen wajib diisi.",
        });
        return;
      }

      documents[documentIndex] = updatedDocument;
      writeDocuments(documents);
      sendJson(response, 200, updatedDocument);
    } catch (error) {
      sendJson(response, 400, { message: error.message });
    }
    return;
  }

  if (documentId && request.method === "DELETE") {
    const documents = readDocuments();
    const nextDocuments = documents.filter((item) => item.id !== documentId);

    if (documents.length === nextDocuments.length) {
      sendJson(response, 404, { message: "Dokumen tidak ditemukan." });
      return;
    }

    writeDocuments(nextDocuments);
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { message: "Endpoint tidak ditemukan." });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    sendJson(response, 500, { message: error.message || "Server error." });
  });
});

server.listen(PORT, () => {
  console.log(`Knowledge API running at http://localhost:${PORT}`);
});

