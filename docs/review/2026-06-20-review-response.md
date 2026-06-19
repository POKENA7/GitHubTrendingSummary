# レビュー指摘対応結果

日付: 2026-06-20  
対象: `docs/review/2026-06-20-code-review.md`

## 対応結果

| 重要度   | 指摘                                                    | 判断     | 対応                                                                   |
| -------- | ------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| [HIGH]   | プロンプトインジェクション                              | 対応必要 | `repository_data` をタグで囲み、タグ内の命令を無視する指示を追加       |
| [MEDIUM] | 逐次処理による低速化                                    | 一部対応 | README / topics 取得のみ並列化。Copilot CLI 要約は安定性優先で逐次維持 |
| [MEDIUM] | GitHub Contents API の非効率な使い方                    | 対応必要 | `/repos/{owner}/{repo}/readme` endpoint に変更                         |
| [MEDIUM] | グループ分割の境界値がハードコード                      | 対応必要 | `DISCORD_GROUP_SIZES = [3, 3, 4]` に定数化し SPEC の分割を維持         |
| [MEDIUM] | GitHub Actions ジョブにタイムアウト未設定               | 対応必要 | `timeout-minutes: 30` を追加                                           |
| [LOW]    | `parseGitHubNumber` の `m` サフィックスがテスト未カバー | 対応必要 | `1.5m` のテストを追加                                                  |
| [LOW]    | CI ステップの順序最適化                                 | 対応必要 | Copilot CLI install を build 後、daily script 実行直前へ移動           |

## 対応しなかった内容

Copilot CLI 要約の並列化は見送った。

理由:

- Copilot CLI を最大10プロセス同時起動すると、runner resource・認証・rate limit の問題が起きる可能性がある。
- MVP では毎日1回の個人用途であり、要約生成の安定性を優先する。
- 低速化の主要因のうち GitHub API / README 取得は並列化済み。

## 確認結果

以下の確認を実施済み。

```sh
npm run lint
npm run format:check
npm run test
npm run build
```
