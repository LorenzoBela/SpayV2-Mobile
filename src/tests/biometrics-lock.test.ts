import { describe, it, expect, vi } from 'vitest';

describe('Biometric Lock AppState Guard Logic', () => {
  it('suppresses AppState re-locking when native biometric prompt transitions AppState', () => {
    let isPrompting = false;
    let ignoreNextActive = false;
    let isLocked = true;
    let authenticateCalls = 0;

    const triggerBiometrics = () => {
      if (isPrompting) return;
      isPrompting = true;
      authenticateCalls++;

      // Simulate native prompt closing & success
      isLocked = false;
      setTimeout(() => {
        isPrompting = false;
      }, 500);
    };

    const handleAppStateChange = (nextAppState: 'active' | 'inactive' | 'background') => {
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        if (isPrompting) {
          ignoreNextActive = true;
        }
      } else if (nextAppState === 'active') {
        if (ignoreNextActive || isPrompting) {
          ignoreNextActive = false;
          return; // Ignore re-lock!
        }
        isLocked = true;
        triggerBiometrics();
      }
    };

    // 1. Initial trigger
    triggerBiometrics();
    expect(authenticateCalls).toBe(1);
    expect(isLocked).toBe(false);

    // 2. Native biometric prompt causes AppState transition to inactive
    handleAppStateChange('inactive');
    expect(ignoreNextActive).toBe(true);

    // 3. Native prompt dismisses, returning AppState to active
    handleAppStateChange('active');
    expect(ignoreNextActive).toBe(false);
    expect(authenticateCalls).toBe(1); // Crucial: did NOT trigger prompt again!
    expect(isLocked).toBe(false); // Stays unlocked!
  });

  it('triggers lock when app is legitimately backgrounded by user', () => {
    let isPrompting = false;
    let ignoreNextActive = false;
    let isLocked = false;
    let authenticateCalls = 0;

    const triggerBiometrics = () => {
      if (isPrompting) return;
      isPrompting = true;
      authenticateCalls++;
      setTimeout(() => {
        isPrompting = false;
      }, 500);
    };

    const handleAppStateChange = (nextAppState: 'active' | 'inactive' | 'background') => {
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        if (isPrompting) {
          ignoreNextActive = true;
        }
      } else if (nextAppState === 'active') {
        if (ignoreNextActive || isPrompting) {
          ignoreNextActive = false;
          return;
        }
        isLocked = true;
        triggerBiometrics();
      }
    };

    // App is currently unlocked and idle (isPrompting = false)
    // User minimizes app to background
    handleAppStateChange('background');
    expect(ignoreNextActive).toBe(false);

    // User re-opens app
    handleAppStateChange('active');
    expect(isLocked).toBe(true);
    expect(authenticateCalls).toBe(1); // Properly locks and triggers authentication
  });
});
