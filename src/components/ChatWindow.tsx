import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DownloadableFile, Message, MessageSource } from "../types/Message";
import chatbotConfig from "../config/chatbotConfig";
import { getKnowledgeDocuments } from "../services/knowledgeAdminService";

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  onEditUserMessage: (messageIndex: number, content: string) => void;
}

interface DownloadableSource {
  source: MessageSource;
  title: string;
  fileName: string;
  fileType?: string;
  fileData?: string;
  fileUrl?: string;
  content: string;
}

function cleanUrl(value: string): string {
  return value.replace(/[.,;)]$/g, "");
}

function getUrlHost(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

function getSafeBaseName(value: string): string {
  return (
    value
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-_\s]/gi, " ")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "dokumen"
  );
}

function getSafeOriginalFileName(value: string): string {
  const extension = value.match(/\.([a-z0-9]{1,10})$/i)?.[1]?.toLowerCase();
  return `${getSafeBaseName(value)}.${extension || "bin"}`;
}

function getFileKind(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "pdf") {
    return "PDF";
  }

  if (extension === "doc" || extension === "docx") {
    return "Word";
  }

  if (extension === "xls" || extension === "xlsx" || extension === "xlsm") {
    return "Excel";
  }

  return "file";
}

function toDownloadableSource(file: DownloadableFile): DownloadableSource {
  return {
    source: {
      id: file.id,
      title: file.title,
      section: "File dokumen",
      source: file.source,
    },
    title: file.title,
    fileName: getSafeOriginalFileName(file.fileName || file.source || file.title),
    fileType: file.fileType,
    fileData: file.fileData,
    fileUrl: file.fileUrl,
    content: "",
  };
}

function getDownloadableSources(sources: MessageSource[] = []): DownloadableSource[] {
  const documents = getKnowledgeDocuments();
  const seenSources = new Set<string>();

  return sources
    .map<DownloadableSource | null>((source) => {
      if (seenSources.has(source.source)) {
        return null;
      }

      seenSources.add(source.source);

      const document = documents.find(
        (item) => item.source === source.source || item.id === source.source
      );
      const content = document?.content?.trim();

      if (!document || !content) {
        return null;
      }

      if (!document.fileData && !document.fileUrl) {
        return null;
      }

      return {
        source,
        title: document.title || source.title,
        fileName: getSafeOriginalFileName(
          document.fileName || document.source || document.title
        ),
        fileType: document.fileType,
        fileData: document.fileData,
        fileUrl: document.fileUrl,
        content,
      };
    })
    .filter((item): item is DownloadableSource => Boolean(item));
}

