# Arcadia AI Textbook

FirebaseとOpenAI Responses APIで、日本語のAI教科書を生成・保存するReactアプリです。生成処理はCloud Functionsで非同期実行され、Firestoreのリアルタイム購読で進捗を表示します。

## セットアップ

1. Firebase Consoleでプロジェクトを作成し、Authenticationの「匿名」と「Google」、Firestore、App Check（reCAPTCHA Enterprise）を有効化します。BlazeプランはCloud Functionsの外部API通信に必要です。
2. `.firebaserc.example`を`.firebaserc`へコピーしてProject IDを設定します。
3. `.env.example`を`.env.local`へコピーし、Firebase Web Appの設定値を入力します。ローカルEmulator利用時は`VITE_USE_FIREBASE_EMULATORS=true`にします。
4. 依存関係をインストールします。

   ```bash
   npm install
   npm --prefix functions install
   ```

5. OpenAI APIキーと利用モデルをFirebaseへ登録します。

   ```bash
   firebase functions:secrets:set OPENAI_API_KEY
   printf 'OPENAI_MODEL=gpt-5-mini\n' > functions/.env
   ```

   `OPENAI_MODEL`は`functions/.env`で変更できます。APIキーはフロントエンドの環境変数へ入れないでください。`.env`ファイルはコミットしません。

## ローカル開発

ターミナルを2つ使い、EmulatorとViteを起動します。

```bash
npm run functions:build
npm run emulators
```

```bash
npm run dev
```

EmulatorではApp Checkの検証が自動的に緩和されます。本番では`VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`を設定してください。

## デプロイ

```bash
npm run deploy
```

デプロイ前に`npm run lint`、`npm run build`、`npm run functions:build`を実行してください。
