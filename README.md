## Gork Imagine Enhancer

`https://grok.com/imagine*` の挙動をすばやく観察・計測するためのシンプルな Chrome 拡張です。

### はじめかた
1. `chrome://extensions` を開き、デベロッパーモードを ON にする。
2. **パッケージ化されていない拡張機能を読み込む** で本リポジトリを選択する。
3. Grok Imagine へアクセスし、拡張アイコンからポップアップを開いて動作を確認する。

### 構成
- `src/background.js` — メッセージルーティングとリクエスト監視を担うサービスワーカー。
- `src/content/index.js` — ページにロガーを注入し、DOM／タイマー／WebSocket をフックするコンテンツスクリプト。
- `ui/popup.html` — DOM 再スキャン、ログ更新、履歴消去を行うポップアップ UI。

### ドキュメント
- `docs/logger.md` — オーバーレイとポップアップの詳細
- `docs/websocket.md` — WebSocket の監視・ブロック仕様
- `docs/testing.md` — 動作確認手順とトラブル対処