function downloadFile(item: {
  fileName: string;
  fileType?: string;
  fileData?: string;
  fileUrl?: string;
  content: string;
}) {
  if (!item.fileData && !item.fileUrl) {
    return;
  }

  const link = document.createElement("a");

  link.href = item.fileData || item.fileUrl || "";
  link.download = item.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function renderLinkedText(text: string): ReactNode[] {
  const urlPattern = /(https?:\/\/\S+)/g;
  const parts = text.split(urlPattern);

  return parts.map((part, index) => {
    if (!part.startsWith("http://") && !part.startsWith("https://")) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    const url = cleanUrl(part);
    return (
      <a
        className="message-inline-link"
        href={url}
        key={`${url}-${index}`}
        target="_blank"
        rel="noreferrer"
      >
        Buka link
      </a>
    );
  });
}

function renderMessageContent(content: string) {
  return (
    <div className="message-content">
      {content.split("\n").map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div className="message-gap" key={`gap-${index}`} />;
        }

        const linkLine = trimmed.match(/^(?:link|tautan)\s*:\s*(https?:\/\/\S+)$/i);
        if (linkLine) {
          const url = cleanUrl(linkLine[1]);

          return (
            <a
              className="message-link-card"
              href={url}
              key={`link-${index}`}
              target="_blank"
              rel="noreferrer"
            >
              <span>Buka link</span>
              <small>{getUrlHost(url)}</small>
            </a>
          );
        }

        const numberedLine = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numberedLine) {
          return (
            <div className="message-step" key={`step-${index}`}>
              <span className="message-step-number">{numberedLine[1]}</span>
              <p>{renderLinkedText(numberedLine[2])}</p>
            </div>
          );
        }

        return (
          <p className="message-line" key={`line-${index}`}>
            {renderLinkedText(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M12 3v10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="m7 9 5 5 5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M5 20h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <rect
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        width="13"
        x="8"
        y="3"
      />
      <path
        d="M16 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="m5 12 4 4L19 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function ChatWindow({
  messages,
  isLoading,
  onEditUserMessage,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleStartEdit = (messageIndex: number, content: string) => {
    setEditingIndex(messageIndex);
    setDraftContent(content);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setDraftContent("");
  };

  const handleSubmitEdit = (event: React.FormEvent) => {
    event.preventDefault();

    if (editingIndex === null || !draftContent.trim()) {
      return;
    }

    const originalContent = messages[editingIndex]?.content ?? "";
    const nextContent = draftContent.trim();

    handleCancelEdit();

    if (nextContent !== originalContent) {
      onEditUserMessage(editingIndex, nextContent);
    }
  };

  const handleCopy = async (messageIndex: number, content: string) => {
    await copyToClipboard(content);
    setCopiedIndex(messageIndex);

    window.setTimeout(() => {
      setCopiedIndex((currentIndex) =>
        currentIndex === messageIndex ? null : currentIndex
      );
    }, 1400);
  };

  return (
    <div className="chat-window">
      {messages.length === 0 && (
        <div className="message model welcome">
          <strong>{chatbotConfig.botName}:</strong>
          <p>{chatbotConfig.welcomeMessage}</p>
        </div>
      )}
      {messages.map((msg, i) => {
        const isEditing = editingIndex === i;
        const downloadableSources =
          msg.role === "model" && msg.showDownloads
            ? msg.downloads?.length
              ? msg.downloads.map(toDownloadableSource)
              : getDownloadableSources(msg.sources)
            : [];

        return (
          <div key={i} className={`message-group ${msg.role}`}>
            <div className={`message ${msg.role}`}>
              <div className="message-header">
                <strong>
                  {msg.role === "user" ? "Anda" : chatbotConfig.botName}:
                </strong>
              </div>

              {isEditing ? (
                <form className="message-edit-form" onSubmit={handleSubmitEdit}>
                  <textarea
                    aria-label="Edit pesan"
                    disabled={isLoading}
                    onChange={(event) => setDraftContent(event.target.value)}
                    rows={3}
                    value={draftContent}
                  />
                  <div className="message-edit-actions">
                    <button
                      className="message-edit-save"
                      disabled={isLoading || !draftContent.trim()}
                      type="submit"
                    >
                      Simpan
                    </button>
                    <button
                      className="message-edit-cancel"
                      disabled={isLoading}
                      onClick={handleCancelEdit}
                      type="button"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              ) : (
                renderMessageContent(msg.content)
              )}

              {!isEditing && downloadableSources.length > 0 && (
                <div className="message-downloads" aria-label="File sumber">
                  {downloadableSources.map((item) => (
                    <button
                      className="message-download-btn"
                      key={`${item.source.source}-${item.fileName}`}
                      onClick={() => downloadFile(item)}
                      title={`Download ${item.title}`}
                      type="button"
                    >
                      <DownloadIcon />
                      <span>Download {getFileKind(item.fileName)}</span>
                      <small>{item.source.source}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!isEditing && (
              <div className="message-actions">
                <button
                  aria-label={copiedIndex === i ? "Pesan disalin" : "Salin pesan"}
                  className={`message-action-btn ${
                    copiedIndex === i ? "copied" : ""
                  }`}
                  onClick={() => handleCopy(i, msg.content)}
                  title={copiedIndex === i ? "Disalin" : "Salin pesan"}
                  type="button"
                >
                  {copiedIndex === i ? <CheckIcon /> : <CopyIcon />}
                </button>
                {msg.role === "user" && (
                  <button
                    aria-label="Edit pesan"
                    className="message-action-btn"
                    disabled={isLoading}
                    onClick={() => handleStartEdit(i, msg.content)}
                    title="Edit pesan"
                    type="button"
                  >
                    <EditIcon />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {isLoading && (
        <div className="message model">
          <strong>{chatbotConfig.botName}:</strong>
          {renderMessageContent("Sedang mengetik...")}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export default ChatWindow;
