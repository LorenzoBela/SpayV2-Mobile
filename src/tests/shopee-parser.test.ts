import { describe, it, expect } from 'vitest';
import { parseShopeeShareText } from '../utils/shopeeParser';

describe('Shopee Share Text & Link Parser (NASA JPL Rule 7 & Parser Invariants)', () => {
  it('extracts URL and title from standard Shopee share text', () => {
    const raw = 'Check out Sony WH-1000XM5 Noise Cancelling on Shopee! https://shopee.ph/Sony-WH-1000XM5-i.123456.78910';
    const res = parseShopeeShareText(raw);

    expect(res.isShopee).toBe(true);
    expect(res.url).toBe('https://shopee.ph/Sony-WH-1000XM5-i.123456.78910');
    expect(res.title).toBe('Sony WH-1000XM5 Noise Cancelling');
  });

  it('extracts short links (ph.shp.ee)', () => {
    const raw = 'Check out this item on Shopee: https://ph.shp.ee/8JzKaB9';
    const res = parseShopeeShareText(raw);

    expect(res.isShopee).toBe(true);
    expect(res.url).toBe('https://ph.shp.ee/8JzKaB9');
  });

  it('strips trailing punctuation from share URLs', () => {
    const raw = 'Look at this: https://shopee.ph/product/123/456.';
    const res = parseShopeeShareText(raw);

    expect(res.url).toBe('https://shopee.ph/product/123/456');
  });

  it('extracts slug title when only raw product URL is provided', () => {
    const raw = 'https://shopee.ph/Wireless-RGB-Mechanical-Keyboard-i.98765.43210';
    const res = parseShopeeShareText(raw);

    expect(res.isShopee).toBe(true);
    expect(res.url).toBe('https://shopee.ph/Wireless-RGB-Mechanical-Keyboard-i.98765.43210');
    expect(res.title).toBe('Wireless RGB Mechanical Keyboard');
  });

  it('safely handles empty or non-Shopee texts without throwing errors', () => {
    expect(parseShopeeShareText('')).toEqual({ url: null, title: null, isShopee: false });
    expect(parseShopeeShareText(null)).toEqual({ url: null, title: null, isShopee: false });
    expect(parseShopeeShareText('Just a random message with no links')).toEqual({ url: null, title: null, isShopee: false });
  });
});
