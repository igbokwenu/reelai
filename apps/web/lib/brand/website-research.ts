import "server-only";

export type WebsiteResearch = {
  text: string;
  visualUrls: { url: string; label: string }[];
  pages: string[];
};

const PAGE_HINTS = /\b(about|product|service|pricing|brand|company|shop)\b/i;
const COLOR_PATTERN = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;

export async function researchWebsite(url: string): Promise<WebsiteResearch | null> {
  try {
    const root = new URL(url);
    if (!/^https?:$/.test(root.protocol)) return null;

    const home = await fetchPage(root.toString());
    if (!home) return null;

    const links = extractLinks(home.html, root)
      .filter((link) => link.origin === root.origin && PAGE_HINTS.test(link.pathname))
      .slice(0, 3);
    const extraPages = await Promise.all(links.map((link) => fetchPage(link.toString())));
    const pages = [home, ...extraPages.filter((page): page is FetchedPage => Boolean(page))];
    const visualUrls = dedupe(
      pages.flatMap((page) => extractVisuals(page.html, new URL(page.url))),
      (item) => item.url,
    ).slice(0, 4);

    const text = pages.map((page, index) => {
      const metadata = extractMetadata(page.html);
      const colors = [...new Set(page.html.match(COLOR_PATTERN) ?? [])].slice(0, 12);
      return [
        `PAGE ${index + 1}: ${page.url}`,
        metadata.title ? `Title: ${metadata.title}` : null,
        metadata.description ? `Description: ${metadata.description}` : null,
        metadata.siteName ? `Site name: ${metadata.siteName}` : null,
        colors.length ? `CSS/HTML color candidates: ${colors.join(", ")}` : null,
        `Visible content: ${htmlToText(page.html).slice(0, 4500)}`,
      ].filter(Boolean).join("\n");
    }).join("\n\n").slice(0, 15000);

    return { text, visualUrls, pages: pages.map((page) => page.url) };
  } catch {
    return null;
  }
}

type FetchedPage = { url: string; html: string };

async function fetchPage(url: string): Promise<FetchedPage | null> {
  return fetchPageWithRedirects(url, 0);
}

async function fetchPageWithRedirects(url: string, redirects: number): Promise<FetchedPage | null> {
  const parsed = new URL(url);
  if (isUnsafeHostname(parsed.hostname) || redirects > 3) return null;
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "ReelAI-BrandResearch/1.0" },
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    return location
      ? fetchPageWithRedirects(new URL(location, parsed).toString(), redirects + 1)
      : null;
  }
  if (!response.ok) return null;
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/html") && !type.includes("text/plain")) return null;
  return { url: response.url, html: (await response.text()).slice(0, 500_000) };
}

function isUnsafeHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^fc|^fd|^fe80:/i.test(host);
}

function extractMetadata(html: string) {
  const meta = (property: string) => {
    const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
    const tag = tags.find((item) => new RegExp(`(?:name|property)=["']${property}["']`, "i").test(item));
    return tag ? attribute(tag, "content") : null;
  };
  return {
    title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    description: meta("description") ?? meta("og:description"),
    siteName: meta("og:site_name"),
  };
}

function extractVisuals(html: string, base: URL) {
  const candidates: { url: string; label: string }[] = [];
  for (const tag of html.match(/<(?:meta|img|link)\b[^>]*>/gi) ?? []) {
    const rel = `${attribute(tag, "rel") ?? ""} ${attribute(tag, "property") ?? ""} ${attribute(tag, "class") ?? ""} ${attribute(tag, "alt") ?? ""}`;
    if (!/(logo|icon|og:image|twitter:image)/i.test(rel)) continue;
    const raw = attribute(tag, "content") ?? attribute(tag, "src") ?? attribute(tag, "href");
    if (!raw || raw.startsWith("data:")) continue;
    try {
      const url = new URL(raw, base);
      if (!isUnsafeHostname(url.hostname) && /^https?:$/.test(url.protocol)) {
        candidates.push({ url: url.toString(), label: rel.trim() || "Website brand image" });
      }
    } catch {}
  }
  return candidates;
}

function extractLinks(html: string, base: URL) {
  const links: URL[] = [];
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attribute(tag, "href");
    if (!href) continue;
    try { links.push(new URL(href, base)); } catch {}
  }
  return dedupe(links, (item) => item.toString());
}

function attribute(tag: string, name: string) {
  return decode(tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] ?? "") || null;
}

function htmlToText(html: string) {
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decode(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function dedupe<T>(items: T[], key: (item: T) => string) {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}
