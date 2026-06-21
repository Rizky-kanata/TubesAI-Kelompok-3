export interface MessageSource {
  id: string;
  title: string;
  section: string;
  source: string;
}

export interface DownloadableFile {
  id: string;
  title: string;
  source: string;
  fileName: string;
  fileType?: string;
  fileData?: string;
  fileUrl?: string;
}

export interface Message {
  role: "user" | "model";
  content: string;
  sources?: MessageSource[];
  showDownloads?: boolean;
  downloads?: DownloadableFile[];
}

export interface BotReply {
  content: string;
  sources: MessageSource[];
  showDownloads?: boolean;
  downloads?: DownloadableFile[];
}

export interface ChatConfig {
  systemInstruction: string;
  botName: string;
  welcomeMessage: string;
  tagline: string;
  inputPlaceholder: string;
  quickPrompts: string[];
}
