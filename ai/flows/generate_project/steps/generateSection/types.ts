export type ComponentSkillScore = {
  id: string;
  priority: number;
  score: number;
  reasons: string[];
  matchedKeywords: string[];
  excludedKeywords: string[];
};

export type GenerateSectionProjectContext = {
  projectTitle: string;
  projectDescription: string;
  language: string;
  rawUserInput?: string;
  pages: Array<{
    slug: string;
    title: string;
    description: string;
    journeyStage: string;
  }>;
  designKeywords: string[];
};

export type GenerateSectionPageContext = {
  title: string;
  slug: string;
  description: string;
  journeyStage: string;
};
