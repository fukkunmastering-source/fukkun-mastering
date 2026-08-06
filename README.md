# FUKKUN MASTERING

手元のWAVまたはMP3を解析し、FFmpegでマスタリング済みWAVを作成する個人用Webアプリです。

## 現在の対応範囲

- 音源解析（音量、ピーク、帯域、ダイナミクス）
- 5秒単位のセクション解析と保護
- EQ、ダイナミックEQ、コンプレッサー
- 2パスLoudnormとリミッター
- 24bit WAV出力
- 元音源と完成音源のA/B再生
- APIキー未設定時の計算ベース設定
- 外部音声処理の5分タイムアウト
- 24時間を過ぎた生成WAVの自動削除

参考曲は画面から選択できますが、解析とマスタリングへの反映は未実装です。

## 必要環境

- Node.js
- Python 3
- NumPy
- FFmpeg（`ffmpeg` コマンドを実行できること）

OpenAIを使った設定生成は任意です。使用する場合のみ `OPENAI_API_KEY` を環境変数に設定します。

## 開発確認

```bash
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

開発環境の制約でTurbopackを利用できない場合は、`npx next build --webpack` で本番ビルドを確認できます。
