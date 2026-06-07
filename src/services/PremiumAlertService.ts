import { DeviceEventEmitter, AlertButton, AlertOptions } from 'react-native';

export interface PremiumAlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
  icon?: string;
  iconColor?: string;
  isDownloading?: boolean;
  progress?: number; // 0 to 1
}

/**
 * A drop-in replacement service for React Native's `Alert.alert`.
 * Emits an event that the `<GlobalPremiumAlert />` component listens to.
 */
class PremiumAlertServiceClass {
  public readonly SHOW_EVENT = 'SHOW_PREMIUM_ALERT';

  /**
   * Mirrors the exact API of `Alert.alert(title, message?, buttons?, options?)`
   */
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions,
    icon?: string,
    iconColor?: string
  ) {
    DeviceEventEmitter.emit(this.SHOW_EVENT, {
      title,
      message,
      buttons,
      options,
      icon,
      iconColor,
    } as PremiumAlertOptions);
  }

  /**
   * Triggers a rich, dynamic alert with extended options (such as download progress)
   */
  show(options: PremiumAlertOptions) {
    DeviceEventEmitter.emit(this.SHOW_EVENT, options);
  }

  /**
   * Programmatically closes the active alert modal
   */
  dismiss() {
    DeviceEventEmitter.emit(this.SHOW_EVENT, null);
  }
}

export const PremiumAlert = new PremiumAlertServiceClass();
