import React from 'react';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  RoleSelect: undefined;
  Admin: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Payments: undefined;
  Budget: undefined;
  Notifications: undefined;
  Profile: undefined;
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
  toggleTheme: () => void;
}>({
  isDarkMode: true,
  toggleTheme: () => {},
});
