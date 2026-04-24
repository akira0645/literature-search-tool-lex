#!/usr/bin/env node
// Literature search tool — OpenAlex API (free, no key required)
// Usage: node search.mjs "your keywords" [--limit 20] [--year 2020-2026]

import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.openalex.org/works';
// OpenAlex "polite pool" — faster responses when you identify yourself.
// Set OPENALEX_EMAIL in your environment before running.
const MAILTO = process.env.OPENALEX_EMAIL;
if (!MAILTO) {
  console.error('Error: environment variable OPENALEX_EMAIL is not set.');
  console.error('');
  console.error('  Windows (PowerShell):  $env:OPENALEX_EMAIL="you@example.com"');
  console.error('  macOS / Linux (bash):  export OPENALEX_EMAIL="you@example.com"');
  console.error('');
  console.error('See https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication');
  process.exit(1);
}

function parseArgs(argv) {
  const args = { query: null, limit: 20, year: null, out: null, sort: 'relevance_score:desc' };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--year') args.year = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--sort') {
      const s = argv[++i];
      // Shortcuts: "relevance" / "citations" / "recent"
      args.sort = s === 'relevance' ? 'relevance_score:desc'
              : s === 'citations' ? 'cited_by_count:desc'
              : s === 'recent' ? 'publication_date:desc'
              : s;
    }
    else rest.push(a);
  }
  args.query = rest.join(' ').trim();
  return args;
}

// OpenAlex stores abstracts as inverted indices (license reasons).
// Reconstruct word order: {"word": [positions]} -> sentence.
function reconstructAbstract(idx) {
  if (!idx) return null;
  const words = [];
  for (const [word, positions] of Object.entries(idx)) {
    for (const pos of positions) words[pos] = word;
  }
  return words.filter(Boolean).join(' ');
}

