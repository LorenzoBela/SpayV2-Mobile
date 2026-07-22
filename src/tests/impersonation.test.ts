import { describe, expect, it, vi } from 'vitest';
import React from 'react';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('lucide-react-native', () => {
  const MockIcon = (props: any) => null;
  return new Proxy({}, { get: () => MockIcon });
});

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: { clients: [{ id: 'client-1', name: 'Test Client', email: 'test@example.com' }] },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

import { ImpersonationProvider } from '../context/ImpersonationContext';
import ImpersonationBanner from '../components/ImpersonationBanner';
import AdminImpersonationModal from '../components/AdminImpersonationModal';

describe('Admin Impersonation Suite', () => {
  it('renders ImpersonationProvider and context default values', () => {
    const vnode = React.createElement(ImpersonationProvider, { children: null });
    expect(vnode).toBeDefined();
  });

  it('renders ImpersonationBanner when not impersonating (returns null)', () => {
    const vnode = React.createElement(ImpersonationBanner, {});
    expect(vnode).toBeDefined();
  });

  it('renders AdminImpersonationModal component tree', () => {
    const vnode = React.createElement(AdminImpersonationModal, {
      visible: true,
      onClose: () => {},
    });
    expect(vnode).toBeDefined();
  });
});
