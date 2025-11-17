## Grok Imagine Enhancer

Grok Imagine（`https://grok.com/imagine*`）専用の軽量 Chrome 拡張機能です。Imagine 画面での WebSocket 強制切断による描画抑止や、投稿ページの強調表示、操作イベントの監視などを自動化します。

### 主な機能
- プロンプトの入力履歴
- 詳細ページでの類似画像生成機能を強制停止
- 生成画面でブロックされた項目に赤枠を表示

### インストール方法

#### 1. ソースコードを取得
1. このリポジトリのトップページで **`<> Code`** ボタンをクリック
2. **`Download ZIP`** を選択して保存
3. ZIP を解凍し、任意のフォルダーに配置

#### 2. Chrome へ読み込み
1. Chrome で `chrome://extensions` を開く
2. 右上の **デベロッパーモード** を ON にする
3. **パッケージ化されていない拡張機能を読み込む** をクリック
4. 解凍したフォルダー（`manifest.json` が含まれるディレクトリ）を選択

#### 3. 動作確認
1. `https://grok.com/imagine` を開く
2. 想像ページで投稿フォームを操作すると、バックグラウンドのログとテキストエリア上部の履歴オーバーレイが更新される
3. 履歴項目をクリックすると入力欄へ反映され、消去ボタンでログから即時削除される

### ファイル構成
- `manifest.json` - 拡張機能のエントリーポイント
- `src/background.js` - declarativeNetRequest による WebSocket ブロックやタブ連係
- `src/content/index.js` - Imagine ページの検知、イベント記録、プロンプト履歴オーバーレイ
- `ui/popup.html` - シンプルなポップアップ UI
- `docs/` - WebSocket 仕様や手動テスト手順

### 開発メモ
- ビルド工程は不要、ファイルを編集してそのまま Chrome で再読み込み
- 動作確認時は `chrome://extensions` で拡張機能をリロードし、Imagine タブを更新
- 追加でテストツールを導入する場合は `tests/` ディレクトリ配下に配置し、本 README に追記してください
