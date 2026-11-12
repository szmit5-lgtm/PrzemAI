'use strict';

// Public Bing RSS results, read-only. No login, crawling or outbound messaging.
const { publicUrl } = require('./publicLeadDiscovery');
function decodeXml(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function field(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return m ? decodeXml(m[1]).replace(/<[^>]*>/g, '').trim() : '';
}
async function searchPublicCompanies(query, { limit = 20 } = {}) {
  if (typeof query !== 'string' || !query.trim() || query.length > 200) throw new TypeError('invalid_query');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError('invalid_limit');
  const url = new URL('https://www.bing.com/search');
  url.searchParams.set('q', query.trim());
  url.searchParams.set('format', 'rss');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/rss+xml, application/xml' } });
    if (!response.ok) throw new Error('public_search_http_' + response.status);
    const xml = await response.text();
    if (xml.length > 500000 || !/<rss\b/i.test(xml)) throw new Error('public_search_invalid_feed');
    const results = [];
    for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
      const item = match[1];
      const candidate = publicUrl(field(item, 'link'));
      if (!candidate) continue;
      results.push({ url: candidate, title: field(item, 'title'), snippet: field(item, 'description') });
      if (results.length >= limit) break;
    }
    return results;
  } finally {
    clearTimeout(timeout);
  }
}
module.exports = { searchPublicCompanies };
