import { MainTabParamList } from './navigationTypes';

export type ClientVisibleTabName = Extract<
  keyof MainTabParamList,
  'Dashboard' | 'Orders' | 'Payments' | 'Notifications' | 'More'
>;

export const CLIENT_TAB_SEQUENCE: readonly ClientVisibleTabName[] = [
  'Dashboard',
  'Orders',
  'Payments',
  'Notifications',
  'More',
];

export function getAdjacentClientTab(
  routeName: ClientVisibleTabName,
  direction: 'previous' | 'next',
): ClientVisibleTabName | null {
  const currentIndex = CLIENT_TAB_SEQUENCE.indexOf(routeName);
  if (currentIndex === -1) return null;

  const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
  return CLIENT_TAB_SEQUENCE[nextIndex] ?? null;
}
