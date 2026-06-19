import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/authService";
import {
  createUploadedKnowledgeDocument,
  deleteStaticKnowledgeDocument,
  deleteUploadedKnowledgeDocument,
  getKnowledgeSummary,
  loadKnowledgeDocuments,
  setKnowledgeSourceActive,
  updateStaticKnowledgeDocument,
  updateUploadedKnowledgeDocument,
  type KnowledgeDocument,
} from "../services/knowledgeAdminService";
import "../App.css";

function getDefaultTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
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

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Browser belum mendukung ekstraksi DOCX otomatis.");
  }

  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
  const stream = new Blob([buffer]).stream().pipeThrough(
    new DecompressionStream("deflate-raw")
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function extractZipEntry(
  data: Uint8Array,
  targetFileName: string
): Promise<Uint8Array> {
  let endDirectoryOffset = -1;

  for (let offset = data.length - 22; offset >= 0; offset -= 1) {
    if (readUint32(data, offset) === 0x06054b50) {
      endDirectoryOffset = offset;
      break;
    }
  }

  if (endDirectoryOffset === -1) {
    throw new Error("Format DOCX tidak valid.");
  }

  const entryCount = readUint16(data, endDirectoryOffset + 10);
  let directoryOffset = readUint32(data, endDirectoryOffset + 16);
  const decoder = new TextDecoder("utf-8");

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
    const fileName = decoder.decode(
      data.slice(directoryOffset + 46, directoryOffset + 46 + fileNameLength)
    );

    if (fileName === targetFileName) {
      const localFileNameLength = readUint16(data, localHeaderOffset + 26);
      const localExtraLength = readUint16(data, localHeaderOffset + 28);
      const dataStart =
        localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressedData = data.slice(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) {
        return compressedData;
      }

      if (compressionMethod === 8) {
        return inflateRaw(compressedData);
      }

      throw new Error("Metode kompresi DOCX tidak didukung.");
    }

    directoryOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error("Isi DOCX tidak ditemukan.");
}

async function extractDocxText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const documentXml = new TextDecoder("utf-8").decode(
    await extractZipEntry(data, "word/document.xml")
  );
  const xmlDocument = new DOMParser().parseFromString(
    documentXml,
    "application/xml"
  );
  const paragraphs = Array.from(xmlDocument.getElementsByTagName("w:p"));
  const lines = paragraphs
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagName("w:t"))
        .map((node) => node.textContent || "")
        .join("")
        .trim()
    )
    .filter(Boolean);

  return lines.join("\n");
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSource, setUploadSource] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const summary = getKnowledgeSummary();

  const refreshDocuments = useCallback(async () => {
    setIsLoading(true);
    const nextDocuments = await loadKnowledgeDocuments();
    setDocuments(nextDocuments);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadKnowledgeDocuments().then((nextDocuments) => {
      if (isMounted) {
        setDocuments(nextDocuments);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension === "pdf") {
      setNotice(
        "Upload PDF belum diproses otomatis. Salin isi dokumen ke kolom isi dokumen."
      );
      event.target.value = "";
      return;
    }

    let text: string;

    try {
      text = fileExtension === "docx" ? await extractDocxText(file) : await file.text();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Dokumen gagal dibaca. Salin isi dokumen secara manual."
      );
      event.target.value = "";
      return;
    }

    if (!text.trim()) {
      setNotice("Isi dokumen kosong atau tidak bisa dibaca.");
      event.target.value = "";
      return;
    }

    setUploadSource(file.name);
    setUploadTitle((currentTitle) => currentTitle || getDefaultTitle(file.name));
    setUploadContent(text);
    setNotice("");
  };

  const handleCreateDocument = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!uploadTitle.trim() || !uploadContent.trim()) {
      setNotice("Judul dan isi dokumen wajib diisi.");
      return;
    }

    setIsSaving(true);
    await createUploadedKnowledgeDocument({
      title: uploadTitle,
      source: uploadSource || `${uploadTitle.trim()}.txt`,
      content: uploadContent,
    });
    setUploadTitle("");
    setUploadSource("");
    setUploadContent("");
    setNotice("Dokumen berhasil diupload.");
    setIsSaving(false);
    await refreshDocuments();
  };

  const handleToggleDocument = async (document: KnowledgeDocument) => {
    if (document.isUploaded) {
      await updateUploadedKnowledgeDocument(document.id, {
        isActive: !document.isActive,
      });
    } else {
      setKnowledgeSourceActive(document.source, !document.isActive);
    }

    await refreshDocuments();
  };

  const handleStartEdit = (document: KnowledgeDocument) => {
    setEditingId(document.id);
    setViewingId(null);
    setEditTitle(document.title);
    setEditContent(document.content || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  const handleToggleView = (document: KnowledgeDocument) => {
    setViewingId((currentId) => (currentId === document.id ? null : document.id));
    setEditingId(null);
  };

  const handleSaveEdit = async (document: KnowledgeDocument) => {
    if (!editTitle.trim() || !editContent.trim()) {
      setNotice("Judul dan isi dokumen wajib diisi.");
      return;
    }

    setIsSaving(true);

    if (document.isUploaded) {
      await updateUploadedKnowledgeDocument(document.id, {
        title: editTitle,
        content: editContent,
      });
    } else {
      updateStaticKnowledgeDocument(document.source, {
        title: editTitle,
        content: editContent,
      });
    }

    handleCancelEdit();
    setNotice("Dokumen berhasil diperbarui.");
    setIsSaving(false);
    await refreshDocuments();
  };

  const handleDeleteDocument = async (document: KnowledgeDocument) => {
    const confirmed = window.confirm(
      `Hapus dokumen "${document.title}" dari knowledge base?`
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);

    if (document.isUploaded) {
      await deleteUploadedKnowledgeDocument(document.id);
    } else {
      deleteStaticKnowledgeDocument(document.source);
    }

    if (viewingId === document.id) {
      setViewingId(null);
    }

    setNotice("Dokumen berhasil dihapus.");
    setIsSaving(false);
    await refreshDocuments();
  };

  return (
    <div className="admin-page admin-dashboard-page">
      <section className="admin-dashboard" aria-labelledby="admin-title">
        <header className="admin-dashboard-header">
          <div>
            <span className="admin-eyebrow">Dashboard Admin</span>
            <h1 id="admin-title">Knowledge Base SSC</h1>
            <p>Kelola dokumen yang digunakan chatbot untuk menjawab pertanyaan.</p>
          </div>

          <div className="admin-toolbar">
            <button
              className="admin-secondary-btn"
              onClick={() => navigate("/chat")}
              type="button"
            >
              Chatbot
            </button>
            <button className="admin-danger-btn" onClick={handleLogout} type="button">
              Logout
            </button>
          </div>
        </header>

        <div className="admin-summary-grid" aria-label="Ringkasan knowledge base">
          <div className="admin-summary-item">
            <span>Dokumen</span>
            <strong>{summary.totalDocuments}</strong>
          </div>
          <div className="admin-summary-item">
            <span>Dokumen Aktif</span>
            <strong>{summary.activeDocuments}</strong>
          </div>
          <div className="admin-summary-item">
            <span>Chunk</span>
            <strong>{summary.totalChunks}</strong>
          </div>
          <div className="admin-summary-item">
            <span>Chunk Aktif</span>
            <strong>{summary.activeChunks}</strong>
          </div>
        </div>

        <form className="admin-upload-panel" onSubmit={handleCreateDocument}>
          <div className="admin-upload-header">
            <h2>Upload Dokumen Baru</h2>
            <input
              accept=".txt,.md,.csv,.json,.docx"
              aria-label="Pilih file dokumen teks"
              onChange={handleFileChange}
              type="file"
            />
          </div>

          <div className="admin-upload-grid">
            <label>
              Judul Dokumen
              <input
                onChange={(event) => setUploadTitle(event.target.value)}
                type="text"
                value={uploadTitle}
              />
            </label>
            <label>
              Nama File
              <input
                onChange={(event) => setUploadSource(event.target.value)}
                type="text"
                value={uploadSource}
              />
            </label>
          </div>

          <label className="admin-upload-content">
            Isi Dokumen
            <textarea
              onChange={(event) => setUploadContent(event.target.value)}
              rows={7}
              value={uploadContent}
            />
          </label>

          {notice && <p className="admin-notice">{notice}</p>}

          <div className="admin-actions">
            <button
              className="admin-primary-btn"
              disabled={isSaving}
              type="submit"
            >
              Upload
            </button>
          </div>
        </form>

        <div className="document-table" role="table" aria-label="Dokumen knowledge base">
          <div className="document-table-header" role="row">
            <span role="columnheader">Dokumen</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Aksi</span>
          </div>

          {isLoading && <p className="admin-table-state">Memuat dokumen...</p>}

          {!isLoading &&
            documents.map((document) => {
              const isEditing = editingId === document.id;

              return (
                <div className="document-item" key={document.id}>
                  <article className="document-row" role="row">
                    <div className="document-main" role="cell">
                      {isEditing ? (
                        <input
                          className="document-edit-input"
                          onChange={(event) => setEditTitle(event.target.value)}
                          type="text"
                          value={editTitle}
                        />
                      ) : (
                        <>
                          <strong>{document.source}</strong>
                          <span>{document.title}</span>
                          <small>
                            {document.isUploaded
                              ? "Upload admin"
                              : "Dokumen bawaan"}
                          </small>
                        </>
                      )}
                    </div>

                    <div role="cell">
                      <span
                        className={
                          document.isActive
                            ? "document-status active"
                            : "document-status inactive"
                        }
                      >
                        {document.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>

                    <div className="document-actions" role="cell">
                      {isEditing ? (
                        <div className="admin-row-actions">
                          <textarea
                            className="document-edit-textarea"
                            onChange={(event) =>
                              setEditContent(event.target.value)
                            }
                            rows={5}
                            value={editContent}
                          />
                          <button
                            className="admin-primary-btn compact action-save"
                            disabled={isSaving}
                            onClick={() => handleSaveEdit(document)}
                            type="button"
                          >
                            Simpan
                          </button>
                          <button
                            className="admin-secondary-btn compact action-cancel"
                            onClick={handleCancelEdit}
                            type="button"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="admin-row-actions">
                          <button
                            className="admin-secondary-btn compact action-view"
                            onClick={() => handleToggleView(document)}
                            type="button"
                          >
                            Lihat Isi
                          </button>
                          <button
                            className="admin-secondary-btn compact action-toggle"
                            onClick={() => handleToggleDocument(document)}
                            type="button"
                          >
                            {document.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>

                          <button
                            className="admin-secondary-btn compact action-edit"
                            onClick={() => handleStartEdit(document)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="admin-danger-btn compact action-delete"
                            disabled={isSaving}
                            onClick={() => handleDeleteDocument(document)}
                            type="button"
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  </article>

                  {viewingId === document.id && !isEditing && (
                    <section className="document-content-preview">
                      <div className="document-content-preview-header">
                        <strong>Isi Dokumen</strong>
                        <button
                          className="admin-secondary-btn compact"
                          onClick={() => setViewingId(null)}
                          type="button"
                        >
                          Tutup
                        </button>
                      </div>
                      <pre>
                        {document.content || "Isi dokumen tidak tersedia."}
                      </pre>
                    </section>
                  )}
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;
