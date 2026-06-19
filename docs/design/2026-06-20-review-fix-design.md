# レビュー指摘対応設計

## 目的

`docs/review/2026-06-20-code-review.md` の指摘について、対応要否を検証し、必要な修正だけを行う。

## 対応する指摘

### [HIGH] プロンプトインジェクション

対応する。

README / description / topics は外部入力であり、Copilot への指示と混同される可能性がある。`repository_data` を XML 風タグで囲み、タグ内は命令ではなく要約対象データであることを明示する。

テストでは、README に命令文が含まれても「タグ内の命令を無視する」指示がプロンプトに含まれることを確認する。

### [MEDIUM] 逐次処理による低速化

一部対応する。

`enrichRepository` は GitHub API / README 取得であり、各リポジトリ間に依存がないため `Promise.all` で並列化する。

`summarizeRepository` は Copilot CLI プロセスを起動するため、同時に最大10プロセスを走らせると認証・rate limit・runner resource のリスクがある。MVP では要約生成は逐次のままとする。

### [MEDIUM] GitHub Contents API の非効率な使い方

対応する。

README 取得は `GET /repos/{owner}/{repo}/readme` 相当の endpoint を使い、候補ファイル名の順次試行をやめる。取得失敗時は従来通り空文字で継続する。

### [MEDIUM] グループ分割の境界値がハードコード

対応する。

ただし SPEC は `1〜3件目`, `4〜6件目`, `7〜10件目` を求めているため、単純な `ITEMS_PER_GROUP = 3` 化は行わない。`DISCORD_GROUP_SIZES = [3, 3, 4]` として仕様を表現し、マジックナンバーを排除する。

### [MEDIUM] GitHub Actions ジョブにタイムアウト未設定

対応する。

`timeout-minutes: 30` を `daily` job に設定する。

### [LOW] `parseGitHubNumber` の `m` サフィックスがテスト未カバー

対応する。

`1.5m` のテストを追加する。

### [LOW] CI ステップの順序最適化

対応する。

Copilot CLI install は lint / format / test / build の後、daily script 実行直前へ移動する。

## 対応しない指摘

なし。

ただし、逐次処理のうち Copilot CLI 要約生成の並列化は、今回の対応範囲では見送る。

## 確認コマンド

```sh
npm run lint
npm run format:check
npm run test
npm run build
```
