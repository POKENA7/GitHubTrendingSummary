# GitHub Trending Daily 設計書

## 目的

`docs/SPEC.md` に定義された MVP を実装するための設計をまとめる。

GitHub Trending Daily の上位10リポジトリを毎日取得し、GitHub Copilot CLI で日本語要約を生成して Discord Webhook へ通知する。

対象ユーザーは開発者本人のみのため、構成はシンプルに保ち、運用コスト0円を優先する。

## 対象範囲

### 実装対象

- GitHub Actions の cron 実行
- GitHub Trending Daily 上位10件の取得
- 各リポジトリの README 先頭3000文字の取得
- GitHub Copilot CLI による日本語要約生成
- Discord Webhook への通知
- Discord の文字数上限を考慮した分割送信
- MVP に必要なテスト
- Linter / Formatter / Build のチェック

### 実装対象外

- データ保存
- Web UI
- ユーザー別設定
- 興味カテゴリによる優先度付け
- 関連度スコアリング
- 通知履歴管理

## システム構成

```text
GitHub Actions
  ↓
TypeScript CLI
  ↓
GitHub Trending HTML 取得
  ↓
上位10リポジトリを抽出
  ↓
GitHub API または raw.githubusercontent.com から README 取得
  ↓
GitHub Copilot CLI で要約生成
  ↓
Discord Webhook へ分割送信
```

## 技術スタック

- Runtime: Node.js
- Language: TypeScript
- Test: Vitest
- Linter / Formatter: ESLint / Prettier
- Scheduler: GitHub Actions
- AI Summary: GitHub Copilot CLI
- Notification: Discord Webhook

## 環境変数

| 変数名                  | 用途                                                                                                | 必須 |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ---- |
| `DISCORD_WEBHOOK_URL`   | Discord Webhook 送信先 URL                                                                          | 必須 |
| `PERSONAL_ACCESS_TOKEN` | Copilot CLI 認証用の GitHub Actions secret。Copilot Requests 権限を持つ fine-grained PAT を設定する | 必須 |
| `COPILOT_GITHUB_TOKEN`  | Copilot CLI が参照する認証用環境変数。workflow 内で `secrets.PERSONAL_ACCESS_TOKEN` から設定する    | 必須 |

GitHub Copilot CLI の認証には、Copilot ライセンスを持つ GitHub ユーザーの fine-grained PAT を使う。

`PERSONAL_ACCESS_TOKEN` は GitHub Actions の repository secret として保存し、workflow 実行時に `COPILOT_GITHUB_TOKEN` へ渡す。

## ディレクトリ構成

```text
.
├── .github/
│   └── workflows/
│       └── daily.yml
├── docs/
│   ├── SPEC.md
│   └── design/
│       └── 2026-06-20-github-trending-daily-design.md
├── src/
│   ├── index.ts
│   ├── trending.ts
│   ├── readme.ts
│   ├── summarize.ts
│   ├── discord.ts
│   └── types.ts
├── test/
│   ├── trending.test.ts
│   ├── discord.test.ts
│   └── summarize.test.ts
├── package.json
├── tsconfig.json
├── eslint.config.js
└── prettier.config.js
```

## データ型

SPEC の `Repository` を基準にする。

```ts
export type Repository = {
  owner: string;
  name: string;
  url: string;
  description: string;
  language: string;
  starsToday: number;
  totalStars: number;
  topics: string[];
  readme: string;
};
```

README 取得に失敗した場合は `readme` を空文字にし、Description / Topics / Language / starsToday を使って要約を継続する。

## 処理フロー

1. `src/index.ts` をエントリポイントとして起動する。
2. `fetchTrendingRepositories()` で GitHub Trending Daily の HTML を取得する。
3. HTML から上位10件のリポジトリ情報を抽出する。
4. 各リポジトリについて README の先頭3000文字を取得する。
5. `summarizeRepository()` で Copilot CLI に SPEC のプロンプトを渡す。
6. 要約に成功したリポジトリのみ Discord 通知本文へ含める。
7. 通知本文を 1〜3件、4〜6件、7〜10件の単位で分割する。
8. `sendDiscordMessage()` で Discord Webhook へ順番に送信する。

## GitHub Trending 取得設計

### 取得先

```text
https://github.com/trending?since=daily
```

### 抽出項目

- owner
- name
- url
- description
- language
- starsToday
- totalStars

GitHub Trending ページから topics は取得できない可能性が高いため、README 取得時に GitHub API の repository endpoint から `topics` を取得する方針とする。

### 実装方針

- HTML 解析には `cheerio` を使う。
- 取得件数は抽出後に先頭10件へ制限する。
- 数値は `1,234` や `2.3k` のような表記を number に正規化する。
- Trending 取得に失敗した場合は処理を中断し、Discord へ `GitHub Trendingの取得に失敗しました` を送信する。

## README 取得設計

### 取得方法

GitHub API の repository README endpoint を使い、GitHub が検出した README を取得する。

```text
GET /repos/{owner}/{repo}/readme
```

