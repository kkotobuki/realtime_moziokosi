# リアルタイム文字起こし with マーメイド図自動生成 (統合版)

Next.js単一プロジェクトで構成されたリアルタイム音声認識と文字起こし履歴から自動でマーメイド図を生成するシステムです。

## 特徴

- **単一プロジェクト構成**: Next.jsのカスタムサーバーでWebSocketとAPI Routesを統合
- **完全TypeScript化**: 型安全な開発環境
- **リアルタイム文字起こし**: VAD(音声活動検出)による自動発話検知とGroq Whisper APIによる高精度STT
- **履歴管理**: ブラウザメモリとGoogle Sheetsへの永続保存
- **マーメイド図自動生成**: Gemini APIを活用した文字起こし内容からの図解化
- **セッション管理**: 「新しく始める」ボタンでセッションをリセット

## プロジェクト構成

```
unified/
├── app/                        # Next.js App Router
│   ├── page.tsx               # メインページ
│   ├── layout.tsx             # レイアウト
│   ├── globals.css            # グローバルスタイル
│   └── api/
│       └── mermaid/
│           └── route.ts       # マーメイド図生成API
├── components/
│   └── MermaidViewer.tsx      # マーメイド図表示
├── lib/                        # バックエンドロジック
│   ├── socket-handler.ts      # WebSocketハンドラー
│   ├── services/
│   │   ├── groq-stt.ts       # Groq STT Service
│   │   ├── google-sheets.ts  # Google Sheets Service
│   │   └── gemini-mermaid.ts # Gemini Service
│   └── audio/
│       └── audio-buffer.ts   # オーディオバッファ管理
├── types/
│   └── index.ts               # 型定義
├── server.js                   # カスタムサーバー(WebSocket用)
├── package.json
├── tsconfig.json
└── .env.example
```

## 必要な環境

- Node.js >= 18.0.0
- npm >= 9.0.0

## セットアップ

### 1. 依存関係のインストール

```bash
cd unified
npm install
```

### 2. 環境変数の設定

環境変数保存フォルダ
```bash
https://drive.google.com/drive/folders/1BhDQG-wbT78UkORWoFFE1Z2TAA9JGdwV?usp=drive_link
```

`.env.example` を参考に `.env` を作成してください。

```bash
cp .env.example .env
```

`.env` を編集して以下の値を設定:

```env
# Groq API (STT用)
GROQ_API_KEY=your_groq_api_key_here

# Google Sheets API (サービスアカウント方式)
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here

# Gemini API (マーメイド図生成)
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS設定
CORS_ORIGIN=http://localhost:3000
```

## 画面から聞こえる音声を文字起こしするために必要な設定

```bash
https://note.com/aimasterroad/n/nc80e25e4e1c5
```

## 起動方法

### 開発モード(推奨)

```bash
npm run dev
```

### プロダクションビルド

```bash
npm run build
npm start
```

## アクセス

- **アプリケーション**: http://localhost:3000
- **WebSocket**: ws://localhost:3000/ws/stt

## 使い方

1. ブラウザで http://localhost:3000 にアクセス
2. 「開始」ボタンをクリックしてマイクを有効化
3. 話しかけると自動で音声を検知し、文字起こしを実行
4. 左側に文字起こし履歴が蓄積されます
5. 「マーメイド図を生成」ボタンで履歴からマーメイド図を生成
6. 「新しく始める」で履歴をクリアして新規セッション開始

## アーキテクチャ

### 統合の利点

- **シンプルな構成**: クライアントとサーバーを分離する必要がなくなり、管理が容易
- **型の共有**: TypeScriptの型定義を共有でき、開発効率が向上
- **デプロイの簡略化**: 単一のプロジェクトとしてデプロイ可能
- **開発の効率化**: ホットリロードが統合され、開発体験が向上

### カスタムサーバー

Next.jsのカスタムサーバー(`server.js`)を使用して、Socket.IOサーバーとNext.jsを統合しています。これにより、WebSocket通信とHTTP通信を同一ポートで提供できます。

### API Routes

Next.js App RouterのAPI Routesを使用して、マーメイド図生成などのREST APIを提供しています。

## トラブルシューティング

### マイクが動作しない
- ブラウザのマイク許可を確認してください
- HTTPS環境またはlocalhost以外では動作しない場合があります

### Google Sheetsに保存されない
- サービスアカウントのメールアドレスとシートが共有されているか確認
- `GOOGLE_SHEETS_PRIVATE_KEY` の改行文字 `\n` が正しくエスケープされているか確認

### マーメイド図が生成されない
- Gemini APIキーが正しく設定されているか確認
- 文字起こし履歴が存在するか確認

### WebSocket接続エラー
- サーバーが起動しているか確認
- ポート番号(3000)が競合していないか確認

## 技術スタック

- **Next.js 16** (React 19)
- **TypeScript**
- **TailwindCSS**
- **Socket.io**: WebSocket通信
- **Socket.io Client**: WebSocketクライアント
- **Mermaid.js**: マーメイド図レンダリング
- **Groq API**: Whisper Large v3 Turbo STT
- **Google Sheets API v4**: 履歴永続保存
- **Gemini API**: マーメイド図生成 (gemini-2.5-pro)

## ライセンス

MIT

## 参考資料

- [Next.js Documentation](https://nextjs.org/docs)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Google Sheets API v4](https://developers.google.com/sheets/api)
- [Google Generative AI SDK](https://www.npmjs.com/package/@google/generative-ai)
- [Mermaid.js Documentation](https://mermaid.js.org/)
# realtime_moziokosi
