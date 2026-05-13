import { fetchJsonWithRetry, freeDataCache, withQuery } from "../../cache/index.js";

const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";

export async function fetchRssFeed(url, options = {}) {
  if (!url) throw new Error("RSS feed URL is required");
  const { value, cacheStatus, stale } = await freeDataCache.getOrFetch(`rss:${url}`, async () => {
    const response = await fetch(url, { headers: { "user-agent": "ClusterFi-free-v1/1.0" } });
    if (!response.ok) throw new Error(`RSS HTTP ${response.status}: ${(await response.text()).slice(0, 160)}`);
    return response.text();
  }, {
    ttlMs: options.ttlMs ?? 5 * 60_000,
    source: url,
  });
  return { items: parseRss(value).slice(0, options.limit || 20), cacheStatus, stale: Boolean(stale), source: url };
}

export async function searchNews(query, options = {}) {
  if (!query) throw new Error("query is required");
  const url = withQuery(GDELT_DOC_API, {
    query,
    mode: "ArtList",
    format: "json",
    maxrecords: options.limit || 10,
    sort: options.sort || "hybridrel",
  });
  const { value, cacheStatus, stale } = await freeDataCache.getOrFetch(`gdelt:${url}`, () => fetchJsonWithRetry(url), {
    ttlMs: options.ttlMs ?? 5 * 60_000,
    source: url,
  });
  const items = normalizeNewsItems(value.articles || value.items || []);
  return { items, cacheStatus, stale: Boolean(stale), source: url };
}

export async function getEventContext({ query, rssFeeds = [], limit = 10 } = {}) {
  const [gdelt, ...rssResults] = await Promise.all([
    query ? searchNews(query, { limit }).catch((error) => ({ items: [], source: GDELT_DOC_API, error: error.message })) : Promise.resolve({ items: [], source: null }),
    ...rssFeeds.map((feed) => fetchRssFeed(feed, { limit }).catch((error) => ({ items: [], source: feed, error: error.message }))),
  ]);
  const items = normalizeNewsItems([...gdelt.items, ...rssResults.flatMap((result) => result.items || [])])
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, limit);
  return {
    query,
    items,
    sources: [gdelt.source, ...rssResults.map((result) => result.source)].filter(Boolean),
    riskNotes: [
      gdelt.error ? `GDELT search failed for ${query}: ${gdelt.error}` : null,
      ...rssResults.filter((result) => result.error).map((result) => `RSS fetch failed for ${result.source}: ${result.error}`),
    ].filter(Boolean),
    timestamp: new Date().toISOString(),
  };
}

export function normalizeNewsItems(items = []) {
  const seen = new Set();
  return items.map((item) => {
    const normalized = {
      title: decodeHtml(item.title || item.seendate || ""),
      url: item.url || item.link || item.guid || null,
      source: item.domain || item.source || item.sourceCountry || item.feed || null,
      publishedAt: normalizeDate(item.seendate || item.pubDate || item.published || item.isoDate || item.date),
      summary: decodeHtml(item.summary || item.description || item.snippet || ""),
      language: item.language || null,
    };
    return normalized;
  }).filter((item) => {
    const key = item.url || item.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function buildNewsContext(input = {}) {
  return getEventContext(input);
}

function parseRss(xml) {
  const itemPattern = /<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi;
  return [...String(xml).matchAll(itemPattern)].map(([item]) => ({
    title: tagText(item, "title"),
    link: tagText(item, "link") || attrValue(item, "link", "href"),
    guid: tagText(item, "guid") || tagText(item, "id"),
    pubDate: tagText(item, "pubDate") || tagText(item, "published") || tagText(item, "updated"),
    description: stripTags(tagText(item, "description") || tagText(item, "summary") || tagText(item, "content")),
  }));
}

function tagText(xml, tag) {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return match ? decodeHtml(stripCdata(match[1]).trim()) : "";
}

function attrValue(xml, tag, attr) {
  const match = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["'][^>]*>`, "i").exec(xml);
  return match?.[1] || "";
}

function stripCdata(value) {
  return String(value).replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function stripTags(value) {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeDate(value) {
  if (!value) return null;
  const parsed = /^\d{14}$/.test(String(value))
    ? new Date(`${String(value).slice(0, 4)}-${String(value).slice(4, 6)}-${String(value).slice(6, 8)}T${String(value).slice(8, 10)}:${String(value).slice(10, 12)}:${String(value).slice(12, 14)}Z`)
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
