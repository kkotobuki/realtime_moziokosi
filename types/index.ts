// トランスクリプトエントリー
export interface TranscriptEntry {
  id: string;
  timestamp: Date;
  text: string;
  sessionId: string;
  confidence?: number;
}

// 会議情報
export interface MeetingInput {
  purpose: string;
  agenda: string[];
}

// オーディオセッション
export interface AudioSession {
  sessionId: string;
  buffer: Buffer;
  isActive: boolean;
  lastActivity: Date;
  language: string;
  mode: string;
  bufferStartTime: Date;
  lastPartialTime?: number;
  minTranscribeDurationSec: number;
  sheetsRowNumber?: number;
  sheetsAccumulatedText?: string;
  meetingInput?: MeetingInput;
}

// STT結果
export interface TranscriptionResult {
  text: string;
  confidence?: number;
  duration?: number;
}

// マーメイド図生成結果
export interface MermaidResult {
  mermaidCode: string;
  diagramType: string;
}

// 決定事項
export interface Decision {
  id: string;
  content: string;
  timestamp: Date;
  relatedAgendaItems: string[];
  confidence: number;
}

// 決定事項抽出結果
export interface DecisionExtractResult {
  decisions: Decision[];
  summary: string;
  extractedAt: Date;
}
