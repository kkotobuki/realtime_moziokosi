import { AudioSession } from '@/types';

export class AudioBufferService {
  private sessions: Map<string, AudioSession> = new Map();
  private readonly SESSION_TIMEOUT_MS = 30000;
  private readonly MAX_BUFFER_SIZE = 1024 * 1024; // 1MB
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // セッションクリーンアップタイマー
    this.cleanupInterval = setInterval(() => this.cleanupSessions(), 10000);
  }

  createSession(
    sessionId: string,
    language: string = 'ja',
    mode: string = 'normal',
    minTranscribeDurationSec: number = 2.0,
    meetingInput?: { purpose: string; agenda: string[] },
  ): void {
    console.log(`Creating session: ${sessionId}`);
    this.sessions.set(sessionId, {
      sessionId,
      buffer: Buffer.alloc(0),
      isActive: true,
      lastActivity: new Date(),
      language,
      mode,
      bufferStartTime: new Date(),
      minTranscribeDurationSec,
      sheetsRowNumber: undefined,
      sheetsAccumulatedText: '',
      meetingInput,
    });
  }

  appendAudio(sessionId: string, audioData: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return;
    }

    if (session.buffer.length + audioData.length > this.MAX_BUFFER_SIZE) {
      console.warn(`Buffer size exceeded for session: ${sessionId}`);
      return;
    }

    session.buffer = Buffer.concat([session.buffer, audioData]);
    session.lastActivity = new Date();
  }

  getBuffer(sessionId: string): Buffer | null {
    const session = this.sessions.get(sessionId);
    return session ? session.buffer : null;
  }

  clearBuffer(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.buffer = Buffer.alloc(0);
      session.bufferStartTime = new Date();
      session.lastActivity = new Date();
    }
  }

  getSession(sessionId: string): AudioSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<AudioSession>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      session.lastActivity = new Date();
    }
  }

  deleteSession(sessionId: string): void {
    console.log(`Deleting session: ${sessionId}`);
    this.sessions.delete(sessionId);
  }

  getBufferDuration(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;

    const sampleRate = 16000;
    const bytesPerSample = 2;
    const samples = session.buffer.length / bytesPerSample;
    return samples / sampleRate;
  }

  getAllSessions(): Array<{ sessionId: string }> {
    return Array.from(this.sessions.values()).map(s => ({ sessionId: s.sessionId }));
  }

  private cleanupSessions(): void {
    const now = new Date().getTime();
    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceLastActivity = now - session.lastActivity.getTime();
      if (timeSinceLastActivity > this.SESSION_TIMEOUT_MS) {
        console.log(`Cleaning up inactive session: ${sessionId}`);
        this.deleteSession(sessionId);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// シングルトンインスタンス
export const audioBufferService = new AudioBufferService();
