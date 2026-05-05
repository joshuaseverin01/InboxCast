import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "docs", "InboxCast_Prospectus_2026.md");
const cssPath = path.join(rootDir, "docs", "prospectus.css");
const outputPath = path.join(rootDir, "docs", "InboxCast_Prospectus_2026.pdf");

const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean);

function findChrome() {
  for (const candidate of chromeCandidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  throw new Error("Could not find Chrome/Chromium. Install Chrome or set CHROME_PATH before running this script.");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inlineMarkdown(value) {
  const codeTokens = [];
  const protectedCode = value.replace(/`([^`]+)`/g, (_match, code) => {
    const token = `@@CODE_${codeTokens.length}@@`;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  let html = escapeHtml(protectedCode)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/@@CODE_(\d+)@@/g, (_match, index) => codeTokens[Number(index)] ?? "");

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return html;
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(lines) {
  const header = splitTableRow(lines[0]);
  const rows = lines.slice(2).map(splitTableRow);

  return [
    '<div class="table-wrap">',
    "<table>",
    "<thead><tr>",
    ...header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`),
    "</tr></thead>",
    "<tbody>",
    ...rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`),
    "</tbody>",
    "</table>",
    "</div>",
  ].join("");
}

function paragraphClass(text) {
  if (text.startsWith("**Investment thesis:**")) return "callout investment";
  if (text.startsWith("**Positioning statement:**")) return "callout positioning";
  if (text.startsWith("Current limitations:")) return "callout caveat";
  if (text.startsWith("Explicit exclusions:")) return "callout caveat";
  return "";
}

function renderList(lines, ordered) {
  const tag = ordered ? "ol" : "ul";
  const pattern = ordered ? /^\d+\.\s+/ : /^-\s+/;
  return `<${tag}>${lines.map((line) => `<li>${inlineMarkdown(line.replace(pattern, ""))}</li>`).join("")}</${tag}>`;
}

function renderMarkdownBody(markdown) {
  const firstRule = markdown.split("\n").findIndex((line) => line.trim() === "---");
  const lines = (firstRule >= 0 ? markdown.split("\n").slice(firstRule + 1) : markdown.split("\n"));
  const html = [];
  const toc = [];
  let index = 0;
  let sectionOpen = false;
  let firstSection = true;

  function closeSection() {
    if (sectionOpen) {
      html.push("</section>");
      sectionOpen = false;
    }
  }

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed === "---") {
      html.push('<hr class="divider" />');
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();

      if (level === 2) {
        closeSection();
        const id = slugify(text);
        toc.push({ id, text });
        html.push(`<section class="section${firstSection ? " first-section" : ""}" id="${id}">`);
        html.push(`<h1>${inlineMarkdown(text)}</h1>`);
        firstSection = false;
        sectionOpen = true;
      } else if (level === 3) {
        html.push(`<h2>${inlineMarkdown(text)}</h2>`);
      } else {
        html.push(`<h3>${inlineMarkdown(text)}</h3>`);
      }

      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      html.push(`<div class="callout">${inlineMarkdown(quoteLines.join(" "))}</div>`);
      continue;
    }

    if (trimmed.startsWith("|") && lines[index + 1] && isTableDivider(lines[index + 1])) {
      const tableLines = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      html.push(renderTable(tableLines));
      continue;
    }

    if (/^-\s+/.test(trimmed)) {
      const listLines = [];
      while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
        listLines.push(lines[index].trim());
        index += 1;
      }
      html.push(renderList(listLines, false));
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const listLines = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        listLines.push(lines[index].trim());
        index += 1;
      }
      html.push(renderList(listLines, true));
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().match(/^(#{1,6})\s+/) &&
      lines[index].trim() !== "---" &&
      !lines[index].trim().startsWith(">") &&
      !/^-\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !(lines[index].trim().startsWith("|") && lines[index + 1] && isTableDivider(lines[index + 1]))
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    const paragraph = paragraphLines.join(" ");
    const className = paragraphClass(paragraph);
    html.push(`<p${className ? ` class="${className}"` : ""}>${inlineMarkdown(paragraph)}</p>`);
  }

  closeSection();
  return { bodyHtml: html.join("\n"), toc };
}

function renderToc(toc) {
  return toc
    .map((item) => {
      const match = item.text.match(/^(\d+)\.\s+(.+)$/);
      const number = match?.[1] ?? "";
      const label = match?.[2] ?? item.text;
      return `<li><a href="#${item.id}"><span class="toc-number">${number}</span><span>${inlineMarkdown(label)}</span></a></li>`;
    })
    .join("\n");
}

function renderDocumentStatus() {
  return `
    <aside class="status-box">
      <h2>Document Status</h2>
      <dl class="status-grid">
        <div><dt>Current stage</dt><dd>Private MVP / private beta</dd></div>
        <div><dt>Public launch</dt><dd>Not yet</dd></div>
        <div><dt>External revenue/users</dt><dd>TBD</dd></div>
        <div><dt>Formal security audit</dt><dd>Not yet</dd></div>
        <div><dt>Google OAuth verification</dt><dd>Required before broader public launch</dd></div>
      </dl>
    </aside>
  `;
}

function renderHtml(markdown, css) {
  const { bodyHtml, toc } = renderMarkdownBody(markdown);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>InboxCast - Technical Specification & Investor Prospectus</title>
    <style>${css}</style>
  </head>
  <body>
    <main>
      <section class="cover">
        <div>
          <div class="cover-mark">Private Beta Prospectus</div>
          <h1>InboxCast</h1>
          <h2>Personal AI Inbox &amp; Calendar Briefing Platform</h2>
          <p class="subtitle">A voice-first decision and action layer on top of Gmail and Calendar.</p>
          <div class="cover-meta">
            <div><strong>Technical Specification &amp; Investor Prospectus</strong></div>
            <div>Version 1.0 · Private Beta / MVP</div>
            <div>Confidential · Investor-Ready · 2026</div>
          </div>
        </div>
        <div class="capability-strip">
          <span>Briefings</span>
          <span>Audio</span>
          <span>Concierge</span>
          <span>Selected Email/Thread Read</span>
          <span>Reply Drafting</span>
          <span>Gmail Drafts</span>
        </div>
      </section>

      <section class="toc">
        <h1>Table of Contents</h1>
        <ol class="toc-grid">
          ${renderToc(toc)}
        </ol>
        ${renderDocumentStatus()}
      </section>

      <div class="prospectus-body">
        ${bodyHtml}
      </div>
    </main>
  </body>
</html>`;
}

