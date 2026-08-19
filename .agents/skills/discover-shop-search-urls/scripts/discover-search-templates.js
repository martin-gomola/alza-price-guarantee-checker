#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const shopCatalog = require("../../../../src/shop-catalog.js");
const shared = require("../../../../src/shared.js");
const candidateExtraction = require("../../../../src/candidate-extraction.js");
const shopPlanning = require("../../../../src/shop-planning.js");

const ROOT = path.resolve(__dirname, "../../../..");
const SHOP_CATALOG_PATH = path.join(ROOT, "src/shop-catalog.js");
const FIXTURES_DIR = path.join(__dirname, "../references/fixtures");
const PROBE_QUERY = "samsung";
const FETCH_TIMEOUT_MS = 12000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const PARSER_SIGNALS = [
  { pattern: /c-product-card__link/i, label: "c-product-card__link (tetadrogerie.cz)" },
  { pattern: /product-tile__title/i, label: "product-tile__title (rossmann.cz)" },
  { pattern: /data-gtm-product-name/i, label: "data-gtm-product-name" },
  { pattern: /data-prodprice/i, label: "data-prodprice" }
];

const COMMON_TEMPLATES = [
  "https://www.{host}/search?q={queryPlus}",
  "https://www.{host}/search?query={queryPlus}",
  "https://www.{host}/search/?q={queryPlus}",
  "https://{host}/search?q={queryPlus}",
  "https://www.{host}/vyhladavanie?q={queryPlus}",
  "https://www.{host}/vyhladavanie/?q={queryPlus}",
  "https://www.{host}/vyhladavanie?search={queryPlus}",
  "https://www.{host}/vyhladavanie/?string={query}",
  "https://www.{host}/hladanie/?query={query}",
  "https://www.{host}/hledani?q={queryPlus}",
  "https://www.{host}/hledej?s={queryPlus}",
  "https://www.{host}/vyhledavani?q={query}",
  "https://{host}/Search/?term={query}&kw={query}",
  "https://www.{host}/search/{queryPlus}",
  "https://www.{host}/s/{query}",
  "https://www.{host}/eshop/vysledky-vyhledavani?searchtext={queryPlus}",
  "https://www.{host}/produkty/?hladaj={queryPlus}"
];

function parseArgs(argv) {
  const args = { command: "help", domains: [], query: PROBE_QUERY, saveFixture: false };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--list") {
      args.command = "list";
    } else if (token === "--audit") {
      args.command = "audit";
    } else if (token === "--discover") {
      args.command = "discover";
    } else if (token === "--probe") {
      args.command = "probe";
    } else if (token === "--save-fixture") {
      args.saveFixture = true;
    } else if (token === "--query") {
      args.query = argv[index + 1] || PROBE_QUERY;
      index += 1;
    } else if (token === "--help" || token === "-h") {
      args.command = "help";
    } else if (!token.startsWith("-")) {
      args.domains.push(normalizeDomain(token));
    }
  }

  return args;
}

