# GitHub Copilot CLI から Claude Code への移行 設計書

作成日: 2026-08-22

---

## 背景

GitHub Copilot のサブスクリプションを解約したため、要約生成に使用していた
GitHub Copilot CLI (`copilot` コマンド) が実行できなくなり、週次ジョブが機能しなくなった。

要約生成の実行基盤を Claude Code CLI (`claude` コマンド) へ差し替える。

---

## 現状の Copilot 依存箇所

| ファイル                       | 内容                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `src/summarize.ts`             | `copilot -p <prompt> --no-ask-user` を `execFile` で実行。型名・関数名も `Copilot` 由来 |
| `test/summarize.test.ts`       | `buildCopilotPrompt` を対象としたテスト                                                 |
| `.github/workflows/weekly.yml` | `npm install -g @github/copilot` と `COPILOT_GITHUB_TOKEN` の受け渡し                   |
| `docs/SPEC.md`                 | AI 実行基盤として GitHub Copilot CLI を記載                                             |

`docs/design/` および `docs/review/` の既存ファイルは過去時点の記録のため変更しない。

---

## 方針

- 要約生成の**インターフェースは変更しない**。`summarizeRepository()` が
  `Repository` を受け取り `string | null` を返す構造、および Runner を差し替え可能にした
  依存注入の形はそのまま維持する。
- 変更範囲は「AI CLI を実行する部分」と「その命名」に閉じる。
  Trending 取得 / README 取得 / Discord 通知は一切変更しない。
- `AGENTS.md` の方針に従い、Copilot 時代の名称は互換のために残さず置き換える。

---

## 変更内容

### 1. `src/summarize.ts`

命名を AI ベンダー非依存 + Claude Code 準拠に変更する。

| 変更前                 | 変更後                 |
| ---------------------- | ---------------------- |
| `CopilotRunner`        | `SummaryRunner`        |
| `buildCopilotPrompt()` | `buildSummaryPrompt()` |
| `runCopilot()`         | `runClaude()`          |

実行コマンドを差し替える。

```ts
// 変更前
execFileAsync("copilot", ["-p", prompt, "--no-ask-user"], { ... });

// 変更後
execFileAsync(
  "claude",
  [
    "-p", prompt,
    "--output-format", "text",
    "--model", CLAUDE_MODEL,
    "--disallowed-tools", DISALLOWED_TOOLS,
  ],
  { env: process.env, maxBuffer: 1024 * 1024 },
);
```

各オプションの意図:

- `-p` … 非対話モードで応答をstdoutへ出力して終了する（Copilot の `-p` と同じ位置づけ）
- `--output-format text` … 応答本文のみを取得する（JSON メタデータを付けない）
- `--model` … 使用モデルを固定する。既定モデルの変動で出力傾向がぶれるのを防ぐ
- `--disallowed-tools "Bash,Edit,Write,WebFetch,WebSearch"` …
  副作用を持つツールの実行を禁止する。
  本ジョブは純粋なテキスト生成であり、コマンド実行・ファイル書き込み・Web アクセスは不要。
  README 本文という外部入力をプロンプトに含める以上、
  プロンプトインジェクションでこれらが起動される経路を明示的に塞ぐ。
  既存のプロンプト側の防御（`<repository_data>` タグと無視指示）と合わせた二重の対策とする。
  `Read` / `Glob` / `Grep` は禁止対象に含めない。
  これらが読めるのは CI 上のチェックアウト（公開リポジトリの内容）に限られ、実害がないため。
  なお `--allowed-tools` は「事前承認するツールの許可リスト」であり
  実行を禁止する指定ではないため、この用途には使わない。

プロンプト本文は変更しない。Copilot 向けに調整した内容ではなく、
汎用的な日本語要約指示であるため、そのまま流用できる。

### 2. `test/summarize.test.ts`

- import と `describe` 名を `buildSummaryPrompt` に合わせて変更する。
- アサーション内容は変更しない（プロンプト本文を変えないため）。
- 失敗時に `null` を返すテストのエラーメッセージ文言のみ `claude failed` に変更する。

