import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatInput from "../components/ChatInput";
import ChatWindow from "../components/ChatWindow";
import chatbotConfig from "../config/chatbotConfig";
import { sendMessage } from "../services/groqService";
import { logout } from "../services/authService";
import type { Message } from "../types/Message";
import "../App.css";

function ChatbotUser() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
        content: "Maaf, layanan model sedang tidak bisa dihubungi. Coba lagi beberapa saat lagi.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUserMessage = async (
    messageIndex: number,
    content: string
  ) => {
    if (isLoading || !content.trim()) {
      return;
    }

    const previousMessages = messages.slice(0, messageIndex);
    const editedMessage: Message = { role: "user", content: content.trim() };
    const nextMessages = [...previousMessages, editedMessage];

    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const reply = await sendMessage(editedMessage.content, previousMessages);
      const botMessage: Message = {
        role: "model",
        content: reply.content,
        sources: reply.sources,
      };
      setMessages([...nextMessages, botMessage]);
    } catch {
      const errorMessage: Message = {
        role: "model",
        content:
          "Maaf, layanan model sedang tidak bisa dihubungi. Coba lagi beberapa saat lagi.",
      };
      setMessages([...nextMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => setMessages([]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <main className="chat-panel">
        <header className="chat-header">
          <div className="header-left"></div>

          <div className="header-center">
            <div className="status-line">
              <span className="status-dot" aria-hidden="true" />
              SIAP MENJAWAB
            </div>
            <h1>{chatbotConfig.botName}</h1>
            <p>{chatbotConfig.tagline}</p>
          </div>

          <div className="header-right">
            <button className="clear-btn" type="button" onClick={handleClear}>
              💬 Chat Baru
            </button>
            <button className="clear-btn" type="button" onClick={handleLogout}>
              🚪 Logout
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

        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          onEditUserMessage={handleEditUserMessage}
        />
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          placeholder={chatbotConfig.inputPlaceholder}
        />
      </main>
    </div>
  );
}

export default ChatbotUser;
