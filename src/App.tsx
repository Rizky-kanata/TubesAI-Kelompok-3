import { useState } from "react";
import ChatInput from "./components/ChatInput";
import ChatWindow from "./components/ChatWindow";
import chatbotConfig from "./config/chatbotConfig";
import { sendMessage } from "./services/groqService";
import type { Message } from "./types/Message";
import "./App.css";

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
      <main className="chat-panel">
        <header className="chat-header">
          {/* Kiri: Logo */}
          <div className="header-left">
          </div>
          
          {/* Tengah: Teks utama */}
          <div className="header-center">
            <div className="status-line">
              <span className="status-dot" aria-hidden="true" />
              SIAP MENJAWAB
            </div>
            <h1>{chatbotConfig.botName}</h1>
            <p>{chatbotConfig.tagline}</p>
          </div>
          
          {/* Kanan: Tombol Chat Baru */}
          <div className="header-right">
            <button className="clear-btn" type="button" onClick={handleClear}>
              💬 Chat Baru
            </button>
          </div>
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