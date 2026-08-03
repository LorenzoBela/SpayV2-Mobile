import { describe, it, expect, vi } from 'vitest';
import * as Haptics from 'expo-haptics';
import {
  selection,
  success,
  warning,
  error,
  impactLight,
  impactHeavy,
  hapticsHelper,
} from '../utils/hapticsHelper';

vi.mock('expo-haptics', () => ({
  selectionAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  impactAsync: vi.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Rigid: 'rigid',
    Soft: 'soft',
  },
}));

describe('hapticsHelper', () => {
  it('triggers selection haptic', async () => {
    await selection();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('triggers notification haptics (success, warning, error)', async () => {
    await success();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');

    await warning();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');

    await error();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
  });

  it('triggers impact haptics (light, heavy)', async () => {
    await impactLight();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');

    await impactHeavy();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('heavy');
  });

  it('exports object wrapper correctly', () => {
    expect(hapticsHelper.selection).toBe(selection);
    expect(hapticsHelper.success).toBe(success);
    expect(hapticsHelper.impactHeavy).toBe(impactHeavy);
  });
});
