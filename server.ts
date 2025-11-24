// 環境変数の読み込み（他のインポートより先に実行）
import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './lib/socket-handler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '/', true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Socket.IOサーバーの初期化
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || `http://localhost:${port}`,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Socket.IOハンドラーの設定
  setupSocketHandlers(io);

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`🚀 Server is running on: http://${hostname}:${port}`);
      console.log(`🎙️  WebSocket endpoint: ws://${hostname}:${port}/ws/stt`);
    });
});

