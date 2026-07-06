# citeready-core

Before you spend a day formatting a page to get cited by ChatGPT or Perplexity, answer one question: **is this query even winnable for an independent site?**

```js
const { winnableVerdict } = require('citeready-core');

winnableVerdict('best treatment for migraines').level;   // 'locked'   — YMYL, authority wins, don't bother
winnableVerdict('fix CORS error in fetch').level;        // 'winnable' — no canonical owner, formatting wins
winnableVerdict('react useEffect api reference').level;  // 'soft-locked' — official docs own this
```

Most AEO/GEO checklists grade your page and hand you a number. That number is worthless if the query is authority-locked: for "what is the dose of ibuprofen," no amount of clean headings gets an independent blog cited over the Mayo Clinic. `citeready-core` filters the query first, then audits the page — and it's honest that domain authority, the thing that actually decides eligibility, is off-page and unmeasurable from your HTML.

Live web version (paste a URL, no install): https://citeready.onrender.com

## Install

```
npm install citeready-core
```

## The model: citation is a two-stage funnel, not a checklist

**Stage 1 — eligibility.** Can the engine retrieve you at all? Domain authority (the real gate), crawl access, and whether your content is even in the served HTML. This is mostly off-page. An on-page tool can only see the hard disqualifiers — a `noindex` tag, a `robots.txt` that blocks `GPTBot`/`PerplexityBot`/`ClaudeBot`, or content that only appears after JS hydration. It flags those and says plainly what it cannot see.

**Stage 2 — quotability.** Among pages that clear Stage 1, which sentence gets lifted? The two highest-yield levers: a **crisp dated stat tied to a named source** (a number an engine can quote verbatim and trust), and a **heading that restates the query** (so the retriever maps the question to your section). Then answer-first opening sentences, self-contained ~130–170 word chunks, and lists/tables where content is enumerable.

Two things this deliberately does **not** score: JSON-LD/structured data and "a visible date exists." Both are widely repeated AEO advice; neither has a credible independent effect on whether an LLM quotes you. `citeready-core` reports them as notes, not points, so your score isn't inflated by things that don't move the needle.

## API

### `winnableVerdict(query) → Verdict`

Pure function, no HTML needed. Classifies the query into `winnable`, `moderate`, `soft-locked`, `locked`, or `unknown`, each with a `label`, a `detail` explaining the gate, and a concrete `action`.

```js
const v = winnableVerdict('vite vs webpack build speed');
// { level: 'winnable', label: 'Winnable (comparison)',
//   detail: 'Comparison and "alternatives" queries have no official owner...',
//   action: 'Put a comparison table near the top and a one-line verdict answer-first...' }
```

### `auditHtml(html, { query, robotsTxt, url }) → AuditResult`

Full audit. Parses the HTML with jsdom and returns `{ verdict, stage1, stage2 }`.

```js
const { auditHtml } = require('citeready-core');
const res = auditHtml(pageHtml, {
  query: 'how to fix a hydration mismatch in next.js',
  robotsTxt: fetchedRobotsTxt,   // optional; enables the AI-bot block check
  url: 'https://example.com/post'
});

res.verdict.level;          // 'winnable'
res.stage1.gatesPass;       // false if noindex or an AI bot is blocked
res.stage1.cannotSee;       // the off-page signals it refuses to fake
res.stage2.score;           // 0–100 quotability, weighted to the two safest bets
res.stage2.checks;          // each with pass, weight, label, why, and a sample of the offending text
```

Every check carries a `why` that traces to the reasoning behind it. Nothing is scored that the tool can't actually see on the page.

## Why trust the weighting

The verdict thresholds and Stage-2 weights encode one idea: retrieval-augmented answer engines retrieve first, then generate. Eligibility (retrieval) is gated by trust you can't fake from HTML; quotability (generation) rewards text that's self-contained and verbatim-liftable. Everything the library promotes or demotes follows from that, and it never claims to measure the off-page gate. If you disagree with a weight, the engine is one readable file — fork it.

## License

MIT. Built autonomously by an AI agent.
