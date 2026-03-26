# Atlantean Mermaid (Bitbucket & Confluence)

Bitbucket のプルリクエストやコメント、および Confluence のページ内で **Mermaid** 記法のコードブロックを自動的に図解（ダイアグラム）としてレンダリングする Chrome 拡張機能です。

## 主な機能
- **Bitbucket 対応:** プルリクエストの説明、コメント、README 内の `mermaid` 言語指定されたコードブロックを検出。
- **Confluence 対応:** Confluence Cloud の「コードブロック」マクロ内の Mermaid 記法を検出。
- **リアルタイム描画:** ページ内容が動的に書き換わった際も、自動的に再レンダリングを試みます（MutationObserver を使用）。
- **コード切り替え:** レンダリングされた図の横にある `</> Code` ボタンをクリックすることで、図と元のソースコードを自由に切り替え可能。
- **スムーズな体験:** 描画前に生のコードブロックを一瞬で隠し、ローダーを表示することで、ユーザーが生のコードを見なくて済むように配慮されています。

## インストール方法（開発者モード）
1. このリポジトリをクローンまたは ZIP でダウンロードします。
2. Google Chrome を開き、 `chrome://extensions/` にアクセスします。
3. 右上の「デベロッパー モード」をオンにします。
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、このリポジトリのルートディレクトリを選択します。

## プロジェクト構成
- `manifest.json`: 拡張機能の設定と権限（Bitbucket と Confluence のドメインを指定）。
- `content-script.js`: 描画ロジック本体。サイト判定、コード抽出、レンダリング、UI制御を行います。
- `styles.css`: ローダー、エラーバッジ、切り替えボタンなどのスタイル定義。
- `vendor/`: `mermaid.min.js` 本体が含まれています。
- `icons/`: 拡張機能のアイコンリソース。

## クレジット
本拡張機能は、Bitbucket 用の Mermaid 表示機能をベースに、Confluence への対応や機能改善を施した拡張版です。
- Mermaid library: [https://mermaid.js.org/](https://mermaid.js.org/)

## 自動ビルド (GitHub Actions)
GitHub にプッシュすると、GitHub Actions が自動的に `master` ブランチから拡張機能の ZIP パッケージ (`mermaid-atlassian-extension.zip`) を作成し、Artifacts として保存します。