function normalizeDomain(domain) {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function readConfiguredDomains() {
  const source = fs.readFileSync(SHOP_CATALOG_PATH, "utf8");
  const matches = source.matchAll(/^\s*"([a-z0-9.-]+\.(?:sk|cz))"\s*:/gm);
  return [...new Set([...matches].map((match) => match[1]))].sort();
}

function getConfiguredPolicy(domain) {
  return shopCatalog.getShopPolicy(domain);
}

function getPlannedRequests(domain, query) {
  const plan = shopPlanning.createShopPlan({
    shops: [domain],
    locale: domain.endsWith(".cz") ? "cz" : "sk",
    productName: query,
    includeDefaults: false
  });

  return plan.entries[0]?.requests || [];
}

function readManifestHosts() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const hosts = new Set();

  for (const permission of manifest.host_permissions || []) {
    const match = permission.match(/^https:\/\/(?:www\.)?([^/*]+)\/\*$/);

    if (match) {
      hosts.add(normalizeDomain(match[1]));
    }
  }

  return [...hosts].sort();
}

function buildCandidateUrls(domain, query) {
  const urls = new Set();
  const requests = getPlannedRequests(domain, query);

  for (const request of requests) {
    urls.add(request.url);
  }

  for (const host of [domain, `www.${domain}`]) {
    for (const pattern of COMMON_TEMPLATES) {
      const template = pattern.replaceAll("{host}", host);
      const encoded = encodeURIComponent(shared.normalizeWhitespace(query));
      const plusEncoded = encoded.replace(/%20/g, "+");
      urls.add(template.replaceAll("{queryPlus}", plusEncoded).replaceAll("{query}", encoded));
    }
  }

  return [...urls];
}

function extractFormTemplates(html, domain) {
  const templates = [];
  const formPattern = /<form\b[^>]*action=["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/gi;
  let formMatch;

  while ((formMatch = formPattern.exec(html))) {
    const action = formMatch[1];
    const body = formMatch[2];
    const inputPattern = /<input\b[^>]*>/gi;
    let inputMatch;
    let queryName = "";

    while ((inputMatch = inputPattern.exec(body))) {
      const tag = inputMatch[0];
      const type = (tag.match(/\btype=["']([^"']+)["']/i) || [])[1]?.toLowerCase() || "text";
      const name = (tag.match(/\bname=["']([^"']+)["']/i) || [])[1] || "";

      if (!name || type === "hidden" || type === "submit") {
        continue;
      }

      if (/search|query|q|string|term|hladaj|hled|fraze/i.test(name)) {
        queryName = name;
        break;
      }
    }

    if (!queryName) {
      continue;
    }

    try {
      const absolute = new URL(action, `https://www.${domain}/`).href;
      const url = new URL(absolute);
      url.searchParams.set(queryName, "__QUERY__");
      const template = (url.origin + url.pathname + (url.search ? `?${url.searchParams.toString()}` : ""))
        .replace("__QUERY__", "{queryPlus}");
      templates.push(template);
    } catch (_error) {
      // ignore invalid form actions
    }
  }

  return templates;
}

function detectAjaxEndpoints(html, domain) {
  const endpoints = new Set();
  const patterns = [
    /data-ajax-url=["']([^"']+)["']/gi,
    /\/vyhledavani\$d\d+-search(?:\.xml)?[^"'\\s]*/gi,
    /product-search\.services\.dmtech\.com[^"'\\s]*/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html))) {
      const value = match[1] || match[0];
      try {
        endpoints.add(new URL(value, `https://www.${domain}/`).href.replace(/&amp;/g, "&"));
      } catch (_error) {
        endpoints.add(value);
      }
    }
  }

  return [...endpoints];
}

function detectParserSignals(html) {
  return PARSER_SIGNALS.filter(({ pattern }) => pattern.test(html)).map(({ label }) => label);
}

function countPriceMentions(text) {
  return (String(text || "").match(/(?:\u20ac|K\u010d|CZK)/gi) || []).length;
}

function isBlockedBody(text) {
  const lower = String(text || "").toLowerCase();
  return /cloudflare|captcha|access denied|bot detection|recaptcha/i.test(lower) || shared.isBotChallengePage(text);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
        "accept-language": "cs-CZ,cs;q=0.9,sk-SK;q=0.8,en;q=0.7",
        "user-agent": USER_AGENT
      },
      redirect: "follow"
    });

    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      text
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      text: "",
      error: error.name === "AbortError" ? "timeout" : error.message
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function scoreResponse(text, finalUrl, query) {
  const candidate = candidateExtraction.findBestCandidate(text, finalUrl, query);

  if (candidate) {
    return { level: "confirmed", count: 1, sample: candidate.title };
  }

  const lower = String(text || "").toLowerCase();
  const hints = ["product", "produkt", "cena", "price", "vyhlad", "hled", "search", "výsled", "vysled"];

  if (hints.some((hint) => lower.includes(hint)) && text.length > 2000) {
    return { level: "maybe", count: 0, sample: "" };
  }

  return { level: "failed", count: 0, sample: "" };
}

function classifyProbe({ domain, status, text, candidateCount, ajaxEndpoints, parserSignals }) {
  const policy = getConfiguredPolicy(domain);

  if (policy?.mode === "manual") {
    return "manual_only";
  }

  if (!policy) {
    return "template_missing";
  }

  if (status === 403 || status === 429 || isBlockedBody(text)) {
    return "blocked";
  }

  if (shared.isBotChallengePage(text)) {
    return "blocked";
  }

  if (candidateCount > 0) {
    return "template_ok";
  }

  if (ajaxEndpoints.length > 0 && countPriceMentions(text) === 0) {
    return "needs_ajax_template";
  }

  if (parserSignals.length > 0 && countPriceMentions(text) > 0) {
    return "needs_parser";
  }

  if (status === 200 && text.length < 15000 && countPriceMentions(text) === 0) {
    return "spa_shell";
  }

  if (status === 200 && countPriceMentions(text) > 0) {
    return "needs_parser";
  }

  return "blocked";
}

function templateFromUrl(url, _domain, query) {
  const encoded = encodeURIComponent(shared.normalizeWhitespace(query));
  const plusEncoded = encoded.replace(/%20/g, "+");

  let template = url;

  if (template.includes(plusEncoded)) {
    template = template.replaceAll(plusEncoded, "{queryPlus}");
  } else if (template.includes(encoded)) {
    template = template.replaceAll(encoded, "{query}");
  }

  return template;
}

function saveFixture(domain, text) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const filePath = path.join(FIXTURES_DIR, `${domain}.html`);
  fs.writeFileSync(filePath, text);
  return filePath;
}

