import type { Repository } from "./types.js";

const README_LIMIT = 3000;

type Fetch = typeof fetch;

type GitHubContentResponse = {
  content?: string;
  encoding?: string;
};

type GitHubRepositoryResponse = {
  topics?: unknown;
};

function createGitHubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "GitHubTrendingSummary",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function fetchTopics(repository: Repository, fetchImpl: Fetch): Promise<string[]> {
  const response = await fetchImpl(
    `https://api.github.com/repos/${repository.owner}/${repository.name}`,
    {
      headers: createGitHubHeaders(),
    },
  );

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as GitHubRepositoryResponse;

  if (!Array.isArray(data.topics)) {
    return [];
  }

  return data.topics.filter((topic): topic is string => typeof topic === "string");
}

async function fetchReadme(repository: Repository, fetchImpl: Fetch): Promise<string> {
  const response = await fetchImpl(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/readme`,
    {
      headers: createGitHubHeaders(),
    },
  );

  if (!response.ok) {
    return "";
  }

  const data = (await response.json()) as GitHubContentResponse;

  if (data.encoding !== "base64" || !data.content) {
    return "";
  }

  return Buffer.from(data.content.replace(/\n/g, ""), "base64")
    .toString("utf8")
    .slice(0, README_LIMIT);
}

export async function enrichRepository(
  repository: Repository,
  fetchImpl: Fetch = fetch,
): Promise<Repository> {
  const [topics, readme] = await Promise.all([
    fetchTopics(repository, fetchImpl).catch(() => []),
    fetchReadme(repository, fetchImpl).catch(() => ""),
  ]);

  return {
    ...repository,
    topics,
    readme,
  };
}