async function searchPapers({ query, limit, year, sort }) {
  const perPage = Math.min(limit, 200);
  const filters = [];
  if (year) {
    // Accept "2020-", "2020-2026", "2020"
    const m = year.match(/^(\d{4})(?:-(\d{4})?)?$/);
    if (m) {
      filters.push(`from_publication_date:${m[1]}-01-01`);
      if (m[2]) filters.push(`to_publication_date:${m[2]}-12-31`);
    }
  }
  const params = new URLSearchParams({
    search: query,
    per_page: String(perPage),
    sort,
    mailto: MAILTO,
  });
  if (filters.length) params.set('filter', filters.join(','));

  const url = `${API}?${params}`;
  process.stderr.write(`→ Fetching: ${url}\n`);

  const res = await fetch(url, {
    headers: { 'User-Agent': `LitSearch/0.2 (mailto:${MAILTO})` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.results || [];
}

function authorsShort(authorships, max = 3) {
  if (!authorships?.length) return 'Unknown';
  const names = authorships.map(a => a.author?.display_name).filter(Boolean);
  if (names.length <= max) return names.join(', ');
  return names.slice(0, max).join(', ') + `, et al. (${names.length})`;
}

function venueOf(work) {
  return work.primary_location?.source?.display_name
      || work.host_venue?.display_name
      || '-';
}

function doiLink(work) {
  if (work.doi) return work.doi.startsWith('http') ? work.doi : `https://doi.org/${work.doi.replace(/^doi:/i, '')}`;
  return work.id || null;
}

function openAccessPdf(work) {
  if (work.open_access?.oa_url) return work.open_access.oa_url;
  if (work.primary_location?.pdf_url) return work.primary_location.pdf_url;
  return null;
}

function conceptsShort(concepts, max = 5) {
  if (!concepts?.length) return '';
  return concepts.slice(0, max).map(c => c.display_name).join(', ');
}

function buildReport(query, works) {
  const lines = [];
  const now = new Date().toISOString().slice(0, 10);

  lines.push(`# 文獻搜尋報告:${query}`);
  lines.push('');
  lines.push(`- **查詢日期**:${now}`);
  lines.push(`- **來源**:OpenAlex`);
  lines.push(`- **結果數**:${works.length}`);
  lines.push('');

  // Overview table
  lines.push('## 📊 總覽表');
  lines.push('');
  lines.push('| # | 年份 | 引用數 | 標題 | 作者 | 期刊/會議 |');
  lines.push('|---|------|-------|------|------|----------|');
  works.forEach((w, i) => {
    const title = (w.title || 'Untitled').replace(/\|/g, '\\|').slice(0, 80);
    const authors = authorsShort(w.authorships, 2).replace(/\|/g, '\\|');
    const venue = venueOf(w).replace(/\|/g, '\\|').slice(0, 40);
    lines.push(
      `| ${i + 1} | ${w.publication_year || '?'} | ${w.cited_by_count ?? 0} | ${title} | ${authors} | ${venue} |`
    );
  });
  lines.push('');

  // Detailed summaries
  lines.push('## 📚 單篇詳細資訊');
  lines.push('');
  works.forEach((w, i) => {
    const link = doiLink(w);
    const titleLine = link
      ? `### [${i + 1}] [${w.title}](${link})`
      : `### [${i + 1}] ${w.title}`;
    lines.push(titleLine);
    lines.push('');
    lines.push(`- **作者**:${authorsShort(w.authorships, 10)}`);
    lines.push(`- **年份**:${w.publication_year || 'N/A'}`);
    lines.push(`- **期刊/會議**:${venueOf(w)}`);
    lines.push(`- **引用數**:${w.cited_by_count ?? 0}`);
    if (w.type) lines.push(`- **類型**:${w.type}`);
    const concepts = conceptsShort(w.concepts, 6);
    if (concepts) lines.push(`- **主題標籤**:${concepts}`);
    if (w.doi) lines.push(`- **DOI**:${w.doi.replace(/^https?:\/\/doi\.org\//, '')}`);
    const pdf = openAccessPdf(w);
    if (pdf) lines.push(`- **免費 PDF**:${pdf}`);
    lines.push('');

    const abstract = reconstructAbstract(w.abstract_inverted_index);
    if (abstract) {
      lines.push('**Abstract**:');
      lines.push('');
      lines.push('> ' + abstract.replace(/\n+/g, ' '));
      lines.push('');
    } else {
      lines.push('_(此篇無公開摘要)_');
      lines.push('');
    }

    lines.push('**🔍 理論框架分析**:_(待 Claude 閱讀摘要後填寫)_');
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

function safeFilename(s) {
  return s.replace(/[^\w一-龥-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.query) {
    console.error('Usage: node search.mjs "<keywords>" [options]');
    console.error('');
    console.error('Options:');
    console.error('  --limit N          number of results (default 20, max 200)');
    console.error('  --year 2020-2026   publication year range');
    console.error('  --sort MODE        relevance (default) | citations | recent');
    console.error('  --out FILE         output markdown path');
    console.error('');
    console.error('Examples:');
    console.error('  node search.mjs "online learning engagement"');
    console.error('  node search.mjs "theory of planned behavior e-learning" --limit 30 --year 2020-');
    console.error('  node search.mjs "digital inequality" --sort citations --year 2022-2026');
    process.exit(1);
  }

  const works = await searchPapers(args);
  if (!works.length) {
    console.error('No results. Try different keywords.');
    process.exit(2);
  }

  const report = buildReport(args.query, works);
  const outDir = path.join(process.cwd(), 'results');
  await fs.mkdir(outDir, { recursive: true });
  const outFile = args.out || path.join(outDir, `${safeFilename(args.query)}.md`);
  await fs.writeFile(outFile, report, 'utf8');

  // Also save raw JSON for later analysis
  const jsonFile = outFile.replace(/\.md$/, '.json');
  await fs.writeFile(jsonFile, JSON.stringify(works, null, 2), 'utf8');

  process.stderr.write(`✓ ${works.length} papers saved:\n`);
  process.stderr.write(`  report: ${outFile}\n`);
  process.stderr.write(`  raw:    ${jsonFile}\n`);
  console.log(outFile);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