async function probeDomain(domain, query, saveFixtureFlag) {
  const requests = getPlannedRequests(domain, query);
  const primary = requests[0];

  if (!primary) {
    return {
      domain,
      diagnosis: "template_missing",
      message: "No search requests built for domain"
    };
  }

  const response = await fetchText(primary.url);
  const candidate = candidateExtraction.findBestCandidate(response.text, response.url || primary.url, query);
  const parserSignals = detectParserSignals(response.text);
  const ajaxFromResponse = detectAjaxEndpoints(response.text, domain);

  let searchPageHtml = response.text;
  if (primary.displayUrl && primary.displayUrl !== primary.url) {
    const displayResponse = await fetchText(primary.displayUrl);
    searchPageHtml += displayResponse.text;
  }

  const ajaxEndpoints = [...new Set([...ajaxFromResponse, ...detectAjaxEndpoints(searchPageHtml, domain)])];
  const diagnosis = classifyProbe({
    domain,
    status: response.status,
    text: response.text,
    candidateCount: candidate ? 1 : 0,
    ajaxEndpoints,
    parserSignals
  });

  let fixturePath = "";

  if (saveFixtureFlag && response.text) {
    fixturePath = saveFixture(domain, response.text);
  }

  return {
    domain,
    diagnosis,
    configured: Boolean(getConfiguredPolicy(domain)),
    fetchUrl: primary.url,
    displayUrl: primary.displayUrl || primary.url,
    status: response.status,
    htmlLength: response.text.length,
    priceMentions: countPriceMentions(response.text),
    candidateCount: candidate ? 1 : 0,
    sample: candidate?.title || "",
    samplePrice: candidate?.price?.text || "",
    parserSignals,
    ajaxEndpoints,
    fixturePath,
    error: response.error || ""
  };
}

async function discoverDomain(domain, query) {
  const configured = Boolean(getConfiguredPolicy(domain));
  const homepageUrls = [`https://www.${domain}/`, `https://${domain}/`];
  const candidateTemplates = new Set();

  for (const homepageUrl of homepageUrls) {
    const homepage = await fetchText(homepageUrl);

    if (homepage.ok && homepage.text) {
      for (const template of extractFormTemplates(homepage.text, domain)) {
        candidateTemplates.add(template);
      }

      for (const endpoint of detectAjaxEndpoints(homepage.text, domain)) {
        candidateTemplates.add(endpoint.replace(/test|samsung|BREF/gi, encodeURIComponent(query)));
      }
    }
  }

  for (const url of buildCandidateUrls(domain, query)) {
    candidateTemplates.add(url);
  }

  const results = [];

  for (const candidateUrl of candidateTemplates) {
    const response = await fetchText(candidateUrl);
    const score = scoreResponse(response.text, response.url, query);

    if (!response.ok && response.status >= 400) {
      score.level = "failed";
    }

    results.push({
      url: candidateUrl,
      status: response.status,
      ok: response.ok,
      finalUrl: response.url,
      template: templateFromUrl(candidateUrl, domain, query),
      ...score,
      error: response.error || ""
    });
  }

  results.sort((a, b) => {
    const rank = { confirmed: 0, maybe: 1, failed: 2 };
    return rank[a.level] - rank[b.level] || b.count - a.count || b.status - a.status;
  });

  return { domain, configured, results: results.slice(0, 15) };
}