### 3. `.github/workflows/weekly.yml`

```yaml
# 変更前
- name: Install Copilot CLI
  run: npm install -g @github/copilot

- name: Run weekly summary
  env:
    DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
    COPILOT_GITHUB_TOKEN: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
    GITHUB_TOKEN: ${{ github.token }}
  run: npm run start
```

```yaml
# 変更後
- name: Install Claude Code CLI
  run: npm install -g @anthropic-ai/claude-code

- name: Run weekly summary
  env:
    DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
    CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    GITHUB_TOKEN: ${{ github.token }}
  run: npm run start
```

`GITHUB_TOKEN` は README 取得の GitHub API 呼び出しで使用しているため残す。

### 4. `docs/SPEC.md`

- システム構成図の「GitHub Copilot CLI」を「Claude Code CLI」に変更
- 「使用技術 > AI」を Claude Code CLI に変更
- 「AI要約ルール」「Copilotプロンプト」「エラー処理」「MVP完了条件」内の
  Copilot 表記を Claude に変更
- 「月額費用0円で運用できる」は認証方式の決定に合わせて実態に沿った記述へ更新する（下記）

---

## 決定事項

### A. 認証方式（決定: A-1）

| 案                      | 環境変数                  | 取得方法                                       | コスト                                 |
| ----------------------- | ------------------------- | ---------------------------------------------- | -------------------------------------- |
| A-1: サブスクリプション | `CLAUDE_CODE_OAUTH_TOKEN` | ローカルで `claude setup-token` を実行して発行 | 契約中の Claude プラン内。追加課金なし |
| A-2: API キー           | `ANTHROPIC_API_KEY`       | Anthropic Console で発行                       | 従量課金                               |

**A-1 を採用する。** Claude Code を既に利用しているため追加契約が不要で、
「月額費用0円で運用できる」という MVP 完了条件を維持できる。
ただし発行したトークンには有効期限があるため、失効時に再発行が必要になる。

### B. 使用モデル（決定: B-2 `sonnet`）

| 案  | 指定値   | 特徴           |
| --- | -------- | -------------- |
| B-1 | `haiku`  | 高速・低コスト |
| B-2 | `sonnet` | 要約品質が安定 |

**B-2（`sonnet`）を採用する。** 週10件の実行であり、品質を優先する。
変更が必要になった場合は `src/summarize.ts` の `CLAUDE_MODEL` 定数のみを書き換える。

---

## 変更しないもの

- `src/trending.ts` / `src/readme.ts` / `src/discord.ts` / `src/types.ts` / `src/index.ts`
- 実行スケジュール（`cron: "0 23 * * 0"`）
- Discord 通知フォーマットおよび分割送信ロジック
- 過去の `docs/design/` `docs/review/` 配下の記録

---

## 検証手順

1. `npm run lint` / `npm run format:check` / `npm run test` / `npm run build` が通ること
2. ローカルで `claude -p "テスト" --output-format text --model sonnet` が
   応答を返すことを確認する。
   なお、この確認は **通常のターミナルで実施すること**。
   Claude Code のセッション内から `claude -p` を実行する入れ子起動は応答が返らず、
   本設計の作成時に検証を完了できなかった。CLI の仕様は `claude --help` の出力で確認済み
3. GitHub リポジトリの Secrets に認証トークンを登録
4. `workflow_dispatch` で手動実行し、Discord に通知が届くことを確認

---

## リスク

| リスク                            | 影響                                                         | 対応                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 認証トークンの失効                | 週次ジョブが要約を全件スキップし、Discord に何も通知されない | 失効時は再発行して Secrets を更新する。挙動としては既存の「要約失敗時はスキップ」に従う                                                       |
| `claude` CLI のオプション仕様変更 | 実行失敗                                                     | ジョブ内で `npm install -g @anthropic-ai/claude-code` を毎回実行するため常に最新版になる。破壊的変更時は `src/summarize.ts` の1箇所を修正する |
| 出力傾向がCopilotと異なる         | 要約の文体が変わる                                           | プロンプトの出力形式指定で吸収する。初回実行の結果を見て必要なら調整                                                                          |
