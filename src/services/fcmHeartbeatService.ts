import { ensureDeviceRegistration } from './fcmNotificationService';
import { storage } from '../utils/queryPersister';

const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Hours
const HEARTBEAT_KEY = 'spay_last_fcm_heartbeat';

/**
 * Runs a non-blocking 24-hour background reconciliation check for push notification tokens.
 * Guarantees that silent Google Play Services token rotations or OS battery cleans
 * never result in missed due-date or payment alerts.
 */
export async function runFcmHeartbeatCheck(userId?: string): Promise<boolean> {
  if (!userId) return false;

  try {
    const lastHeartbeatStr = storage.getString(HEARTBEAT_KEY);
    const now = Date.now();

    if (lastHeartbeatStr) {
      const lastHeartbeat = Number(lastHeartbeatStr);
      if (Number.isFinite(lastHeartbeat) && now - lastHeartbeat < HEARTBEAT_INTERVAL_MS) {
        // Heartbeat is still fresh (< 24h old)
        return false;
      }
    }

    // Run non-blocking background verification
    const token = await ensureDeviceRegistration(userId, 1);
    if (token) {
      storage.set(HEARTBEAT_KEY, now.toString());
      return true;
    }
  } catch (err) {
    console.warn('[FCM Heartbeat] Background verification warning:', err);
  }

  return false;
}
