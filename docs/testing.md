## 検証チェックリスト

1. **拡張を読み込む** — `chrome://extensions` で Developer Mode を ON にし、**Load unpacked** からこのリポジトリを指定します。
2. **`/imagine` にアクセス** — DevTools Console に `[Grok Imagine] Page visit` が出力され、任意のボタン操作で `GROK_TIMING_EVENT` が記録されることを確認します。
3. **`/imagine/post/{uuid}` に遷移** — Console に `websocket-block-enabled` が表示され、Network パネルの WebSocket が即座に閉じることを確認します。
4. **`/imagine` へ戻る** — Console に `websocket-block-disabled` が表示され、WebSocket が再接続することを確認します。
5. **ポップアップ表示** — ポップアップを開き `Ready` → `Idle` の表示切り替えだけが行われ、追加操作が不要であることを確認します。

## トラブルシュート

- ログが表示されない場合は URL が `https://grok.com/imagine*` に一致しているか、CSP によりコンテンツスクリプトがブロックされていないかを確認してください。
- WebSocket が常時ブロックされる場合は拡張をリロードして declarative ルールを再生成してください。
