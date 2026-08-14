import { dataAnalystConcepts } from './tracks/data-analyst';
import { devopsConcepts } from './tracks/devops';
import { systemDesignConcepts } from './tracks/system-design';

export interface Concept {
  id: string;
  title: string;
  cat: string;
  desc: string;
  task?: string;
  bonus?: true;
  pre: string[];
}

export type TrackId = 'data-analyst' | 'devops' | 'system-design';

export interface Track {
  id: TrackId;
  title: string;
  tagline: string;
  tutorRole: string;
  tutorContext: string;
  concepts: Concept[];
  byId: ReadonlyMap<string, Concept>;
}

function makeTrack(t: Omit<Track, 'byId'>): Track {
  return { ...t, byId: new Map(t.concepts.map(c => [c.id, c])) };
}

export const DEFAULT_TRACK: TrackId = 'data-analyst';

export const tracks: Track[] = [
  makeTrack({
    id: 'data-analyst',
    title: 'Data Analyst',
    tagline: 'Click a node → its full prerequisite path lights up. That path is what you’re verifying.',
    tutorRole: 'patient data-analysis tutor',
    tutorContext:
      'this bank dataset: 4 tables - customer info (birth date, gender, marital status, salary, career), product holdings, deposit accounts, and monthly average balances - all joinable on DUMMY_ID.',
    concepts: dataAnalystConcepts,
  }),
  makeTrack({
    id: 'devops',
    title: 'DevOps',
    tagline: 'Ship a small Node.js service to production and keep it alive.',
    tutorRole: 'hands-on DevOps mentor',
    tutorContext:
      'a small Node.js web service you are shipping to production from your laptop, with Docker, GitHub, and free tools only.',
    concepts: devopsConcepts,
  }),
  makeTrack({
    id: 'system-design',
    title: 'System Design',
    tagline: 'Design a photo-sharing app that grows from 1k to 100M users, one concept at a time.',
    tutorRole: 'pragmatic system-design coach',
    tutorContext:
      'a growing photo-sharing web app (uploads, feeds, follows, likes) that scales from 1,000 to 100 million users.',
    concepts: systemDesignConcepts,
  }),
];

export const trackById: ReadonlyMap<TrackId, Track> = new Map(tracks.map(t => [t.id, t]));
