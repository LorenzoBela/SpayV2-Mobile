/**
 * Shopee Link & Share Text Parser Utility
 * Extracts product URLs and titles from Shopee share payloads & clipboard strings.
 */

export interface ParsedShopeePayload {
  url: string | null;
  title: string | null;
  isShopee: boolean;
}

export function parseShopeeShareText(rawText?: string | null): ParsedShopeePayload {
  if (!rawText || typeof rawText !== 'string') {
    return { url: null, title: null, isShopee: false };
  }

  const text = rawText.trim();

  // Regex to detect Shopee domains (full, short, international)
  const urlRegex = /(https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:shopee\.[a-z.]+|shp\.ee)\/[^\s]+)/i;
  const match = text.match(urlRegex);

  if (!match) {
    // Fallback: check if text itself looks like a standard URL
    const generalUrlRegex = /(https?:\/\/[^\s]+)/i;
    const generalMatch = text.match(generalUrlRegex);
    if (generalMatch) {
      const url = generalMatch[0];
      const isShopeeDomain = /shopee|shp\.ee/i.test(url);
      return {
        url,
        title: extractTitleFromText(text, url),
        isShopee: isShopeeDomain,
      };
    }
    return { url: null, title: null, isShopee: false };
  }

  let extractedUrl = match[1];

  // Clean trailing punctuation attached by share messages (e.g. trailing period or paren)
  extractedUrl = extractedUrl.replace(/[.,;!?)]+$/, '');

  // Extract clean title from surrounding share text (e.g. "Check out [Title] on Shopee: https://...")
  const title = extractTitleFromText(text, extractedUrl);

  return {
    url: extractedUrl,
    title,
    isShopee: true,
  };
}

function extractTitleFromText(fullText: string, foundUrl: string): string | null {
  // Remove the URL from full text
  let remaining = fullText.replace(foundUrl, '').trim();

  // Remove common Shopee share prefixes/suffixes
  remaining = remaining
    .replace(/^check out\s+/i, '')
    .replace(/^tignan ang\s+/i, '')
    .replace(/^tingnan ang\s+/i, '')
    .replace(/\s+on shopee!?$/i, '')
    .replace(/\s+sa shopee!?$/i, '')
    .replace(/^[\s!.,:;-]+|[\s!.,:;-]+$/g, '')
    .trim();

  // If text was just the URL or very short generic prefix, return null
  if (!remaining || remaining.length < 3 || /^(shopee|item|product)$/i.test(remaining)) {
    // Try to extract title slug from URL if it's a standard Shopee web URL
    // e.g. https://shopee.ph/Sony-WH-1000XM5-Wireless-Headphones-i.123456.78910
    const slugMatch = foundUrl.match(/shopee\.[a-z.]+\/([^/?]+)-i\.\d+\.\d+/i);
    if (slugMatch && slugMatch[1]) {
      const slugTitle = decodeURIComponent(slugMatch[1]).replace(/-/g, ' ').trim();
      if (slugTitle.length > 3) return slugTitle;
    }
    return null;
  }

  return remaining;
}
