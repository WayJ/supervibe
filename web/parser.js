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

  function parseEpic(name, text) {
    var fm = parseFrontmatter(text);
    var sec = splitSections(fm.body);
    var S = sec.sections;
    var epic = {
      file: name,
      id: fm.data ? fm.data.epic : null,
      status: fm.data ? fm.data.status : null,
      date: fm.data ? fm.data.date : null,
      title: sec.title,
      frontmatterError: fm.error,
      dod: parseChecklist(S['Definition of Done'] || ''),
      stubs: [], adr: [], questions: [], assets: [], crosscut: []
    };
    parseTable(S['Sprint Breakdown'] || '').rows.forEach(function (r) {
      epic.stubs.push({ sprint: r[0], state: r[1], note: r.slice(2).join(' ').trim() });
    });
    parseTable(S['Decisions (ADR)'] || '').rows.forEach(function (r) {
      epic.adr.push({ id: r[0], decision: r[1], rationale: r[2], date: r[3], evidence: r[4] });
    });
    parseTable(S['Open Questions'] || '').rows.forEach(function (r) {
      epic.questions.push({ id: r[0], question: r[1], status: r[2], resolution: r.slice(3).join(' ').trim() });
    });
    parseTable(S['Asset Disposition'] || '').rows.forEach(function (r) {
      epic.assets.push({ asset: r[0], disposition: r[1], note: r.slice(2).join(' ').trim() });
    });
    parseTable(S['Cross-cutting'] || '').rows.forEach(function (r) {
      epic.crosscut.push(r.join(' — '));
    });
    return epic;
  }

  function parseClauses(sectionText) {
    var result = { clauses: [], refs: [], smells: [] };
    var text = String(sectionText || '');
    var bullets = parseBullets(text).filter(function (b) { return /HC\d+/.test(b); });
    if (bullets.length) {
      // shape 3: target-side reference list — ids only, never bodies
      bullets.forEach(function (b) {
        (b.match(/\bHC\d+\b/g) || []).forEach(function (id) {
          result.refs.push({ id: id, text: b });
        });
      });
      return result;
    }
    var t = parseTable(text);
    if (!t.rows.length) return result; // empty / （无）
    if (t.headers && t.headers.length >= 5) {
      // shape 1: entity table (template normative)
      t.rows.forEach(function (r) {
        var row = {};
        t.headers.forEach(function (h, i) { row[h.toLowerCase()] = r[i] || ''; });
        if (/^HC\d+$/.test(row.id || '')) result.clauses.push(row);
        else result.smells.push('unrecognized clause row: ' + r.join(' | ').slice(0, 80));
      });
      return result;
    }
    if (t.headers && t.headers.length === 2) {
      // shape 2: field/value vertical table — one clause
      var row2 = {};
      var known = 0;
      t.rows.forEach(function (r) {
        var k = (r[0] || '').toLowerCase();
        if (CLAUSE_FIELDS.indexOf(k) >= 0) { row2[k] = r[1] || ''; known++; }
      });
      if (known >= 3 && row2.id) { result.clauses.push(row2); return result; }
    }
    result.smells.push('unrecognized Handover Clauses table shape');
    return result;
  }

  function parseSprint(name, text) {
    var fm = parseFrontmatter(text);
    var d = fm.data || {};
    var sec = splitSections(fm.body);
    var S = sec.sections;
    var sprint = {
      file: name,
      id: d.sprint || null,
      epic: d.epic || null,
      state: d.state || null,
      worktree: d.worktree || '',
      earlyStart: d['early-start'] === 'true',
      deferred: d['deferred-dependency'] || '',
      clausesFront: d.clauses || '',
      mergedCommit: d['merged-commit'] || '',
      title: sec.title,
      frontmatterError: fm.error,
      dod: parseChecklist(S['Definition of Done'] || ''),
      decisions: [], stories: [], scenarios: [],
      clauses: [], refs: [], smells: []
    };
    parseTable(S['Decisions (D-x)'] || '').rows.forEach(function (r) {
      sprint.decisions.push({ id: r[0], decision: r[1], rationale: r[2], evidence: r.slice(3).join(' ').trim() });
    });
    parseTable(S['Stories & Tasks'] || '').rows.forEach(function (r) {
      var joined = r.join(' — ');
      sprint.stories.push({ text: joined, plans: extractPlanLinks(joined) });
    });
    var sc = S['Acceptance Scenarios (S1–Sn)'] || '';
    var scTable = parseTable(sc);
    sprint.scenarios = (scTable.rows.length && scTable.headers)
      ? scTable.rows.map(function (r) { return r.join(' — '); })
      : parseBullets(sc);
    var cl = parseClauses(S['Handover Clauses'] || '');
    sprint.clauses = cl.clauses;
    sprint.refs = cl.refs;
    sprint.smells = cl.smells;
    return sprint;
  }

  return {
    parseFrontmatter: parseFrontmatter,
    splitSections: splitSections,
    parseTable: parseTable,
    parseChecklist: parseChecklist,
    parseBullets: parseBullets,
    extractPlanLinks: extractPlanLinks,
    parseEpic: parseEpic,
    parseClauses: parseClauses,
    parseSprint: parseSprint
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BoardParser;
