import { describe, expect, it } from "vitest";

import { splitDiscordMessages } from "../src/discord.js";
import type { Repository, RepositorySummary } from "../src/types.js";

function createRepository(index: number): Repository {
  return {
    owner: `owner-${index}`,
    name: `repo-${index}`,
    url: `https://github.com/owner-${index}/repo-${index}`,
    description: `Repository ${index}`,
    language: "TypeScript",
    starsThisWeek: index,
    totalStars: index * 100,
    topics: [],
    readme: "",
  };
}

function createSummary(index: number, body = "短い概要"): RepositorySummary {
  return {
    repository: createRepository(index),
    summary: `## owner-${index}/repo-${index}

⭐ 今週: ${index}

${body}

### 何がすごい？

* 機能が明確

### こんな人向け

* 開発者`,
  };
}

describe("splitDiscordMessages", () => {
  it("1〜3件、4〜6件、7〜10件で分割できる", () => {
    const messages = splitDiscordMessages(
      Array.from({ length: 10 }, (_, index) => createSummary(index + 1)),
    );

    expect(messages).toHaveLength(3);
    expect(messages[0]).toContain("# GitHub Trending Weekly");
    expect(messages[0]).toContain("## 1. owner-1/repo-1");
    expect(messages[0]).toContain("⭐ 今週: 1");
    expect(messages[0]).toContain("⭐ Total: 100");
    expect(messages[0]).toContain("https://github.com/owner-1/repo-1");
    expect(messages[0]).not.toContain("一言まとめ");
    expect(messages[0]).toContain("## 3. owner-3/repo-3");
    expect(messages[1]).toContain("## 4. owner-4/repo-4");
    expect(messages[1]).toContain("## 6. owner-6/repo-6");
    expect(messages[2]).toContain("## 7. owner-7/repo-7");
    expect(messages[2]).toContain("## 10. owner-10/repo-10");
  });

  it("2000文字を超える本文をリポジトリ単位で分割できる", () => {
    const longBody = "長い説明".repeat(300);
    const messages = splitDiscordMessages([createSummary(1, longBody), createSummary(2, longBody)]);

    expect(messages).toHaveLength(2);
    expect(messages.every((message) => message.length <= 2000)).toBe(true);
    expect(messages[0]).toContain("## 1. owner-1/repo-1");
    expect(messages[0]).toContain("https://github.com/owner-1/repo-1");
    expect(messages[1]).toContain("## 2. owner-2/repo-2");
    expect(messages[1]).toContain("https://github.com/owner-2/repo-2");
  });

  it("長すぎる要約を切り詰めても GitHub URL を残す", () => {
    const veryLongBody = "長い説明".repeat(700);
    const messages = splitDiscordMessages([createSummary(1, veryLongBody)]);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.length).toBeLessThanOrEqual(2000);
    expect(messages[0]).toContain("...");
    expect(messages[0]).toContain("GitHub:");
    expect(messages[0]).toContain("https://github.com/owner-1/repo-1");
  });
});
