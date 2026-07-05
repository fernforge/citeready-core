/*
 * CiteReady v2 audit engine.
 *
 * Correctness rebuild grounded on the validated GEO citation map. Two-stage funnel:
 *   Stage 1 — eligibility/retrieval gate (mostly OFF-PAGE; on-page audit can only see
 *             the crawl-access hard gates and content-rendering, not domain authority).
 *   Stage 2 — quotability (on-page, fully auditable — this is what the tool owns).
 *
 * Plus the differentiator: an "is this query winnable for an independent site?" verdict.
 *
 * Every check carries a `why` traced to a measured finding, and JSON-LD + visible-date
 * are demoted to NULL notes (they measured null in the ablation; v1 over-weighted them).
 *
 * Runs in the browser (attaches to window.CiteReady) and in Node (module.exports) so the
 * same logic is unit-tested headlessly.
 */
(function (root) {
  'use strict';

  // ---- helpers -------------------------------------------------------------

  function words(str) {
    return (str || '').trim().split(/\s+/).filter(Boolean);
  }

  function tokenize(str) {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(function (w) { return w.length > 2 && !STOP.has(w); });
  }

  var STOP = new Set(['the', 'and', 'for', 'are', 'you', 'your', 'how', 'what', 'why',
    'can', 'does', 'with', 'from', 'this', 'that', 'will', 'has', 'have', 'was', 'get',
    'into', 'about', 'when', 'which', 'who', 'whom', 'best', 'top']);

  // Overlap of query tokens present in a piece of text (0..1 of query tokens matched).
  function overlap(queryTokens, text) {
    if (!queryTokens.length) return 0;
    var textToks = new Set(tokenize(text));
    var hit = 0;
    queryTokens.forEach(function (t) { if (textToks.has(t)) hit++; });
    return hit / queryTokens.length;
  }

  // ---- winnable-query verdict (THE differentiator) -------------------------
  // The retrieval gate's height scales with question STAKES. This classifies the
  // query, not the page — it is a market filter, the reason the tool exists.

  var YMYL = /\b(medical|health|symptom|symptoms|disease|diagnos|treatment|dosage|drug|medication|cancer|covid|therapy|mental health|depression|anxiety|legal|lawyer|attorney|lawsuit|court|tax|taxes|irs|invest|investing|investment|stocks|mortgage|loan|loans|insurance|retirement|401k|crypto|bankruptcy|immigration|visa|custody|divorce|nutrition|diet|supplement|pregnan|vaccine)\b/i;

  // Looks like a canonical API/signature lookup — soft-locked by official docs.
  var CANONICAL_API = /\b(api|sdk|endpoint|method|function|parameter|argument|syntax|signature|reference|documentation|docs|official|import|install|npm install|pip install|cli command)\b/i;

  // High-intent, no-official-owner software shapes — the prime winnable zone.
  var COMPARISON = /\b(vs\.?|versus|compare|comparison|alternative|alternatives|better than|difference between|or)\b/i;
  var DEBUG = /\b(error|errors|fix|fixing|failing|fails|not working|broken|debug|troubleshoot|why is|cannot|can't|undefined|null|exception|crash|timeout|500|502|cors)\b/i;
  var SOFTWARE = /\b(javascript|typescript|python|react|node|nodejs|npm|pip|css|html|sql|docker|kubernetes|git|api|rust|golang|java|php|ruby|swift|regex|linux|bash|vue|svelte|next\.?js|tailwind|postgres|mongodb|aws|s3|lambda|webpack|vite|eslint|jest|http|json|yaml|deploy|deployment|build|compile|bundler|framework|library|package|dependency|async|await|promise|hook|component)\b/i;

  function winnableVerdict(query) {
    var q = (query || '').trim();
    if (!q) {
      return { level: 'unknown', label: 'No query given',
        detail: 'Enter the search query you want to be cited for. The gate you must clear depends entirely on what is being asked.',
        action: 'Add a target query above.' };
    }

    if (YMYL.test(q)) {
      return {
        level: 'locked',
        label: 'Authority-locked (YMYL)',
        detail: 'This is a your-money-or-your-life topic. For health, legal, and financial questions the retrieval gate favors institutional and highly-trusted sources, so an independent page rarely clears Stage 1 no matter how well-formatted it is.',
        action: "Don't invest in on-page formatting for this query alone — you can't move this gate. Win adjacent, lower-stakes long-tail questions instead, or get corroborated by a source the engines already trust."
      };
    }

    var isSoftware = SOFTWARE.test(q);
    var isCompare = COMPARISON.test(q);
    var isDebug = DEBUG.test(q);

    if (isDebug) {
      return {
        level: 'winnable',
        label: isSoftware ? 'Prime winnable (error/debug)' : 'Winnable (troubleshooting)',
        detail: 'Error and troubleshooting queries have no canonical owner — official docs describe the happy path, not the failure. A page that reproduces the exact error and gives a working fix is exactly what gets quoted.',
        action: 'Lead with the exact error string in a heading, then the fix in the first sentence. This is the highest-yield zone for an independent site.'
      };
    }

    if (isCompare) {
      return {
        level: 'winnable',
        label: 'Winnable (comparison)',
        detail: 'Comparison and "alternatives" queries have no official owner — no vendor writes an unbiased X-vs-Y page, so engines pull from independent write-ups.',
        action: 'Put a comparison table near the top and a one-line verdict answer-first. Tables and dated specifics get extracted here.'
      };
    }

    if (isSoftware && CANONICAL_API.test(q)) {
      return {
        level: 'soft-locked',
        label: 'Soft-locked (canonical API)',
        detail: 'This reads like a reference/API/syntax lookup. Those are soft-locked: the official docs are the default trusted source, so an independent page is fighting uphill for Stage 1 even with perfect formatting.',
        action: 'Retarget to a no-owner variant of this — the common error with it, a real-world example, a migration, or a comparison. Those you can win.'
      };
    }

    if (isSoftware) {
      return {
        level: 'winnable',
        label: 'Winnable (software how-to)',
        detail: 'Technical/dev how-to queries have a LOOSE gate. Engines reward the page that is genuinely correct and cleanly extractable over raw domain authority here.',
        action: 'Win with the format levers below: a query-restating heading, an answer-first first sentence, and a crisp dated stat or code example.'
      };
    }

    // General non-YMYL, non-software query.
    return {
      level: 'moderate',
      label: 'Moderately winnable',
      detail: 'This is a general-interest query, not YMYL. The gate is medium: authority helps, but a well-structured, specific page can still clear it — especially for long-tail phrasings big publishers ignore.',
      action: 'Go long-tail and specific. Match the exact phrasing in a heading and answer it in the first sentence.'
    };
  }

  // ---- Stage 1: eligibility (what an on-page audit CAN and CANNOT see) ------

  var AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User',
    'Google-Extended', 'ClaudeBot', 'Claude-Web', 'anthropic-ai', 'CCBot', 'Applebot-Extended', 'Bytespider'];

  function stage1(ctx) {
    // ctx: { doc, html, robotsTxt, query }
    var checks = [];
    var doc = ctx.doc;

    // Hard gate: robots meta noindex.
    var metaRobots = '';
    var mr = doc.querySelector('meta[name="robots"], meta[name="ROBOTS"]');
    if (mr) metaRobots = (mr.getAttribute('content') || '').toLowerCase();
    var noindex = /noindex|none/.test(metaRobots);
    checks.push({
      key: 'noindex', pass: !noindex, gate: true,
      label: noindex ? 'Page is set to noindex — invisible to retrieval' : 'Page is indexable (no noindex)',
      why: 'A noindex meta robots tag removes the page from the retrieval pool entirely; nothing downstream matters if this fails.'
    });

    // Hard gate: AI-bot blocking in robots.txt.
    var blocked = [];
    if (ctx.robotsTxt != null) {
      var lines = ctx.robotsTxt.split(/\r?\n/);
      var current = [];
      var disallowAll = {};
      lines.forEach(function (raw) {
        var line = raw.replace(/#.*$/, '').trim();
        if (!line) return;
        var m = line.match(/^user-agent:\s*(.*)$/i);
        if (m) { current = [m[1].trim()]; return; }
        var d = line.match(/^disallow:\s*(.*)$/i);
        if (d && d[1].trim() === '/') {
          current.forEach(function (ua) { disallowAll[ua.toLowerCase()] = true; });
        }
      });
      AI_BOTS.forEach(function (bot) {
        if (disallowAll[bot.toLowerCase()] || (disallowAll['*'] && false)) blocked.push(bot);
      });
    }
    checks.push({
      key: 'ai-bots', pass: blocked.length === 0, gate: true,
      label: blocked.length ? ('robots.txt blocks: ' + blocked.join(', ')) : 'No AI crawler is blocked in robots.txt',
      why: 'If GPTBot / PerplexityBot / Google-Extended / ClaudeBot are disallowed, those engines cannot fetch the page to cite it. Blocking is a silent, total disqualifier.',
      note: ctx.robotsTxt == null ? "Couldn't read robots.txt — check it manually for AI-bot Disallow rules." : null
    });

    // Rendering: is the readable content in the served HTML, or JS-injected?
    var bodyText = (doc.body ? doc.body.textContent : '') || '';
    var visibleWords = words(bodyText).length;
    var ssrOk = visibleWords >= 250;
    checks.push({
      key: 'ssr', pass: ssrOk, gate: false,
      label: ssrOk ? ('Content is server-rendered (~' + visibleWords + ' words in HTML)')
        : ('Thin server HTML (~' + visibleWords + ' words) — content may be JS-rendered'),
      why: 'Answer-engine crawlers largely index the fetched HTML, not a full JS render. If the substance only appears after client-side hydration, it may never be seen.'
    });

    // Off-page signals the tool CANNOT measure — stated honestly, not scored.
    var cannotSee = [
      'Domain authority / trust — this is THE gate and it is entirely off-page. We do not and cannot measure it.',
      'Source independence and who else corroborates your claim across other domains.',
      'Whether the engines consider your site a known entity for this topic.'
    ];

    var gatesPass = checks.filter(function (c) { return c.gate; }).every(function (c) { return c.pass; });
    return { checks: checks, cannotSee: cannotSee, gatesPass: gatesPass, visibleWords: visibleWords };
  }

  // ---- Stage 2: quotability (on-page, fully auditable) ---------------------

  // A crisp dated named-source stat: a number/percent sitting near a year and (ideally)
  // a source attribution. This is the single highest-yield quotability lever.
  var STAT = /(\d[\d,.]*\s?(?:%|percent|x|×|billion|million|thousand|bn|k\b)|\$\s?\d[\d,.]*)/i;
  var YEAR = /\b(19|20)\d{2}\b/;
  var SOURCE_CUE = /\b(according to|per|study|survey|report|research|data|analysis|found that|reported|source|census|gartner|mckinsey|statista|pew)\b/i;

  function headings(doc) {
    return Array.prototype.slice.call(doc.querySelectorAll('h1,h2,h3'))
      .map(function (h) { return (h.textContent || '').trim(); })
      .filter(Boolean);
  }

  function paragraphs(doc) {
    return Array.prototype.slice.call(doc.querySelectorAll('p,li'))
      .map(function (p) { return (p.textContent || '').trim(); })
      .filter(function (t) { return words(t).length >= 4; });
  }

  function stage2(ctx) {
    var doc = ctx.doc;
    var qTokens = tokenize(ctx.query);
    var checks = [];
    var hs = headings(doc);
    var ps = paragraphs(doc);
    var allText = ps.join(' \n ');

    // 1. Query-restating heading (top lever, pays off at both stages).
    var bestHeadOverlap = 0, bestHead = '';
    hs.forEach(function (h) {
      var o = overlap(qTokens, h);
      if (o > bestHeadOverlap) { bestHeadOverlap = o; bestHead = h; }
    });
    var headMatch = ctx.query ? bestHeadOverlap >= 0.5 : null;
    checks.push({
      key: 'query-heading', weight: 3, pass: headMatch,
      label: !ctx.query ? 'Add a target query to check heading match'
        : headMatch ? ('A heading restates the query: "' + bestHead + '"')
          : 'No heading closely restates the target query',
      why: 'Engines map a question to the heading that mirrors it, then quote the text underneath. A heading that restates the query is one of the two safest bets in the whole model.'
    });

    // 2. Crisp dated named-source stat (top lever).
    var statPara = ps.find(function (p) { return STAT.test(p) && (YEAR.test(p) || SOURCE_CUE.test(p)); });
    var anyStat = ps.find(function (p) { return STAT.test(p); });
    var statPass = !!statPara;
    checks.push({
      key: 'dated-stat', weight: 3, pass: statPass,
      label: statPass ? 'Has a crisp stat tied to a date/source'
        : anyStat ? 'Has numbers, but none tied to a date or named source'
          : 'No crisp statistic found',
      why: 'A specific number attached to a year and a named source is the most-quoted unit in AI answers — it is citable verbatim and self-authenticating. This is the other safest bet.',
      sample: statPara ? statPara.slice(0, 160) : null
    });

    // 3. Answer-first first sentence.
    var firstPara = ps[0] || '';
    var firstSentence = firstPara.split(/(?<=[.!?])\s/)[0] || firstPara;
    var answerFirst = ctx.query
      ? (overlap(qTokens, firstSentence) >= 0.4 && words(firstSentence).length <= 45)
      : words(firstSentence).length > 0 && words(firstSentence).length <= 45;
    checks.push({
      key: 'answer-first', weight: 2, pass: answerFirst,
      label: answerFirst ? 'Opens answer-first (direct, self-contained lead)'
        : 'Lead sentence buries or delays the answer',
      why: 'Extractors favor a first sentence that answers the question outright. A long wind-up before the answer gets skipped.',
      sample: firstSentence.slice(0, 160)
    });

    // 4. Self-contained ~130-170w chunks.
    var goodChunks = ps.filter(function (p) { var w = words(p).length; return w >= 100 && w <= 200; }).length;
    var longChunks = ps.filter(function (p) { return words(p).length > 200; }).length;
    var chunkPass = goodChunks >= 1;
    checks.push({
      key: 'chunk-size', weight: 2, pass: chunkPass,
      label: chunkPass ? (goodChunks + ' well-sized, self-contained passage(s) (~130–170 words)')
        : (longChunks ? 'Passages run long (>200w) — split into self-contained chunks'
          : 'Passages are short/fragmentary — group into ~130–170w answers'),
      why: 'Retrieval chunks text; a passage that stands alone at roughly 130–170 words is the ideal extractable unit. Too long dilutes it, too short lacks context.'
    });

    // 5. Lists / tables when enumerable.
    var hasList = doc.querySelector('ul,ol') != null;
    var hasTable = doc.querySelector('table') != null;
    checks.push({
      key: 'lists-tables', weight: 1, pass: hasList || hasTable,
      label: (hasList || hasTable) ? ('Uses ' + [hasList ? 'lists' : null, hasTable ? 'tables' : null].filter(Boolean).join(' & '))
        : 'No lists or tables — add them where content is enumerable',
      why: 'Steps, rankings, and specs get pulled as structured lists/tables. When content is enumerable, formatting it as a list makes it directly liftable.'
    });

    // --- Demoted to NULL notes (v1 over-weighted these; the ablation measured null) ---
    var notes = [];
    var jsonld = doc.querySelector('script[type="application/ld+json"]') != null;
    notes.push({
      key: 'jsonld', present: jsonld,
      label: jsonld ? 'JSON-LD present (fine, but not a citation lever)' : 'No JSON-LD',
      why: 'Measured NULL for AI citation in a controlled ablation — its apparent lift was authority confounding. Keep it for classic SEO if you like; do not expect it to move AI citation. v1 weighted this at 20%; that was wrong.'
    });
    var timeEl = doc.querySelector('time, [datetime]') != null;
    notes.push({
      key: 'visible-date', present: timeEl,
      label: timeEl ? 'Visible date present (near-null on its own)' : 'No visible date',
      why: 'A date existing is a measured NULL. Only engine-dependent RECENCY matters — Perplexity favors fresh, Claude largely does not. Being dated is not the same as being recent.'
    });

    var scored = checks.filter(function (c) { return c.pass !== null; });
    var maxW = scored.reduce(function (s, c) { return s + c.weight; }, 0);
    var gotW = scored.reduce(function (s, c) { return s + (c.pass ? c.weight : 0); }, 0);
    var score = maxW ? Math.round((gotW / maxW) * 100) : 0;
    return { checks: checks, notes: notes, score: score };
  }

  // ---- top-level audit -----------------------------------------------------

  function audit(ctx) {
    // ctx: { doc, html, robotsTxt, query, url }
    return {
      url: ctx.url || null,
      query: ctx.query || null,
      verdict: winnableVerdict(ctx.query),
      stage1: stage1(ctx),
      stage2: stage2(ctx)
    };
  }

  var api = { audit: audit, winnableVerdict: winnableVerdict, stage1: stage1, stage2: stage2,
    _internal: { tokenize: tokenize, overlap: overlap } };
  root.CiteReady = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
