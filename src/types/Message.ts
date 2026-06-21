export interface MessageSource {
  id: string;
  title: string;
  section: string;
  source: string;
}

export interface Message {
  role: "user" | "model";
  content: string;
  sources?: MessageSource[];
  showDownloads?: boolean;
}

export interface BotReply {
  content: string;
  sources: MessageSource[];
  showDownloads?: boolean;
}

export interface ChatConfig {
  systemInstruction: string;
  botName: string;
  welcomeMessage: string;
  tagline: string;
  inputPlaceholder: string;
  quickPrompts: string[];
}
