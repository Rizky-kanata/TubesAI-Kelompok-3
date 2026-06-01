import { useEffect, useRef } from "react";
import type { Message } from "../types/Message";
import chatbotConfig from "../config/chatbotConfig";

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
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
          <p>{msg.content}</p>
          {msg.sources && msg.sources.length > 0 && (
            <div className="message-sources" aria-label="Sumber jawaban">
              {msg.sources.map((source) => (
                <span className="source-chip" key={source.id}>
                  {source.title}
                  <small>{source.section}</small>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      {isLoading && (
        <div className="message model">
          <strong>{chatbotConfig.botName}:</strong>
          <p>Sedang mengetik...</p>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export default ChatWindow;
