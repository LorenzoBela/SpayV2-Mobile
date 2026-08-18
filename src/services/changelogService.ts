import Constants from 'expo-constants';
import { storage } from '../utils/queryPersister';
import { BUNDLED_CHANGELOGS } from '../data/changelogs';
import {
  ReleaseChangelog,
  paginateChangelogs,
  ChangelogCategory,
  PaginationState,
} from '../types/changelog';

export const LAST_SEEN_VERSION_CODE_KEY = 'spay_last_seen_version_code';
export const LAST_SEEN_UPDATE_ID_KEY = 'spay_last_seen_update_id';

const getApiUrl = (): string => {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  return 'https://nootspaytracker.vercel.app';
};

const parseChangelogPayload = (data: unknown): ReleaseChangelog | null => {
  if (!data || typeof data !== 'object') return null;

  const candidate = Array.isArray(data)
    ? data[0]
    : 'changelog' in data && (data as { changelog: unknown }).changelog
      ? Array.isArray((data as { changelog: unknown }).changelog)
        ? (data as { changelog: unknown[] }).changelog[0]
        : (data as { changelog: unknown }).changelog
      : data;

  if (
    candidate &&
    typeof candidate === 'object' &&
    typeof (candidate as Record<string, unknown>).version === 'string' &&
    typeof (candidate as Record<string, unknown>).title === 'string'
  ) {
    return candidate as ReleaseChangelog;
  }

  return null;
};

/**
 * Fetches the latest changelog from remote API or APK manifest with a 2500ms timeout.
 * Falls back to BUNDLED_CHANGELOGS[0] on network failure, timeout, or invalid payload.
 */
export async function getLatestChangelogAsync(): Promise<ReleaseChangelog> {
  const fallback = BUNDLED_CHANGELOGS[0];

  const fetchWithTimeout = async (url: string, timeoutMs: number = 2500): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  const apiUrl = getApiUrl();
  const manifestUrl = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
    ?.androidApkManifestUrl as string | undefined;

  const endpointsToTry: string[] = [];
  if (apiUrl) {
    endpointsToTry.push(`${apiUrl}/api/app-updates/changelog`);
  }
  if (manifestUrl && manifestUrl.trim() && !endpointsToTry.includes(manifestUrl.trim())) {
    endpointsToTry.push(manifestUrl.trim());
  }

  for (const endpoint of endpointsToTry) {
    try {
      const response = await fetchWithTimeout(endpoint, 2500);
      if (response.ok) {
        const json = await response.json();
        const changelog = parseChangelogPayload(json);
        if (changelog) {
          return changelog;
        }
      }
    } catch {
      // Continue to next endpoint or fallback
    }
  }

  return fallback;
}

/**
 * Returns paginated releases filtered by optional category and search string.
 */
export async function getPaginatedChangelogsAsync(
  page: number = 1,
  pageSize: number = 5,
  category: ChangelogCategory | 'all' = 'all',
  search?: string
): Promise<{ releases: ReleaseChangelog[]; pagination: PaginationState }> {
  let filtered = [...BUNDLED_CHANGELOGS];

  // Filter by category
  if (category && category !== 'all') {
    const targetCategory = category.toLowerCase();
    filtered = filtered.filter((release) =>
      release.highlights?.some((item) => item.type?.toLowerCase() === targetCategory)
    );
  }

  // Filter by search term
  if (search && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((release) => {
      const matchVersion = release.version?.toLowerCase().includes(q);
      const matchTitle = release.title?.toLowerCase().includes(q);
      const matchSummary = release.summary?.toLowerCase().includes(q);
      const matchHighlights = release.highlights?.some(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.rawCommit?.toLowerCase().includes(q)
      );
      return Boolean(matchVersion || matchTitle || matchSummary || matchHighlights);
    });
  }

  const paginatedResult = paginateChangelogs(filtered, page, pageSize);

  return {
    releases: paginatedResult.items,
    pagination: paginatedResult.pagination,
  };
}

/**
 * Synchronously retrieves stored last seen version info.
 */
export function getLastSeenVersionInfo(): { versionCode: number | null; updateId: string | null } {
  try {
    const rawVersion = storage?.getString ? storage.getString(LAST_SEEN_VERSION_CODE_KEY) : null;
    const rawUpdateId = storage?.getString ? storage.getString(LAST_SEEN_UPDATE_ID_KEY) : null;
    const parsedVersion =
      rawVersion !== undefined && rawVersion !== null && rawVersion.trim() !== ''
        ? Number(rawVersion.trim())
        : null;

    return {
      versionCode: parsedVersion !== null && Number.isFinite(parsedVersion) ? parsedVersion : null,
      updateId: rawUpdateId ? rawUpdateId.trim() : null,
    };
  } catch (err) {
    console.warn('[changelogService] Error reading last seen version info:', err);
    return { versionCode: null, updateId: null };
  }
}

/**
 * Determines if the "What's New" modal should be presented to the user based on
 * native versionCode increase or new OTA updateId.
 */
export async function shouldShowWhatsNewAsync(
  currentVersionCode?: number,
  currentUpdateId?: string
): Promise<boolean> {
  try {
    const { versionCode: lastSeenVersion, updateId: lastSeenUpdate } = getLastSeenVersionInfo();
    const effectiveVersionCode = currentVersionCode ?? BUNDLED_CHANGELOGS[0]?.versionCode;
    const effectiveUpdateId = currentUpdateId ?? BUNDLED_CHANGELOGS[0]?.updateId;

    // First launch or never seen before
    if (lastSeenVersion === null && lastSeenUpdate === null) {
      return true;
    }

    // Native versionCode gate (new APK installed)
    if (effectiveVersionCode !== undefined && effectiveVersionCode !== null) {
      if (lastSeenVersion === null || effectiveVersionCode > lastSeenVersion) {
        return true;
      }
    }

    // OTA updateId gate (new OTA bundle downloaded)
    if (effectiveUpdateId && effectiveUpdateId.trim() !== '') {
      if (!lastSeenUpdate || lastSeenUpdate !== effectiveUpdateId.trim()) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.warn('[changelogService] Error checking shouldShowWhatsNewAsync:', err);
    return false;
  }
}

/**
 * Marks the specified versionCode and updateId as seen in persistent storage.
 */
export async function markWhatsNewSeenAsync(
  versionCode?: number,
  updateId?: string
): Promise<void> {
  try {
    const resolvedVersionCode = versionCode ?? BUNDLED_CHANGELOGS[0]?.versionCode ?? 0;
    const resolvedUpdateId = updateId ?? BUNDLED_CHANGELOGS[0]?.updateId ?? '';

    if (storage?.set) {
      storage.set(LAST_SEEN_VERSION_CODE_KEY, String(resolvedVersionCode));
      if (resolvedUpdateId) {
        storage.set(LAST_SEEN_UPDATE_ID_KEY, resolvedUpdateId);
      }
    }
  } catch (err) {
    console.warn('[changelogService] Error storing last seen version info:', err);
  }
}
