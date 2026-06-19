import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseGitHubNumber, parseTrendingRepositories } from "../src/trending.js";

const fixtureUrl = new URL("./fixtures/trending.html", import.meta.url);

describe("parseGitHubNumber", () => {
  it("GitHub の数値表記を number に変換できる", () => {
    expect(parseGitHubNumber("1,234")).toBe(1234);
    expect(parseGitHubNumber("2.3k")).toBe(2300);
    expect(parseGitHubNumber("1.5m")).toBe(1500000);
    expect(parseGitHubNumber("1.2k stars today")).toBe(1200);
  });
});

describe("parseTrendingRepositories", () => {
  it("Trending HTML からリポジトリ情報を抽出し、上位10件だけ返す", async () => {
    const html = await readFile(fileURLToPath(fixtureUrl), "utf8");
    const repositories = parseTrendingRepositories(html);

    expect(repositories).toHaveLength(10);
    expect(repositories[0]).toEqual({
      owner: "owner-one",
      name: "repo-one",
      url: "https://github.com/owner-one/repo-one",
      description: "First repository description.",
      language: "TypeScript",
      starsToday: 45,
      totalStars: 1234,
      topics: [],
      readme: "",
    });
    expect(repositories[1]?.starsToday).toBe(1200);
    expect(repositories[1]?.totalStars).toBe(2300);
  });
});
