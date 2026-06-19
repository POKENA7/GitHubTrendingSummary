import * as cheerio from "cheerio";

import type { Repository } from "./types.js";

export const TRENDING_URL = "https://github.com/trending?since=weekly";
export const MAX_TRENDING_REPOSITORIES = 10;

type Fetch = typeof fetch;

export function parseGitHubNumber(value: string): number {
  const normalized = value.trim().replace(/,/g, "").toLowerCase();
  const match = normalized.match(/([\d.]+)\s*([km]?)/);

  if (!match) {
    return 0;
  }

  const number = Number(match[1]);
  const unit = match[2];

  if (Number.isNaN(number)) {
    return 0;
  }

  if (unit === "k") {
    return Math.round(number * 1000);
  }

  if (unit === "m") {
    return Math.round(number * 1000 * 1000);
  }

  return Math.round(number);
}

export function parseTrendingRepositories(html: string): Repository[] {
  const $ = cheerio.load(html);
  const repositories: Repository[] = [];

  $("article.Box-row").each((_, element) => {
    if (repositories.length >= MAX_TRENDING_REPOSITORIES) {
      return false;
    }

    const article = $(element);
    const href = article.find("h2 a").first().attr("href")?.trim();

    if (!href) {
      return;
    }

    const [owner, name] = href.replace(/^\//, "").split("/");

    if (!owner || !name) {
      return;
    }

    const description = article.find("p").first().text().replace(/\s+/g, " ").trim();
    const language = article
      .find('[itemprop="programmingLanguage"]')
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const totalStars = parseGitHubNumber(
      article.find(`a[href="/${owner}/${name}/stargazers"]`).first().text(),
    );
    const starsThisWeek = parseGitHubNumber(
      article.text().match(/[\d,.kmKM]+\s+stars?\s+this\s+week/)?.[0] ?? "",
    );

    repositories.push({
      owner,
      name,
      url: `https://github.com/${owner}/${name}`,
      description,
      language,
      starsThisWeek,
      totalStars,
      topics: [],
      readme: "",
    });
  });

  return repositories;
}

export async function fetchTrendingRepositories(fetchImpl: Fetch = fetch): Promise<Repository[]> {
  const response = await fetchImpl(TRENDING_URL, {
    headers: {
      "User-Agent": "GitHubTrendingSummary",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Trending request failed: ${response.status}`);
  }

  return parseTrendingRepositories(await response.text());
}
