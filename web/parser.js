// parser.js — supervibe board parsing/aggregation. Pure functions, no DOM.
// Classic script by design: ES modules are CORS-blocked on file:// pages,
// classic sibling scripts are not. board.html loads this via <script src>;
// Node tests load it through the CommonJS guard at the bottom.
var BoardParser = (function () {
  'use strict';

  var CLAUSE_FIELDS = ['id', 'issuer sprint', 'issuer', 'target sprint', 'target',
    'trigger', 'obligation', 'status', 'evidence'];

  // ---- primitives ----

  function parseFrontmatter(text) {
    var s = String(text).replace(/^﻿/, '');
    if (!(s.startsWith('---\n') || s.startsWith('---\r\n'))) {
      return { data: null, body: s, error: 'missing frontmatter fence' };
    }
    var rest = s.replace(/^---\r?\n/, '');
    var m = /^---\r?\n/m.exec(rest);
    if (!m) return { data: null, body: s, error: 'unterminated frontmatter' };
    var data = {};
    rest.slice(0, m.index).split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var i = line.indexOf(':');
      if (i < 1) return;
      data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    return { data: data, body: rest.slice(m.index + m[0].length), error: null };
  }

  function splitSections(body) {
    var title = null;
    var sections = {};
    var current = null;
    String(body).split(/\r?\n/).forEach(function (line) {
      if (current === null && title === null && /^# [^#]/.test(line)) {
        title = line.slice(2).trim();
        return;
      }
      var m = /^## (.*)$/.exec(line);
      if (m) { current = m[1].trim(); sections[current] = []; return; }
      if (current !== null) sections[current].push(line);
    });
    var out = { title: title, sections: {} };
    Object.keys(sections).forEach(function (k) { out.sections[k] = sections[k].join('\n'); });
    return out;
  }

  function parseTable(text) {
    var rows = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (t.charAt(0) === '|') {
        var inner = t.endsWith('|') ? t.slice(1, -1) : t.slice(1);
        rows.push(inner.split('|').map(function (c) { return c.trim(); }));
      }
    });
    if (!rows.length) return { headers: null, rows: [] };
    if (rows.length > 1 && rows[1].every(function (c) { return /^:?-{3,}:?$/.test(c); })) {
      return { headers: rows[0], rows: rows.slice(2) };
    }
    return { headers: null, rows: rows };
  }

  function parseChecklist(text) {
    var items = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      var m = /^\s*-\s+\[( |x|X)\]\s*(.*)$/.exec(line);
      if (m) items.push({ done: m[1].toLowerCase() === 'x', text: m[2].trim() });
    });
    return items;
  }

  function parseBullets(text) {
    var items = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      var m = /^\s*-\s+(.+)$/.exec(line);
      if (m) items.push(m[1].trim());
    });
    return items;
  }

  function extractPlanLinks(text) {
    var seen = {};
    var out = [];
    var re = /\]\(([^)]+\.md)\)/g;
    var m;
    while ((m = re.exec(String(text))) !== null) {
      var p = m[1];
      if (/(^|\/)plans\//.test(p) && !seen[p]) { seen[p] = true; out.push(p); }
    }
    return out;
  }

  return {
    parseFrontmatter: parseFrontmatter,
    splitSections: splitSections,
    parseTable: parseTable,
    parseChecklist: parseChecklist,
    parseBullets: parseBullets,
    extractPlanLinks: extractPlanLinks
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BoardParser;
