# OpenSSL 3.x エラー対応ガイド

## エラー内容

```
Speech ended for session: session_1763885431775_ssseq
Failed to update/append transcript: Error: error:1E08010C:DECODER routines::unsupported
    at ignore-listed frames {
  opensslErrorStack: [Array],
  library: 'DECODER routines',
  reason: 'unsupported',
  code: 'ERR_OSSL_UNSUPPORTED'
}
```

## 原因

OpenSSL 3.x では、一部の古い暗号化アルゴリズム（MD5、MD4、DES、RC2など）がデフォルトで無効化されています。このエラーは、Google Sheets APIの秘密鍵処理時に発生している可能性が高いです。

## 実施した対策

### 1. 依存関係のクリーンインストール
```bash
rm -rf node_modules package-lock.json
npm install
```

### 2. エラーハンドリングの改善
`lib/services/google-sheets.ts` で詳細なエラー情報を出力するように改善しました。

### 3. Google Sheets 秘密鍵の確認

`.env` ファイルで設定されている `GOOGLE_SHEETS_PRIVATE_KEY` が正しい形式であることを確認してください。

#### 正しい形式の例:
```env
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANB...\n-----END PRIVATE KEY-----\n"
```

## 解決方法

### 方法1: 秘密鍵の再生成（推奨）

Google Cloud Consoleで新しいサービスアカウントキーを生成し直します：

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. **IAMと管理** → **サービスアカウント** を選択
3. 該当のサービスアカウントを選択
4. **鍵** タブ → **鍵を追加** → **新しい鍵を作成**
5. **JSON形式** を選択してダウンロード
6. ダウンロードしたJSONファイルから `private_key` と `client_email` を `.env` にコピー

### 方法2: レガシープロバイダーを有効化（一時的）

Node.jsの環境変数で一時的にレガシーアルゴリズムを有効化：

```bash
export NODE_OPTIONS="--openssl-legacy-provider"
npm run dev
```

または `package.json` のスクリプトを変更：

```json
{
  "scripts": {
    "dev": "NODE_OPTIONS='--openssl-legacy-provider' tsx server.ts",
    "start": "NODE_OPTIONS='--openssl-legacy-provider' NODE_ENV=production tsx server.ts"
  }
}
```

⚠️ **注意**: この方法はセキュリティリスクがあるため、本番環境では推奨されません。

### 方法3: Node.jsバージョンの調整

Node.js 16 LTS（OpenSSL 1.1.1を使用）にダウングレード：

```bash
nvm install 16
nvm use 16
npm install
npm run dev
```

## 確認方法

修正後、以下のコマンドでサーバーを起動して動作確認：

```bash
npm run dev
```

ログに以下が表示されれば正常です：
```
Google Sheets API initialized successfully
```

## トラブルシューティング

### まだエラーが発生する場合

1. `.env` ファイルの `GOOGLE_SHEETS_PRIVATE_KEY` が正しく設定されているか確認
2. 秘密鍵内の `\n` が適切にエスケープされているか確認
3. サービスアカウントに適切な権限（Sheets API編集権限）が付与されているか確認
4. より詳細なエラーログを確認して、具体的なエラー箇所を特定

### 参考情報

- [Google Auth Library - Node.js](https://github.com/googleapis/google-auth-library-nodejs)
- [Node.js OpenSSL 3.0 breaking changes](https://nodejs.org/en/blog/release/v17.0.0)
- [OpenSSL 3.0 Migration Guide](https://www.openssl.org/docs/man3.0/man7/migration_guide.html)
