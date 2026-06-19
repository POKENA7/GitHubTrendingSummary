import { describe, expect, it } from "vitest";

import { enrichRepository } from "../src/readme.js";
import type { Repository } from "../src/types.js";

const repository: Repository = {
  owner: "owner",
  name: "repo",
  url: "https://github.com/owner/repo",
  description: "description",
  language: "TypeScript",
  starsToday: 1,
  totalStars: 100,
  topics: [],
  readme: "",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("enrichRepository", () => {
  it("topics と README 先頭3000文字を取得できる", async () => {
    const readme = "a".repeat(3100);
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);

      if (url === "https://api.github.com/repos/owner/repo") {
        return jsonResponse({
          topics: ["ai", "typescript"],
        });
      }

      if (url === "https://api.github.com/repos/owner/repo/readme") {
        return jsonResponse({
          encoding: "base64",
          content: Buffer.from(readme, "utf8").toString("base64"),
        });
      }

      return jsonResponse({}, 404);
    };

    const result = await enrichRepository(repository, fetchImpl);

    expect(result.topics).toEqual(["ai", "typescript"]);
    expect(result.readme).toHaveLength(3000);
  });

  it("README 取得失敗時も空文字で処理を継続できる", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);

      if (url === "https://api.github.com/repos/owner/repo") {
        return jsonResponse({
          topics: ["ai"],
        });
      }

      return jsonResponse({}, 404);
    };

    const result = await enrichRepository(repository, fetchImpl);

    expect(result.topics).toEqual(["ai"]);
    expect(result.readme).toBe("");
  });
});
