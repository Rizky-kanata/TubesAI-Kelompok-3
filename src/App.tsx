import { useMemo, useState } from "react";
import ChatInput from "./components/ChatInput";
import ChatWindow from "./components/ChatWindow";
import chatbotConfig from "./config/chatbotConfig";
import {
  knowledgeChunkCount,
  knowledgeChunks,
  knowledgeSourceCount,
} from "./data/knowledgeBase";
import heroImage from "./assets/hero.png";
import { sendMessage } from "./services/groqService";
import type { Message } from "./types/Message";
import "./App.css";

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sourceDocuments = useMemo(() => {
    const docs = new Map<string, { title: string; source: string }>();

    for (const chunk of knowledgeChunks) {
      if (!docs.has(chunk.source)) {
        docs.set(chunk.source, {
          title: chunk.title,
          source: chunk.source,
        });
      }
    }

    return [...docs.values()];
  }, []);

  const handleSend = async (text: string) => {
    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const reply = await sendMessage(text, messages);
      const botMessage: Message = {
        role: "model",
        content: reply.content,
        sources: reply.sources,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch {
      const errorMessage: Message = {
        role: "model",
        content:
          "Maaf, layanan model sedang tidak bisa dihubungi. Coba lagi beberapa saat lagi.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => setMessages([]);

  return (
    <div className="app-shell">
      <aside className="knowledge-panel" aria-label="Ringkasan sumber data">
        <div className="brand-lockup">
          <img src={heroImage} alt="" className="brand-image" />
          <div>
            <span className="eyebrow">RAG Knowledge Base</span>
            <h1>{chatbotConfig.botName}</h1>
          </div>
        </div>
        <p className="subtitle">{chatbotConfig.tagline}</p>

        <div className="stats-grid" aria-label="Statistik knowledge base">
          <div className="stat-item">
            <strong>{knowledgeSourceCount}</strong>
            <span>Dokumen</span>
          </div>
          <div className="stat-item">
            <strong>{knowledgeChunkCount}</strong>
            <span>Potongan</span>
          </div>
        </div>

        <div className="source-list">
          <h2>Sumber Data</h2>
          {sourceDocuments.map((source) => (
            <div className="source-row" key={source.source}>
              <span>{source.title}</span>
              <small>{source.source}</small>
            </div>
          ))}
        </div>
      </aside>

      <main className="chat-panel">
        <header className="chat-header">
          <div>
            <span className="status-line">
              <span className="status-dot" aria-hidden="true" />
              Siap menjawab
            </span>
            <h2>Ruang Tanya</h2>
          </div>
          <button className="clear-btn" type="button" onClick={handleClear}>
            Chat Baru
          </button>
        </header>

        <div className="quick-prompts" aria-label="Pertanyaan cepat">
          {chatbotConfig.quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="prompt-chip"
              onClick={() => handleSend(prompt)}
              disabled={isLoading}
            >
              {prompt}
            </button>
          ))}
        </div>

        <ChatWindow messages={messages} isLoading={isLoading} />
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          placeholder={chatbotConfig.inputPlaceholder}
        />
      </main>
    </div>
  );
}

export default App;
