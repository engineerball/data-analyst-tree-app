export interface Concept {
  id: string;
  title: string;
  tier: number;
  cat: string;
  desc: string;
  pre: string[];
}

export const concepts: Concept[] = [
  { id: 'types', title: 'Data types', tier: 1, cat: 'Foundations', desc: 'Recognize numbers, text, dates, booleans, and categorical values.', pre: [] },
  { id: 'missing', title: 'Missing values', tier: 1, cat: 'Foundations', desc: 'Identify blanks and understand how they affect analysis.', pre: [] },
  { id: 'unique', title: 'Unique values', tier: 1, cat: 'Foundations', desc: 'Inspect distinct values to spot categories, labels, and anomalies.', pre: [] },
  { id: 'convert', title: 'Convert types', tier: 2, cat: 'Cleaning', desc: 'Convert fields into types that support reliable calculations.', pre: ['types'] },
  { id: 'handle-missing', title: 'Handle missing data', tier: 2, cat: 'Cleaning', desc: 'Choose whether to remove, fill, or flag missing observations.', pre: ['missing'] },
  { id: 'dedupe', title: 'Deduplicate', tier: 2, cat: 'Cleaning', desc: 'Find repeated records before counting or aggregating data.', pre: ['unique'] },
  { id: 'aggregate', title: 'Aggregate', tier: 3, cat: 'Operations', desc: 'Summarize rows using totals, averages, counts, or other measures.', pre: ['convert', 'handle-missing'] },
  { id: 'join', title: 'Join tables', tier: 3, cat: 'Operations', desc: 'Combine related tables through a shared key.', pre: ['unique', 'dedupe'] },
  { id: 'group', title: 'Group by', tier: 3, cat: 'Operations', desc: 'Split data into meaningful groups before calculating summaries.', pre: ['aggregate', 'join'] },
  { id: 'change', title: 'Change over time', tier: 4, cat: 'Analysis', desc: 'Compare how a metric changes across time periods, such as month-over-month, year-over-year, or growth percentage.', pre: ['group', 'convert'] },
  { id: 'correlation', title: 'Correlation', tier: 4, cat: 'Analysis', desc: 'Measure whether two variables move together and how strongly.', pre: ['aggregate', 'group'] },
  { id: 'trend', title: 'Trend story', tier: 5, cat: 'Insight', desc: 'Turn time-based analysis into a clear explanation of what changed and why.', pre: ['change', 'correlation'] },
];

export const conceptById: ReadonlyMap<string, Concept> = new Map(concepts.map(c => [c.id, c]));
