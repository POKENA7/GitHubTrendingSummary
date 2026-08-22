# GitHub Trending Weekly 仕様書

## 概要

GitHub Trendingの上位10リポジトリを毎週取得し、日本語で要約してDiscordへ通知する個人向けサービス。

対象ユーザーは開発者本人のみとし、運用コストを最小限に抑えることを目的とする。

---

# システム構成

```text
GitHub Actions (Cron)

    ↓

GitHub Trending取得

    ↓

README取得

    ↓

Claude Code CLI

    ↓

日本語要約生成

    ↓

Discord Webhook通知
```

---

# 使用技術

## 実行環境

- GitHub Actions

## 開発言語

- TypeScript

## AI

- Claude Code CLI

実行方法

```text
claude -p <prompt> --output-format text --model sonnet
```

認証は `CLAUDE_CODE_OAUTH_TOKEN` を GitHub Actions の Secrets から渡す。

## 通知

- Discord Webhook

## データ保存

不要

毎回GitHub Trendingから取得して生成する。

---

# 実行スケジュール

毎週1回、月曜日に実行する。

```yaml
cron: "0 23 * * 0"
```

JST換算

```text
月曜日 08:00
```

に通知する。

---

# 取得対象

GitHub Trending Weekly

上位10件

取得項目

```ts
type Repository = {
  owner: string;
  name: string;
  url: string;

  description: string;
  language: string;

  starsThisWeek: number;
  totalStars: number;

  topics: string[];

  readme: string;
};
```

---

# README取得ルール

README全文は取得しない。

取得上限

```text
先頭3000文字
```

まで。

理由

- Claudeの入力を小さくする
- Actions実行時間を短縮する

---

# AI要約ルール

Claudeへ以下の情報を渡す。

- リポジトリ名
- Description
- Topics
- Language
- 今週のスター数
- README先頭3000文字

---

## 要約プロンプト

あなたはOSSリサーチャーです。

以下のGitHubリポジトリを日本語で要約してください。

出力形式は必ず以下に従ってください。

- 何がすごい？は箇条書き3個以内
- こんな人向けは箇条書き3個以内
- 日本語で簡潔に
- 誇張表現は禁止

---

リポジトリ情報:

{{repository_data}}

---

出力形式:

## {repository_name}

⭐ 今週: {stars_this_week}

{概要}

### 何がすごい？

- xxx
- xxx
- xxx

### こんな人向け

- xxx
- xxx

---

# Discord通知フォーマット

```md
# GitHub Trending Weekly

## 1. owner/awesome-agent

⭐ 今週: 2,300
⭐ Total: 56,789

AI Agentを作るためのフレームワーク。

### 何がすごい？

- Claude Code対応
- MCP対応
- Pythonベース

### こんな人向け

- AI Agent開発者
- LangChain利用者

GitHub:
https://github.com/owner/awesome-agent

---

## 2. foo/bar

...
```

---

# Discord文字数対策

Discordメッセージ上限

```text
2000文字
```

のため、

以下の順で送信する。

```text
1件目〜3件目
↓
送信

4件目〜6件目
↓
送信

7件目〜10件目
↓
送信
```

必要に応じて複数メッセージへ分割する。

---

# エラー処理

## Trending取得失敗

Discordへ通知

```text
GitHub Trendingの取得に失敗しました
```

---

## README取得失敗

Descriptionのみで要約する。

処理は継続する。

---

## Claude要約失敗

対象リポジトリをスキップする。

他のリポジトリは継続する。

---

# 将来拡張

## 優先度付け

ユーザーの興味カテゴリ

```yaml
interests:
  - AI
  - TypeScript
  - Cloudflare
  - MCP
  - Agent
```

を設定可能にする。

---

## スコアリング

プロンプトに

```text
興味との関連度を
1〜5で評価してください
```

を追加する。

---

# MVP完了条件

- GitHub Actionsで毎週月曜日の朝に実行できる
- Trending Weekly上位10件を取得できる
- Claude Code CLIで日本語要約できる
- Discordへ今週のスター数、総スター数、URL付きで通知できる
- 月額費用0円で運用できる