function printHelp() {
  console.log(`Usage:
  node discover-search-templates.js --list
  node discover-search-templates.js --audit [DOMAIN...]
  node discover-search-templates.js --discover DOMAIN [--query "probe"]
  node discover-search-templates.js --probe DOMAIN [--query "probe"] [--save-fixture]

Examples:
  node discover-search-templates.js --probe rossmann.cz --query BREF
  node discover-search-templates.js --discover newshop.cz
  node discover-search-templates.js --audit
  node discover-search-templates.js --probe tetadrogerie.cz --save-fixture

Diagnosis codes: template_missing, template_ok, needs_parser, needs_ajax_template,
blocked, spa_shell, manual_only
See references/failure-modes.md
`);
}

function printList(domains) {
  console.log(`Configured search templates (${domains.length}):`);
  for (const domain of domains) {
    const manual = getConfiguredPolicy(domain)?.mode === "manual" ? " [manual-only]" : "";
    console.log(`  ${domain}${manual}`);
  }
}

function printProbe(report) {
  console.log(`\n=== ${report.domain} ===`);
  console.log(`diagnosis:     ${report.diagnosis}`);
  console.log(`configured:    ${report.configured}`);
  console.log(`fetch URL:     ${report.fetchUrl}`);
  console.log(`display URL:   ${report.displayUrl}`);
  console.log(`HTTP:          ${report.status}  (${report.htmlLength} bytes, ${report.priceMentions} price mentions)`);
  console.log(`candidates:    ${report.candidateCount}${report.sample ? `  sample: ${report.sample} @ ${report.samplePrice}` : ""}`);

  if (report.parserSignals.length > 0) {
    console.log(`parser signals: ${report.parserSignals.join("; ")}`);
  }

  if (report.ajaxEndpoints.length > 0) {
    console.log("ajax endpoints:");
    for (const endpoint of report.ajaxEndpoints.slice(0, 5)) {
      console.log(`  ${endpoint}`);
    }
  }

  if (report.fixturePath) {
    console.log(`fixture saved: ${report.fixturePath}`);
  }

  if (report.error) {
    console.log(`error: ${report.error}`);
  }

  const nextSteps = {
    template_missing: "Run --discover and add a shop policy + manifest + test",
    template_ok: "Done — verify in extension UI",
    needs_parser: "Add extractor in candidate-extraction.js + fixture test (see parser-integration.md)",
    needs_ajax_template: "Add dual template url/displayUrl (see failure-modes.md, rossmann.cz)",
    blocked: "Manual fallback; extension may still work — test in Chrome",
    spa_shell: "Inspect DevTools Network; likely SPA (dm.cz pattern)",
    manual_only: "Display URL only — do not expect automated fetch"
  };

  console.log(`next step:     ${nextSteps[report.diagnosis] || "Inspect manually"}`);
}

function printDiscovery(report) {
  console.log(`\n${report.domain}${report.configured ? " (already configured)" : " (missing template)"}`);
  console.log("-".repeat(60));

  if (report.results.length === 0) {
    console.log("  No candidates generated.");
    return;
  }

  for (const result of report.results) {
    const tag = result.level.toUpperCase().padEnd(9);
    console.log(`  [${tag}] HTTP ${result.status}  ${result.template}`);

    if (result.count > 0) {
      console.log(`           products: ${result.count}  sample: ${result.sample}`);
    }

    if (result.error) {
      console.log(`           error: ${result.error}`);
    }
  }

  const best = report.results.find((result) => result.level === "confirmed") || report.results[0];

  if (best && best.level !== "failed") {
    console.log("\nSuggested shop policy entry:");
    console.log(`  "${report.domain}": { searchTemplates: ["${best.template}"] },`);
    console.log("\nRun --probe after adding to verify parsing.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "help") {
    printHelp();
    return;
  }

  if (args.command === "list") {
    printList(readConfiguredDomains());
    return;
  }

  const domains =
    args.domains.length > 0
      ? args.domains
      : args.command === "audit"
        ? readManifestHosts().filter((host) => !getConfiguredPolicy(host) && !/^alza/.test(host))
        : [];

  if (args.command === "audit") {
    const missing = domains.filter((host) => !getConfiguredPolicy(host));

    if (missing.length === 0) {
      console.log("All manifest hosts have search templates.");
    } else {
      console.log(`Missing templates (${missing.length}): ${missing.join(", ")}`);
    }

    return;
  }

  if (domains.length === 0) {
    console.error("Provide at least one domain, or use --list / --audit.");
    printHelp();
    process.exit(1);
  }

  for (const domain of domains) {
    if (args.command === "probe") {
      printProbe(await probeDomain(domain, args.query, args.saveFixture));
    } else {
      printDiscovery(await discoverDomain(domain, args.query));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
