import React from 'react';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  RoleSelect: undefined;
  Admin: undefined;
  Reports: undefined;
  Budget: undefined;
  Calendar: undefined;
  Settings: undefined;
  Wishlist: undefined;
  RequestBuy: undefined;
  MyRequests: undefined;
  AdminRequests: undefined;
  AdminSalary: undefined;
  AdminExpenses: undefined;
  AdminIpon: undefined;
  AdminSystemHealth: undefined;
  Changelog: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Orders: undefined;
  Payments: undefined;
  Notifications: undefined;
  More: undefined;
  Budget: undefined;
  Reports: undefined;
  Settings: undefined;
  Calendar: undefined;
  NootAi: undefined;
  ClientMilestones: undefined;
  Wishlist: undefined;
  RequestBuy: undefined;
  MyRequests: undefined;
};

export type AdminTabParamList = {
  AdminDashboard: undefined;
  AdminClients: undefined;
  AdminOrders: undefined;
  AdminPayments: undefined;
  AdminMore: undefined;
  AdminReminders: undefined;
  AdminReports: undefined;
  AdminSettings: undefined;
  AdminNotifications: undefined;
  AdminMilestones: undefined;
  AdminRequests: undefined;
  AdminSalary: undefined;
  AdminExpenses: undefined;
  AdminIpon: undefined;
  AdminSystemHealth: undefined;
  NootAi: undefined;
};

export const RoleContext = React.createContext<{
  userRole: string | null;
  activeRole: 'admin' | 'client' | null;
  setActiveRole: (role: 'admin' | 'client' | null) => void;
}>({
  userRole: null,
  activeRole: null,
  setActiveRole: () => {},
});

export const ThemeContext = React.createContext<{
  isDarkMode: boolean;
  themePreference: 'dark' | 'light' | 'auto';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light' | 'auto') => void;
}>({
  isDarkMode: true,
  themePreference: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});
