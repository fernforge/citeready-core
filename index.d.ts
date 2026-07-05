export type WinnableLevel =
  | 'winnable'
  | 'moderate'
  | 'soft-locked'
  | 'locked'
  | 'unknown';

export interface Verdict {
  level: WinnableLevel;
  label: string;
  detail: string;
  action: string;
}

export interface Check {
  key: string;
  pass: boolean | null;
  label: string;
  why: string;
  weight?: number;
  gate?: boolean;
  note?: string | null;
  sample?: string | null;
}

export interface Note {
  key: string;
  present: boolean;
  label: string;
  why: string;
}

export interface Stage1 {
  checks: Check[];
  cannotSee: string[];
  gatesPass: boolean;
  visibleWords: number;
}

export interface Stage2 {
  checks: Check[];
  notes: Note[];
  score: number;
}

export interface AuditResult {
  url: string | null;
  query: string | null;
  verdict: Verdict;
  stage1: Stage1;
  stage2: Stage2;
}

export interface AuditOptions {
  query?: string;
  robotsTxt?: string | null;
  url?: string | null;
}

/** Classify a target query: is it winnable for an independent site? Needs no HTML. */
export function winnableVerdict(query: string): Verdict;

/** Full two-stage audit of a page's HTML (parses with jsdom). */
export function auditHtml(html: string, opts?: AuditOptions): AuditResult;

/** Raw engine over a DOM you already have (e.g. in a browser). */
export function audit(ctx: { doc: Document; html?: string; robotsTxt?: string | null; query?: string; url?: string | null }): AuditResult;
export function stage1(ctx: { doc: Document; robotsTxt?: string | null; query?: string }): Stage1;
export function stage2(ctx: { doc: Document; query?: string }): Stage2;
