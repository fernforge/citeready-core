'use strict';
var assert = require('assert');
var cr = require('./index');

var pass = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  pass++;
}

// --- winnableVerdict (no HTML needed) ---
ok('YMYL locks', cr.winnableVerdict('best treatment for anxiety').level === 'locked');
ok('debug is winnable', cr.winnableVerdict("fix CORS error in fetch").level === 'winnable');
ok('comparison is winnable', cr.winnableVerdict('vite vs webpack').level === 'winnable');
ok('canonical API soft-locks', cr.winnableVerdict('react useEffect api reference').level === 'soft-locked');
ok('software how-to winnable', cr.winnableVerdict('how to deploy a node app').level === 'winnable');
ok('general is moderate', cr.winnableVerdict('best hiking trails near portland').level === 'moderate');
ok('empty is unknown', cr.winnableVerdict('').level === 'unknown');

// --- auditHtml ---
var good = '<html><head><meta name="robots" content="index"></head><body>' +
  '<h1>How to know if ChatGPT will cite your page</h1>' +
  '<p>To know if ChatGPT will cite your page, check two gates: retrieval eligibility and quotability. ' +
  Array(60).fill('This passage explains the reasoning in a self-contained way that stands alone as an extractable unit.').join(' ') + '</p>' +
  '<p>According to a 2024 survey, 43% of answer-engine citations came from pages under 170 words per chunk.</p>' +
  '<ul><li>step one</li><li>step two</li></ul>' +
  '</body></html>';
var r = cr.auditHtml(good, { query: 'how to know if ChatGPT will cite your page', robotsTxt: 'User-agent: *\nAllow: /' });
ok('audit returns verdict', r.verdict && r.verdict.level === 'moderate');
ok('stage1 gates pass', r.stage1.gatesPass === true);
ok('stage2 score present', typeof r.stage2.score === 'number' && r.stage2.score > 0);
ok('heading match detected', r.stage2.checks.find(function (c) { return c.key === 'query-heading'; }).pass === true);
ok('dated stat detected', r.stage2.checks.find(function (c) { return c.key === 'dated-stat'; }).pass === true);

// noindex hard gate
var bad = cr.auditHtml('<html><head><meta name="robots" content="noindex"></head><body><p>hi there friend</p></body></html>', { query: 'x' });
ok('noindex fails gate', bad.stage1.gatesPass === false);

// AI-bot block
var blocked = cr.auditHtml('<html><body><p>content</p></body></html>', {
  query: 'x', robotsTxt: 'User-agent: GPTBot\nDisallow: /'
});
ok('GPTBot block fails gate', blocked.stage1.gatesPass === false);

console.log('\n' + pass + ' passed, 0 failed');
