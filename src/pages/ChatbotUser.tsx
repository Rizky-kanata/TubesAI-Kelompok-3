import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatInput from "../components/ChatInput";
import ChatWindow from "../components/ChatWindow";
import chatbotConfig from "../config/chatbotConfig";
import { sendMessage } from "../services/groqService";
import { logout } from "../services/authService";
import type { Message } from "../types/Message";
import "../App.css";

const faqPrompts = [
  {
    label: "Proposal",
    question: "Bagaimana cara mengajukan proposal kegiatan?",
    prompt:
      "Bagaimana cara mengajukan proposal kegiatan? Jelaskan alur, syarat, template, dan link jika tersedia.",
  },
  {
    label: "LPJ",
    question: "Apa saja lampiran untuk LPJ kegiatan?",
    prompt:
      "Apa saja lampiran untuk LPJ kegiatan? Jelaskan syarat, alur, dan link jika tersedia.",
  },
  {
    label: "Template",
    question: "Di mana template proposal dan LPJ?",
    prompt:
      "Di mana template proposal dan LPJ? Tampilkan link template jika tersedia pada dokumen.",
  },
  {
    label: "TAK",
    question: "Bagaimana cara mengurus TAK?",
    prompt:
      "Bagaimana cara mengurus TAK berdasarkan dokumen yang tersedia?",
  },
  {
    label: "SSC",
    question: "Bagaimana alur menghubungi SSC?",
    prompt:
      "Bagaimana alur menghubungi SSC berdasarkan dokumen yang tersedia?",
  },
  {
    label: "Sertifikat",
    question: "Bagaimana pengajuan sertifikasi kegiatan?",
    prompt:
      "Bagaimana alur pengajuan sertifikasi kegiatan dan dokumen apa saja yang dibutuhkan?",
  },
];

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
        showDownloads: reply.showDownloads,
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
        showDownloads: reply.showDownloads,
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

        <section className="faq-float-panel" aria-label="Pertanyaan FAQ">
          <div className="faq-panel-title">
            <span>FAQ</span>
            <strong>Pertanyaan umum</strong>
          </div>

          <div className="faq-floating-list">
            {faqPrompts.map((item) => (
              <button
                className="faq-floating-card"
                disabled={isLoading}
                key={item.question}
                onClick={() => handleSend(item.prompt)}
                type="button"
              >
                <span className="faq-card-tag">{item.label}</span>
                <span className="faq-card-question">{item.question}</span>
              </button>
            ))}
          </div>
        </section>

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
