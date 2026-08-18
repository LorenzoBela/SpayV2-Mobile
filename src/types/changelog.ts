export type ChangelogCategory = 'feature' | 'improvement' | 'fix' | 'security';

export interface ChangelogItem {
  type: ChangelogCategory;
  title: string;
  description?: string;
  rawCommit?: string;
}

export interface ReleaseChangelog {
  version: string;
  versionCode: number;
  updateId?: string;
  releaseType: 'apk' | 'ota' | 'hybrid';
  releaseDate: string;
  title: string;
  summary: string;
  highlights: ChangelogItem[];
  isCritical?: boolean;
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
}

export function formatReleaseTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (isNaN(diffMs)) {
    return isoDate;
  }

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

export function paginateChangelogs(
  items: ReleaseChangelog[],
  page: number,
  pageSize: number = 5
): { items: ReleaseChangelog[]; pagination: PaginationState } {
  const validPageSize = Math.max(1, pageSize);
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / validPageSize));
  const validPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (validPage - 1) * validPageSize;
  const paginatedItems = items.slice(startIndex, startIndex + validPageSize);

  return {
    items: paginatedItems,
    pagination: {
      currentPage: validPage,
      totalPages,
      pageSize: validPageSize,
      totalCount,
    },
  };
}