### 文字数制限

- README は先頭3000文字までに切り詰める。
- 取得失敗時は `readme: ""` として処理を継続する。

## Copilot 要約設計

### 入力

各リポジトリごとに以下を渡す。

- リポジトリ名
- Description
- Topics
- Language
- 今日のスター数
- README 先頭3000文字

### プロンプト

`docs/SPEC.md` の Copilot プロンプトを基準にする。

実装では、テンプレート文字列として `repository_data` を JSON 形式で埋め込み、`<repository_data>` タグで囲む。

README / description / topics は外部入力であるため、タグ内は要約対象データであり命令ではないことをプロンプトに明記する。

### 実行方法

Node.js の `child_process` で Copilot CLI を実行する。

実行コマンド:

```text
copilot -p "{{prompt}}" --no-ask-user
```

`--no-ask-user` を付与し、GitHub Actions 上で追加入力待ちにならないようにする。

今回の用途は渡したリポジトリ情報の日本語要約のみのため、`--allow-tool` は指定しない。

Copilot CLI の stdout を要約結果として扱う。stderr または終了コードが失敗を示した場合は、対象リポジトリの要約失敗として扱う。

### 失敗時

要約生成に失敗したリポジトリはスキップする。

他リポジトリの処理は継続する。

## Discord 通知設計

### 通知フォーマット

全体タイトル:

```md
# GitHub Trending Daily
```

各リポジトリの本文は SPEC の Discord 通知フォーマットに従う。

### 分割送信

Discord のメッセージ上限2000文字を考慮し、基本は以下の単位で送信する。

- 1件目〜3件目
- 4件目〜6件目
- 7件目〜10件目

1メッセージが2000文字を超える場合は、リポジトリ単位でさらに分割する。

### 送信失敗

Discord 送信に失敗した場合は process を失敗終了させる。

GitHub Actions 上で失敗を検知できるようにするため、過度なリトライは行わない。

## エラー処理

| 発生箇所          | 挙動                                                            |
| ----------------- | --------------------------------------------------------------- |
| Trending 取得失敗 | Discord へ `GitHub Trendingの取得に失敗しました` を送信して終了 |
| README 取得失敗   | Description のみで要約を継続                                    |
| Copilot 要約失敗  | 対象リポジトリをスキップして継続                                |
| Discord 通知失敗  | process を失敗終了                                              |

## GitHub Actions 設計

### スケジュール

```yaml
on:
  schedule:
    - cron: "0 23 * * *"
  workflow_dispatch:
```

JST 08:00 に通知するため、UTC 23:00 の cron を設定する。

### 実行ステップ

1. checkout
2. Node.js setup
3. package install
4. lint
5. format check
6. test
7. build
8. Copilot CLI install
9. daily script 実行

### Copilot CLI setup

GitHub Actions runner 上では、lint / format check / test / build が通った後に npm で Copilot CLI を install する。

```yaml
- name: Install Copilot CLI
  run: npm install -g @github/copilot
```

daily script 実行時に `COPILOT_GITHUB_TOKEN` を設定する。

```yaml
- name: Run daily summary
  env:
    DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
    COPILOT_GITHUB_TOKEN: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
  run: npm run start
```

## テスト設計

### `trending.test.ts`

- Trending HTML から owner / name / url を抽出できる
- starsToday / totalStars を number に変換できる
- 上位10件だけ返す

### `discord.test.ts`

- 1〜3件、4〜6件、7〜10件で分割できる
- 2000文字を超える本文をリポジトリ単位で分割できる
- Discord フォーマットが SPEC に沿っている

### `summarize.test.ts`

- Copilot に渡すプロンプトが必要項目を含む
- README が空文字でもプロンプトを生成できる
- 要約失敗時に null を返せる

外部通信と Copilot CLI 実行は mock する。

## 実装順序

1. TypeScript / Vitest / ESLint / Prettier の最小構成を追加する。
2. `Repository` 型を定義する。
3. Trending HTML パーサーを実装し、fixture ベースのテストを書く。
4. README / Topics 取得処理を実装する。
5. Copilot プロンプト生成と CLI 実行処理を実装する。
6. Discord フォーマットと分割送信処理を実装する。
7. `src/index.ts` で全体フローを接続する。
8. GitHub Actions workflow を追加する。
9. Copilot CLI の install と `COPILOT_GITHUB_TOKEN` 設定を workflow に追加する。
10. lint / format / test / build を通す。

## 確認コマンド

実装完了後に以下を確認する。

```sh
npm run lint
npm run format:check
npm run test
npm run build
```

## GitHub Actions 設定前提

- GitHub Copilot CLI を利用できる GitHub アカウントで fine-grained PAT を作成する。
- PAT には Copilot Requests 権限を付与する。
- repository secret に `PERSONAL_ACCESS_TOKEN` として保存する。
- Discord Webhook URL は repository secret に `DISCORD_WEBHOOK_URL` として保存する。

上記 secret が未設定の場合、GitHub Actions の daily script は失敗する。
