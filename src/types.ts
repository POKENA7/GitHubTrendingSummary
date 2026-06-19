export type Repository = {
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

export type RepositorySummary = {
  repository: Repository;
  summary: string;
};
