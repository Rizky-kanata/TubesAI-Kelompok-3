import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Message } from "../types/Message";
import chatbotConfig from "../config/chatbotConfig";

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  onEditUserMessage: (messageIndex: number, content: string) => void;
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
