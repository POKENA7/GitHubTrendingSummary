import type { RepositorySummary } from "./types.js";

const DISCORD_MESSAGE_LIMIT = 2000;
const DISCORD_GROUP_SIZES = [3, 3, 4] as const;

type Fetch = typeof fetch;

function formatStarCount(value: number): string {
  return value.toLocaleString("en-US");
}

function stripLeadingRepositoryMetadata(summary: string): string {
  return summary
    .trim()
    .replace(/^##\s+.+\n+/, "")
    .replace(/^⭐\s*(?:今週:\s*)?[\d,.kmKM]+(?:\n+|$)/, "")
    .trim();
}

function truncateMessage(message: string): string {
  if (message.length <= DISCORD_MESSAGE_LIMIT) {
    return message;
  }

  const githubBlockIndex = message.lastIndexOf("\n\nGitHub:\n");

  if (githubBlockIndex >= 0) {
    const githubBlock = message.slice(githubBlockIndex);
    const contentLimit = DISCORD_MESSAGE_LIMIT - githubBlock.length - 5;

    if (contentLimit > 0) {
      return `${message.slice(0, contentLimit).trimEnd()}\n...${githubBlock}`;
    }
  }

  return `${message.slice(0, DISCORD_MESSAGE_LIMIT - 5).trimEnd()}\n...`;
}

export function formatRepositorySummary(item: RepositorySummary, index: number): string {
  const body = stripLeadingRepositoryMetadata(item.summary);
  return `## ${index}. ${item.repository.owner}/${item.repository.name}

⭐ 今週: ${formatStarCount(item.repository.starsThisWeek)}
⭐ Total: ${formatStarCount(item.repository.totalStars)}

${body}

GitHub:
${item.repository.url}`;
}

export function splitDiscordMessages(items: RepositorySummary[]): string[] {
  const sections = items.map((item, index) => formatRepositorySummary(item, index + 1));
  let startIndex = 0;
  const groups = DISCORD_GROUP_SIZES.map((groupSize) => {
    const group = sections.slice(startIndex, startIndex + groupSize);
    startIndex += groupSize;
    return group;
  }).filter((group) => group.length > 0);
  const messages: string[] = [];

  groups.forEach((group, groupIndex) => {
    const prefix = groupIndex === 0 ? "# GitHub Trending Weekly\n\n" : "";
    const message = `${prefix}${group.join("\n\n---\n\n")}`;

    if (message.length <= DISCORD_MESSAGE_LIMIT) {
      messages.push(message);
      return;
    }

    group.forEach((section) => {
      const sectionPrefix = messages.length === 0 ? "# GitHub Trending Weekly\n\n" : "";
      messages.push(truncateMessage(`${sectionPrefix}${section}`));
    });
  });

  return messages;
}

export async function sendDiscordMessage(
  webhookUrl: string,
  content: string,
  fetchImpl: Fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: truncateMessage(content),
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook request failed: ${response.status}`);
  }
}

export async function sendDiscordMessages(
  webhookUrl: string,
  summaries: RepositorySummary[],
  fetchImpl: Fetch = fetch,
): Promise<void> {
  for (const message of splitDiscordMessages(summaries)) {
    await sendDiscordMessage(webhookUrl, message, fetchImpl);
  }
}