function pageCountFromPdf(buffer) {
  const matches = buffer.toString("latin1").match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 0;
}

const markdown = fs.readFileSync(sourcePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const html = renderHtml(markdown, css);
const tempHtmlPath = path.join(os.tmpdir(), `inboxcast-prospectus-${Date.now()}.html`);
fs.writeFileSync(tempHtmlPath, html);

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(tempHtmlPath).href, { waitUntil: "networkidle0" });
  await page.emulateMediaType("print");
  await page.pdf({
    displayHeaderFooter: true,
    footerTemplate: `
      <div class="footer-template">
        <div class="footer-inner">
          <span>InboxCast · Con<span>fidential</span> · Investor Prospectus · 2026</span>
          <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      </div>
    `,
    format: "Letter",
    headerTemplate: "<div></div>",
    margin: {
      bottom: "0.72in",
      left: "0.72in",
      right: "0.72in",
      top: "0.68in",
    },
    path: outputPath,
    printBackground: true,
    preferCSSPageSize: false,
  });
} finally {
  await browser.close();
  fs.rmSync(tempHtmlPath, { force: true });
}

const pdfBuffer = fs.readFileSync(outputPath);
const pageCount = pageCountFromPdf(pdfBuffer);
console.log(`Created ${path.relative(rootDir, outputPath)}${pageCount ? ` (${pageCount} pages)` : ""}.`);
