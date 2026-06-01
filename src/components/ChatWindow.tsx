import { useEffect, useRef, type ReactNode } from "react";
import type { Message } from "../types/Message";
import chatbotConfig from "../config/chatbotConfig";

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
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

function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="chat-window">
      {messages.length === 0 && (
        <div className="message model welcome">
          <strong>{chatbotConfig.botName}:</strong>
          <p>{chatbotConfig.welcomeMessage}</p>
        </div>
      )}
      {messages.map((msg, i) => (
        <div key={i} className={`message ${msg.role}`}>
          <strong>
            {msg.role === "user" ? "Anda" : chatbotConfig.botName}:
          </strong>
          {renderMessageContent(msg.content)}
        </div>
      ))}
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
