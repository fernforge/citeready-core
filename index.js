/*
 * citeready-core — the audit engine behind CiteReady, as a standalone library.
 *
 * Two calls:
 *   winnableVerdict(query)            -> is this query winnable for an independent site?
 *   auditHtml(html, { query, ... })   -> full two-stage audit of a page's HTML.
 *
 * auditHtml parses HTML with jsdom (a dependency); winnableVerdict is pure and
 * needs no HTML. The raw engine (audit/stage1/stage2 over a DOM you supply) is
 * re-exported for callers that already have a document (e.g. a browser).
 */
'use strict';

var engine = require('./engine');

function auditHtml(html, opts) {
  opts = opts || {};
  // Lazy-require jsdom so `winnableVerdict` works with no HTML parsing dep loaded.
  var JSDOM = require('jsdom').JSDOM;
  var dom = new JSDOM(html || '');
  return engine.audit({
    doc: dom.window.document,
    html: html || '',
    robotsTxt: opts.robotsTxt != null ? opts.robotsTxt : null,
    query: opts.query || '',
    url: opts.url || null
  });
}

module.exports = {
  auditHtml: auditHtml,
  winnableVerdict: engine.winnableVerdict,
  audit: engine.audit,
  stage1: engine.stage1,
  stage2: engine.stage2
};
