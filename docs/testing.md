## 検証チェックリスト

1. **拡張を読み込む** — `chrome://extensions` で Developer Mode を ON にし、**Load unpacked** からこのリポジトリを指定します。
2. **`/imagine` にアクセス** — DevTools Console に `[Grok Imagine] Page visit` が出力され、任意のボタンを操作した後にポップアップの `Refresh log` でイベントが取得できることを確認します。
3. **`/imagine/post/{uuid}` に遷移** — Console に `websocket-block-enabled` が表示され、Network パネルの WebSocket が即座に閉じることを確認します。
4. **`/imagine` へ戻る** — Console に `websocket-block-disabled` が表示され、WebSocket が再接続することを確認します。
5. **ポップアップ操作** — `Rescan DOM` / `Refresh log` / `Clear log` の各ボタンがエラーなく完了し、ステータスメッセージが適切に更新されることを確認します。

## トラブルシュート

- ログが表示されない場合は URL が `https://grok.com/imagine*` に一致しているか、CSP によりコンテンツスクリプトがブロックされていないかを確認してください。
- WebSocket が常時ブロックされる場合は拡張をリロードして declarative ルールを再生成してください。
- `Refresh log` が空のままの場合は `chrome://extensions` → 対象拡張 → Service Worker のコンソールでエラーが出ていないか確認してください。
