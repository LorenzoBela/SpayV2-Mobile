import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  shouldShowWhatsNewAsync,
  getLatestChangelogAsync,
  markWhatsNewSeenAsync,
} from '../services/changelogService';
import { translateCommitToPlainLanguage, translateCommitList } from '../utils/changelogTranslator';
import { storage } from '../utils/queryPersister';
import { BUNDLED_CHANGELOGS } from '../data/changelogs';

vi.mock('../utils/queryPersister', () => {
  const store = new Map<string, string>();
  return {
    storage: {
      getString: vi.fn((key: string) => store.get(key) || null),
      set: vi.fn((key: string, val: string) => store.set(key, val)),
      delete: vi.fn((key: string) => store.delete(key)),
      clearAll: vi.fn(() => store.clear()),
    },
  };
});

describe('Changelog Mobile Integration Suite', () => {
  beforeEach(() => {
    (storage.clearAll as any)();
    vi.clearAllMocks();
  });

  describe('Commit Translation to Plain Language', () => {
    it('translates feature conventional commit to plain wording', () => {
      const result = translateCommitToPlainLanguage(
        'a1b2c3d feat(auth): add biometric face/fingerprint authentication and jwt tokens'
      );
      expect(result.type).toBe('feature');
      expect(result.title.toLowerCase()).toContain('biometric');
      expect(result.title.toLowerCase()).not.toContain('jwt');
      expect(result.title.toLowerCase()).toContain('secure login credentials');
    });

    it('translates bug fix commit to plain wording', () => {
      const result = translateCommitToPlainLanguage(
        '45555e7 fix: resolve notification channel crash on background push'
      );
      expect(result.type).toBe('fix');
      expect(result.title.toLowerCase()).toContain('resolve notification channel crash');
    });

    it('handles list of commit strings safely', () => {
      const items = translateCommitList([
        '26f4101 feat: implement app update service',
        'c5f0bbc chore: patch CMake build paths for native engine',
      ]);
      expect(items.length).toBe(2);
      expect(items[0].type).toBe('feature');
      expect(items[1].type).toBe('improvement');
    });
  });

  describe('WhatsNew Trigger and Persistence Logic', () => {
    it('shows WhatsNew modal on initial clean launch', async () => {
      const show = await shouldShowWhatsNewAsync();
      expect(show).toBe(true);
    });

    it('suppresses WhatsNew modal once marked seen', async () => {
      const latest = BUNDLED_CHANGELOGS[0];
      await markWhatsNewSeenAsync(latest.versionCode, latest.updateId);

      const show = await shouldShowWhatsNewAsync(latest.versionCode, latest.updateId);
      expect(show).toBe(false);
    });

    it('re-triggers WhatsNew modal when native versionCode increases', async () => {
      await markWhatsNewSeenAsync(30, 'update-old');

      const show = await shouldShowWhatsNewAsync(32, 'update-old');
      expect(show).toBe(true);
    });

    it('re-triggers WhatsNew modal when OTA updateId changes', async () => {
      await markWhatsNewSeenAsync(32, 'ota-bundle-1');

      const show = await shouldShowWhatsNewAsync(32, 'ota-bundle-2');
      expect(show).toBe(true);
    });

    it('retrieves latest changelog fallback', async () => {
      const release = await getLatestChangelogAsync();
      expect(release).toBeDefined();
      expect(release.version).toBe(BUNDLED_CHANGELOGS[0].version);
      expect(release.highlights.length).toBeGreaterThan(0);
    });
  });
});
