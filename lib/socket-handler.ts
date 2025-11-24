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
    socket.on('audio', async (audioData: Buffer) => {
      // クライアントから送信されたセッションIDを取得
      const sessions = audioBufferService.getAllSessions();
      if (sessions.length === 0) return;

      const session = sessions[0];
      audioBufferService.appendAudio(session.sessionId, audioData);
    });

    // 発話終了
    socket.on('speech_ended', async (data: { sessionId: string; timestamp: number }) => {
      console.log(`Speech ended for session: ${data.sessionId}`);

      try {
        const buffer = audioBufferService.getBuffer(data.sessionId);
        if (!buffer || buffer.length === 0) {
          console.warn('No audio buffer found');
          return;
        }

        const session = audioBufferService.getSession(data.sessionId);
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
            data.sessionId,
          );

          // クライアントに結果を送信
          socket.emit('final', {
            type: 'final',
            text: result.text,
            sessionId: data.sessionId,
            isFinal: true,
            bufferDuration: duration,
            confidence: result.confidence,
          });

          // Google Sheetsに保存(非同期)
          saveToSheets(data.sessionId, result.text).catch((error) => {
            console.error('Failed to save to sheets:', error);
          });
        }

        // バッファをクリア
        audioBufferService.clearBuffer(data.sessionId);
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

      // Sheetsのセッション管理をリセット
      await googleSheetsService.resetSession(data.sessionId);

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
): Promise<void> {
  const session = audioBufferService.getSession(sessionId);
  if (!session) return;

  const isNewSession = session.sheetsRowNumber === undefined;

  await googleSheetsService.updateOrAppendTranscript(
    sessionId,
    text,
    isNewSession,
  );
}
