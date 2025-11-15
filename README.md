## Gork Imagine Enhancer

Grok Imagine の利便性向上を目的とした Chrome 拡張機能です。`https://grok.com/imagine*` に限定して動作し、ポスト詳細ページで動く WebSocket を遮断して自動画像生成を抑止します。

### 使い方
1. `chrome://extensions` を開き、デベロッパーモードを ON にします。
2. **パッケージ化されていない拡張機能を読み込む** を選び、このリポジトリ直下を指定します。
3. Grok Imagine を開き、ポスト詳細ページへ遷移すると WebSocket が自動的に切断され、画像生成が止まることを確認します。

### 主な構成
- `src/background.js` — declarativeNetRequest で WebSocket をブロックしつつ、タブへ WebSocket フックを注入します。
- `src/content/index.js` — ページ遷移検知、クリック/タイマー計測、ポストページでの強制切断トリガーを担います。
- `ui/popup.html` — DOM 再スキャンや背景イベントログの取得・消去を行う簡易 UI です。

### 追加ドキュメント
- `docs/websocket.md` — WebSocket ロギング/ブロッキング/フック注入の詳細。
- `docs/testing.md` — 手動検証フローとトラブルシュート。
