# GitHub Trending Weekly 通知変更設計

## 目的

GitHub Trending の取得対象と通知頻度を Daily から Weekly に変更し、Discord 通知に各リポジトリの総スター数と URL を含める。

あわせて、概要と内容が重複するため「一言まとめ」は削除する。

## 変更要件

- GitHub Trending は Weekly を取得する。
- 通知は週1回、月曜日に送信する。
- Discord 通知本文にリポジトリ URL を含める。
- Discord 通知本文に総スター数を含める。
- Copilot 要約と Discord 通知から「一言まとめ」を削除する。

## 仕様変更

`docs/SPEC.md` を更新する。

- タイトルと概要を `GitHub Trending Weekly` に変更する。
- 実行スケジュールを週1回の月曜日 08:00 JST に変更する。
- GitHub Actions の cron を `0 23 * * 0` に変更する。
  - GitHub Actions cron は UTC で評価される。
  - `0 23 * * 0` は JST の月曜日 08:00 に相当する。
- 取得対象を `GitHub Trending Weekly` に変更する。
- `starsToday` を `starsThisWeek` に変更する。
- Copilot に渡す情報を「今日のスター数」から「今週のスター数」に変更する。
- Discord 通知フォーマットに今週のスター数、総スター数、`GitHub: https://github.com/owner/repository` を含める。
- Copilot プロンプトの出力形式から「一言まとめ」を削除する。
- Discord 通知フォーマットから「一言まとめ」を削除する。

## 実装変更

### `src/types.ts`

`Repository` の `starsToday` を `starsThisWeek` に変更する。

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

### `src/trending.ts`

- `TRENDING_URL` を `https://github.com/trending?since=weekly` に変更する。
- Weekly ページの star 表記である `stars this week` を parse する。
- `starsToday` ではなく `starsThisWeek` に値を格納する。
- `MAX_TRENDING_REPOSITORIES = 10` は維持する。

### `src/summarize.ts`

- Copilot に渡す JSON の `starsToday` を `starsThisWeek` に変更する。
- プロンプト内の文言を「今日のスター数」から「今週のスター数」に変更する。
- 出力形式の star 表示は `⭐ {starsThisWeek}` とする。
- 出力ルールから「一言まとめは40文字以内」を削除する。
- 出力形式から `### 一言まとめ` セクションを削除する。

### `src/discord.ts`

Discord の各リポジトリ本文に総スター数と URL を追加する。

```md
⭐ 今週: 1,234
⭐ Total: 56,789

GitHub:
https://github.com/owner/repository
```

総スター数は今週のスター数の直後に表示する。

URL は各リポジトリ要約の末尾に表示する。

Copilot から返る要約には「一言まとめ」が含まれない前提とする。既存の通知フォーマットにも「一言まとめ」は追加しない。

理由:

- Weekly の増加分とリポジトリ全体の規模を同時に判断できる。
- 要約本文の読みやすさを保てる。
- SPEC の将来拡張にあった URL 追加形式と一致する。
- 既存の heading / star / summary の構造を崩さない。
- 概要と一言まとめの重複を避けられる。

### `.github/workflows/weekly.yml`

workflow ファイル名は仕様との整合性を優先して `weekly.yml` に変更する。

- `.github/workflows/daily.yml` を `.github/workflows/weekly.yml` に変更する。
- workflow name を `GitHub Trending Weekly` に変更する。
- cron を `0 23 * * 0` に変更する。

## テスト変更

### `test/trending.test.ts`

- Weekly URL を期待するテストを追加する。
- `stars this week` を parse できる fixture に変更する。
- `starsThisWeek` が設定されることを確認する。

### `test/summarize.test.ts`

- prompt に `starsThisWeek` と「今週のスター数」が含まれることを確認する。
- `starsToday` が残っていないことを確認する。
- prompt に「一言まとめ」が含まれないことを確認する。

### `test/discord.test.ts`

- Discord 分割メッセージに総スター数が含まれることを確認する。
- Discord 分割メッセージに GitHub URL が含まれることを確認する。
- Discord 分割メッセージに「一言まとめ」が含まれないことを確認する。
- URL 追加後も 2000文字以内の分割が維持されることを確認する。

### `test/readme.test.ts`

`Repository` 型変更に合わせて `starsThisWeek` へ更新する。

## 確認コマンド

実装完了後に以下を確認する。

```sh
npm run lint
npm run format:check
npm run test
npm run build
```

## 補足

Discord メッセージ上限 2000 文字は維持する。URL 追加によりメッセージが長くなるため、既存の分割処理と truncation のテストで確認する。

要約が長すぎて切り詰める場合も、GitHub URL ブロックは通知内に残す。
