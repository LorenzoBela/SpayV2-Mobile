import { ChangelogCategory, ChangelogItem } from '../types/changelog';

interface TermMapping {
  pattern: RegExp;
  replacement: string;
}

const TERM_DICTIONARY: TermMapping[] = [
  { pattern: /\b(?:jwt|jwt[- ]?token)\b/gi, replacement: 'secure login credentials' },
  { pattern: /\b(?:auth[- ]?token|bearer[- ]?token|tokens?)\b/gi, replacement: 'security tokens' },
  { pattern: /\b(?:flashlist|flatlist)\b/gi, replacement: 'smooth list rendering' },
  { pattern: /\b(?:mmkv|asyncstorage|async-storage)\b/gi, replacement: 'instant local storage' },
  { pattern: /\b(?:rls|row[- ]?level[- ]?security)\b/gi, replacement: 'data access protection' },
  { pattern: /\b(?:memoiz(?:e|ation|ed|ing)|usememo|usecallback)\b/gi, replacement: 'performance caching' },
  { pattern: /\b(?:hydrat(?:e|ion|ions|ed|ing)|rehydrat(?:e|ion|ed|ing))\b/gi, replacement: 'saved state restoration' },
  { pattern: /\b(?:fcm|firebase[- ]?cloud[- ]?messaging)\b/gi, replacement: 'push notifications' },
  { pattern: /\b(?:ota|over[- ]?the[- ]?air)\b/gi, replacement: 'in-app updates' },
  { pattern: /\b(?:apk|aab)\b/gi, replacement: 'app package' },
  { pattern: /\b(?:trpc|t-rpc|rest[- ]?api|graphql|grpc)\b/gi, replacement: 'network synchronization' },
  { pattern: /\b(?:posthog|sentry)\b/gi, replacement: 'app diagnostics and telemetry' },
  { pattern: /\b(?:submodule(?:s)?|submodule[- ]?pointer(?:s)?)\b/gi, replacement: 'core system modules' },
  { pattern: /\b(?:cmake|ndk|gradle)\b/gi, replacement: 'native build foundation' },
  { pattern: /\b(?:hermes)\b/gi, replacement: 'high-speed JavaScript engine' },
  { pattern: /\b(?:zustand|redux|context[- ]?api)\b/gi, replacement: 'app state system' },
  { pattern: /\b(?:biometrics?|biometric[- ]?auth)\b/gi, replacement: 'biometric face/fingerprint security' },
  { pattern: /\b(?:idempotenc(?:y|e)|idempotent)\b/gi, replacement: 'duplicate request protection' },
  { pattern: /\b(?:haptics?|haptic[- ]?feedback)\b/gi, replacement: 'tactile haptic feedback' },
  { pattern: /\b(?:privacy[- ]?curtain)\b/gi, replacement: 'app switcher privacy curtain' },
  { pattern: /\b(?:prefetch(?:ing)?|pre-fetch)\b/gi, replacement: 'background pre-loading' },
  { pattern: /\b(?:virtualiz(?:e|ation|ed|ing))\b/gi, replacement: 'fast scrolling virtualization' },
];

const CATEGORY_MAP: Record<string, ChangelogCategory> = {
  feat: 'feature',
  feature: 'feature',
  add: 'feature',
  new: 'feature',
  fix: 'fix',
  bug: 'fix',
  hotfix: 'fix',
  patch: 'fix',
  perf: 'improvement',
  refactor: 'improvement',
  improvement: 'improvement',
  improve: 'improvement',
  optimize: 'improvement',
  style: 'improvement',
  docs: 'improvement',
  chore: 'improvement',
  build: 'improvement',
  ci: 'improvement',
  sec: 'security',
  security: 'security',
  auth: 'security',
  lock: 'security',
};

const HASH_REGEX = /^[0-9a-fA-F]{7,40}\s+/;
const TICKET_REGEX = /(?:\[?[A-Z]{2,10}-[0-9]+\]?|#[0-9]+|\([A-Z]{2,10}-[0-9]+\))/gi;
const EXTENSION_REGEX = /\b[\w-]+\.(?:tsx?|jsx?|json|kt|java|gradle|ps1|png|jpe?g|svg|xml|md|lock|ya?ml)\b/gi;
const CONVENTIONAL_REGEX = /^([a-zA-Z]+)(?:\(([^)]+)\))?!?:\s*(.+)$/;

function sanitizeCommitText(text: string): string {
  return text
    .replace(HASH_REGEX, '')
    .replace(TICKET_REGEX, '')
    .replace(EXTENSION_REGEX, (match) => {
      const parts = match.split('.');
      return parts[0] || '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function applyTermReplacements(text: string): string {
  let result = text;
  for (const { pattern, replacement } of TERM_DICTIONARY) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function toSentenceCase(str: string): string {
  if (!str) return '';
  const cleaned = str.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function translateCommitToPlainLanguage(rawCommit: string): ChangelogItem {
  const trimmed = rawCommit.trim();
  const withoutHash = trimmed.replace(HASH_REGEX, '');
  const conventionalMatch = withoutHash.match(CONVENTIONAL_REGEX);

  let rawType = 'improvement';
  let scope = '';
  let subject = withoutHash;

  if (conventionalMatch) {
    rawType = conventionalMatch[1].toLowerCase();
    scope = (conventionalMatch[2] || '').trim();
    subject = conventionalMatch[3].trim();
  } else {
    const lower = withoutHash.toLowerCase();
    if (lower.startsWith('fix') || lower.includes('bug')) {
      rawType = 'fix';
    } else if (lower.startsWith('feat') || lower.startsWith('add')) {
      rawType = 'feature';
    } else if (lower.includes('security') || lower.includes('auth') || lower.includes('biometric')) {
      rawType = 'security';
    } else {
      rawType = 'improvement';
    }
  }

  const category: ChangelogCategory = CATEGORY_MAP[rawType] || 'improvement';

  let sanitizedSubject = sanitizeCommitText(subject);
  let translatedSubject = applyTermReplacements(sanitizedSubject);

  if (scope) {
    const cleanedScope = sanitizeCommitText(scope);
    if (cleanedScope && !translatedSubject.toLowerCase().includes(cleanedScope.toLowerCase())) {
      translatedSubject = `${toSentenceCase(cleanedScope)}: ${translatedSubject}`;
    }
  }

  const finalTitle = toSentenceCase(translatedSubject) || 'General performance and stability updates';

  return {
    type: category,
    title: finalTitle,
    rawCommit: trimmed,
  };
}

export function translateCommitList(commits: string[]): ChangelogItem[] {
  if (!Array.isArray(commits)) return [];
  return commits
    .filter((c) => typeof c === 'string' && c.trim().length > 0)
    .map(translateCommitToPlainLanguage);
}
