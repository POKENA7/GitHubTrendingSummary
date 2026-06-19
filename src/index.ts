import { sendDiscordMessage, sendDiscordMessages } from "./discord.js";
import { enrichRepository } from "./readme.js";
import { summarizeRepository } from "./summarize.js";
import { fetchTrendingRepositories } from "./trending.js";
import type { Repository, RepositorySummary } from "./types.js";

async function main(): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("DISCORD_WEBHOOK_URL is required");
  }

  let repositories: Repository[];

  try {
    repositories = await fetchTrendingRepositories();
  } catch (error) {
    await sendDiscordMessage(webhookUrl, "GitHub Trendingの取得に失敗しました");
    throw error;
  }

  const enrichedRepositories = await Promise.all(
    repositories.map((repository) => enrichRepository(repository)),
  );
  const summaries: RepositorySummary[] = [];

  for (const enrichedRepository of enrichedRepositories) {
    const summary = await summarizeRepository(enrichedRepository);

    if (summary) {
      summaries.push({
        repository: enrichedRepository,
        summary,
      });
    }
  }

  if (summaries.length > 0) {
    await sendDiscordMessages(webhookUrl, summaries);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
