import { Server as SocketIOServer, Socket } from 'socket.io';
import { audioBufferService } from './audio/audio-buffer';
import { groqSTTService } from './services/groq-stt';
import { googleSheetsService } from './services/google-sheets';

export function setupSocketHandlers(io: SocketIOServer) {
  const sttNamespace = io.of('/ws/stt');

  sttNamespace.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // 接続時
    socket.on('connect', () => {
      console.log(`Socket connected: ${socket.id}`);
    });

    // 切断時
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // セッション開始
    socket.on('start', async (data: {
      sessionId: string;
      lang: string;
      params: any;
    }) => {
      console.log(`Session started: ${data.sessionId}`);

      const mode = data.params?.mode || 'normal';
      const minTranscribeDurationSec =
        data.params?.minTranscribeDurationSec || 2.0;
      const meetingInput = data.params?.meetingInput;

      audioBufferService.createSession(
        data.sessionId,
        data.lang,
        mode,
        minTranscribeDurationSec,
        meetingInput,
      );

      socket.emit('session_started', {
        type: 'session_started',
        sessionId: data.sessionId,
        params: {
          threshold: data.params?.threshold || 1.6,
          minTranscribeDurationSec,
        },
      });
    });

    // オーディオデータ受信
    socket.on('audio', async (audioData: Buffer | { buffer: ArrayBuffer; source: string; sessionId: string }) => {
      let buffer: Buffer;
      let source: string = 'microphone';
      let sessionId: string | undefined;

      // 新しい形式(オブジェクト)か旧形式(バッファ)かを判定
      if (Buffer.isBuffer(audioData)) {
        buffer = audioData;
        // 旧形式の場合はセッションを取得
        const sessions = audioBufferService.getAllSessions();
        if (sessions.length === 0) return;
        sessionId = sessions[0].sessionId;
      } else {
        buffer = Buffer.from(audioData.buffer);
        source = audioData.source || 'microphone';
        sessionId = audioData.sessionId;
      }

      if (!sessionId) return;

      // セッションIDに音声ソースを追加して別々に管理
      const bufferSessionId = `${sessionId}_${source}`;

      // セッションが存在しない場合は作成
      let session = audioBufferService.getSession(bufferSessionId);
      if (!session) {
        const baseSession = audioBufferService.getSession(sessionId);
        if (baseSession) {
          audioBufferService.createSession(
            bufferSessionId,
            baseSession.language,
            baseSession.mode,
            baseSession.minTranscribeDurationSec,
            baseSession.meetingInput,
          );
        } else {
          return;
        }
      }

      audioBufferService.appendAudio(bufferSessionId, buffer);
    });

    // 発話終了
    socket.on('speech_ended', async (data: { sessionId: string; timestamp: number; source?: string }) => {
      const source = data.source || 'microphone';
      const bufferSessionId = `${data.sessionId}_${source}`;

      console.log(`Speech ended for session: ${data.sessionId}, source: ${source}`);

      try {
        const buffer = audioBufferService.getBuffer(bufferSessionId);
        if (!buffer || buffer.length === 0) {
          console.warn('No audio buffer found');
          return;
        }

        const session = audioBufferService.getSession(bufferSessionId);
        if (!session) {
          console.warn('Session not found');
          return;
        }

        // STT処理
        const result = await groqSTTService.transcribe(
          buffer,
          session.language,
          session.meetingInput,
        );

        if (result.text) {
          const duration = audioBufferService.getBufferDuration(
            bufferSessionId,
          );

          // クライアントに結果を送信
          socket.emit('final', {
            type: 'final',
            text: result.text,
            sessionId: data.sessionId,
            isFinal: true,
            bufferDuration: duration,
            confidence: result.confidence,
            source: source,
          });

          // Google Sheetsに保存(非同期) - 未設定のためコメントアウト
          // saveToSheets(data.sessionId, result.text, source).catch((error) => {
          //   console.error('Failed to save to sheets:', error);
          // });
        }

        // バッファをクリア
        audioBufferService.clearBuffer(bufferSessionId);
      } catch (error) {
        console.error('Error processing speech:', error);
        socket.emit('error', {
          type: 'error',
          message: 'STT処理に失敗しました',
          sessionId: data.sessionId,
        });
      }
    });

    // セッション終了
    socket.on('end', async (data: { sessionId: string }) => {
      console.log(`Session ended: ${data.sessionId}`);
      audioBufferService.deleteSession(data.sessionId);
    });

    // Ping/Pong
    socket.on('ping', (data: { timestamp: number }) => {
      socket.emit('pong', {
        type: 'pong',
        timestamp: data.timestamp,
        serverTime: Date.now(),
      });
    });

    // セッションリセット
    socket.on('reset_session', async (data: { sessionId: string }) => {
      console.log(`Session reset requested: ${data.sessionId}`);

      // Sheetsのセッション管理をリセット - 未設定のためコメントアウト
      // await googleSheetsService.resetSession(data.sessionId);

      // 新しいセッションを作成
      const session = audioBufferService.getSession(data.sessionId);
      if (session) {
        audioBufferService.updateSession(data.sessionId, {
          sheetsRowNumber: undefined,
          sheetsAccumulatedText: '',
        });
      }

      socket.emit('session_reset', {
        type: 'session_reset',
        sessionId: data.sessionId,
      });
    });
  });

  console.log('✅ Socket.IO handlers configured');
}

async function saveToSheets(
  sessionId: string,
  text: string,
  source: string,
): Promise<void> {
  const bufferSessionId = `${sessionId}_${source}`;
  const session = audioBufferService.getSession(bufferSessionId);
  if (!session) return;

  const isNewSession = session.sheetsRowNumber === undefined;

  // 音声ソースをテキストに追加
  const textWithSource = `[${source === 'microphone' ? 'マイク' : 'タブ'}] ${text}`;

  await googleSheetsService.updateOrAppendTranscript(
    bufferSessionId,
    textWithSource,
    isNewSession,
  );
}
