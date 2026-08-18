import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// In-memory mock storage map
const mockStorageMap = new Map<string, string>();

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '1.0.0',
      extra: {
        androidApkManifestUrl: 'https://manifest.example.com/manifest.json',
      },
    },
  },
}));

vi.mock('../../utils/queryPersister', () => ({
  storage: {
    getString: vi.fn((key: string) => mockStorageMap.get(key)),
    set: vi.fn((key: string, value: string) => {
      mockStorageMap.set(key, value);
    }),
    delete: vi.fn((key: string) => {
      mockStorageMap.delete(key);
    }),
    remove: vi.fn((key: string) => {
      mockStorageMap.delete(key);
    }),
    clearAll: vi.fn(() => {
      mockStorageMap.clear();
    }),
  },
}));

import {
  getLatestChangelogAsync,
  getPaginatedChangelogsAsync,
  shouldShowWhatsNewAsync,
  markWhatsNewSeenAsync,
  getLastSeenVersionInfo,
  LAST_SEEN_VERSION_CODE_KEY,
  LAST_SEEN_UPDATE_ID_KEY,
} from '../changelogService';
import { BUNDLED_CHANGELOGS } from '../../data/changelogs';
import { storage } from '../../utils/queryPersister';

describe('changelogService', () => {
  beforeEach(() => {
    mockStorageMap.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getLastSeenVersionInfo & markWhatsNewSeenAsync', () => {
    it('returns nulls when storage is initially empty', () => {
      const info = getLastSeenVersionInfo();
      expect(info.versionCode).toBeNull();
      expect(info.updateId).toBeNull();
    });

    it('stores and retrieves versionCode and updateId', async () => {
      await markWhatsNewSeenAsync(35, 'ota-release-99');

      expect(storage.set).toHaveBeenCalledWith(LAST_SEEN_VERSION_CODE_KEY, '35');
      expect(storage.set).toHaveBeenCalledWith(LAST_SEEN_UPDATE_ID_KEY, 'ota-release-99');

      const info = getLastSeenVersionInfo();
      expect(info.versionCode).toBe(35);
      expect(info.updateId).toBe('ota-release-99');
    });

    it('falls back to bundled release info if parameters are omitted in markWhatsNewSeenAsync', async () => {
      await markWhatsNewSeenAsync();

      const info = getLastSeenVersionInfo();
      expect(info.versionCode).toBe(BUNDLED_CHANGELOGS[0].versionCode);
    });

    it('gracefully handles non-numeric corrupted storage content in getLastSeenVersionInfo', () => {
      mockStorageMap.set(LAST_SEEN_VERSION_CODE_KEY, 'corrupted_code');
      mockStorageMap.set(LAST_SEEN_UPDATE_ID_KEY, 'valid_update_id');

      const info = getLastSeenVersionInfo();
      expect(info.versionCode).toBeNull();
      expect(info.updateId).toBe('valid_update_id');
    });
  });

  describe('shouldShowWhatsNewAsync', () => {
    it('returns true on fresh install (nothing in storage)', async () => {
      const shouldShow = await shouldShowWhatsNewAsync(32, 'ota-init');
      expect(shouldShow).toBe(true);
    });

    it('returns true when current versionCode is higher than stored version', async () => {
      mockStorageMap.set(LAST_SEEN_VERSION_CODE_KEY, '30');

      const shouldShow = await shouldShowWhatsNewAsync(32);
      expect(shouldShow).toBe(true);
    });

    it('returns false when current versionCode is equal or lower than stored version and updateId is unchanged', async () => {
      mockStorageMap.set(LAST_SEEN_VERSION_CODE_KEY, '32');
      mockStorageMap.set(LAST_SEEN_UPDATE_ID_KEY, 'ota-v1');

      const shouldShowEqual = await shouldShowWhatsNewAsync(32, 'ota-v1');
      expect(shouldShowEqual).toBe(false);

      const shouldShowLower = await shouldShowWhatsNewAsync(30, 'ota-v1');
      expect(shouldShowLower).toBe(false);
    });

    it('returns true when an OTA updateId changes even if versionCode remains same', async () => {
      mockStorageMap.set(LAST_SEEN_VERSION_CODE_KEY, '32');
      mockStorageMap.set(LAST_SEEN_UPDATE_ID_KEY, 'ota-v1');

      const shouldShow = await shouldShowWhatsNewAsync(32, 'ota-v2');
      expect(shouldShow).toBe(true);
    });

    it('uses BUNDLED_CHANGELOGS defaults when arguments are omitted', async () => {
      mockStorageMap.set(LAST_SEEN_VERSION_CODE_KEY, String(BUNDLED_CHANGELOGS[0].versionCode));
      const shouldShow = await shouldShowWhatsNewAsync();
      expect(shouldShow).toBe(false);
    });
  });

  describe('getPaginatedChangelogsAsync', () => {
    it('returns default page 1 with 5 items', async () => {
      const result = await getPaginatedChangelogsAsync(1, 5);

      expect(result.releases.length).toBe(5);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.pageSize).toBe(5);
      expect(result.pagination.totalCount).toBe(BUNDLED_CHANGELOGS.length);
      expect(result.releases[0].version).toBe(BUNDLED_CHANGELOGS[0].version);
    });

    it('paginates correctly on page 2 with pageSize 3', async () => {
      const result = await getPaginatedChangelogsAsync(2, 3);

      expect(result.releases.length).toBe(3);
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.pageSize).toBe(3);
      expect(result.releases[0].version).toBe(BUNDLED_CHANGELOGS[3].version);
    });

    it('filters correctly by category (e.g. security)', async () => {
      const result = await getPaginatedChangelogsAsync(1, 10, 'security');

      expect(result.releases.length).toBeGreaterThan(0);
      result.releases.forEach((release) => {
        const hasSecurity = release.highlights.some((h) => h.type === 'security');
        expect(hasSecurity).toBe(true);
      });
    });

    it('returns all items when category is "all"', async () => {
      const result = await getPaginatedChangelogsAsync(1, 20, 'all');

      expect(result.pagination.totalCount).toBe(BUNDLED_CHANGELOGS.length);
    });

    it('filters by search term in title, summary, or highlights', async () => {
      const result = await getPaginatedChangelogsAsync(1, 10, 'all', 'Biometric');

      expect(result.releases.length).toBeGreaterThan(0);
      const matches = result.releases.some((r) =>
        r.title.toLowerCase().includes('biometric') ||
        r.summary.toLowerCase().includes('biometric') ||
        r.highlights.some((h) => h.title.toLowerCase().includes('biometric') || h.description?.toLowerCase().includes('biometric'))
      );
      expect(matches).toBe(true);
    });

    it('returns empty list for non-matching search term', async () => {
      const result = await getPaginatedChangelogsAsync(1, 10, 'all', 'NON_EXISTENT_SEARCH_STRING_XYZ_999');

      expect(result.releases.length).toBe(0);
      expect(result.pagination.totalCount).toBe(0);
      expect(result.pagination.currentPage).toBe(1);
    });
  });

  describe('getLatestChangelogAsync', () => {
    it('returns remote changelog when API fetch succeeds', async () => {
      const mockRemoteRelease = {
        version: '1.1.0',
        versionCode: 33,
        releaseType: 'apk',
        releaseDate: '2026-08-18T12:00:00.000Z',
        title: 'Remote Update',
        summary: 'Fetched from remote server.',
        highlights: [
          {
            type: 'feature',
            title: 'Remote Feature',
            description: 'Live push',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRemoteRelease,
      });

      const latest = await getLatestChangelogAsync();
      expect(latest.version).toBe('1.1.0');
      expect(latest.title).toBe('Remote Update');
    });

    it('handles remote payload wrapped in changelog array', async () => {
      const mockRemoteRelease = {
        version: '1.2.0',
        versionCode: 34,
        releaseType: 'ota',
        releaseDate: '2026-08-18T13:00:00.000Z',
        title: 'Array Remote Update',
        summary: 'Live changelog array.',
        highlights: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ changelog: [mockRemoteRelease] }),
      });

      const latest = await getLatestChangelogAsync();
      expect(latest.version).toBe('1.2.0');
    });

    it('falls back to BUNDLED_CHANGELOGS[0] on network rejection', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const latest = await getLatestChangelogAsync();
      expect(latest).toEqual(BUNDLED_CHANGELOGS[0]);
    });

    it('falls back to BUNDLED_CHANGELOGS[0] on non-ok HTTP response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      });

      const latest = await getLatestChangelogAsync();
      expect(latest).toEqual(BUNDLED_CHANGELOGS[0]);
    });

    it('falls back to BUNDLED_CHANGELOGS[0] on malformed JSON body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: 'data' }),
      });

      const latest = await getLatestChangelogAsync();
      expect(latest).toEqual(BUNDLED_CHANGELOGS[0]);
    });
  });
});
