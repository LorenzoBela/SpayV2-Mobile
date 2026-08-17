import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import * as Updates from 'expo-updates';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react-native';
import { posthog } from '../utils/posthog';
import { queryClient } from '../utils/queryClient';
import { storage } from '../utils/queryPersister';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

function sanitizeErrorMessage(msg: string): string {
  // Strip potential tokens, secrets, or JWT patterns from telemetry payloads
  return msg
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '[REDACTED_JWT]')
    .replace(/[a-zA-Z0-9_-]{20,}:APA91[a-zA-Z0-9_-]+/g, '[REDACTED_FCM_TOKEN]');
}

export default class RootErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    try {
      const sanitized = sanitizeErrorMessage(error?.message || 'Unknown render error');
      posthog.capture('app_crash', {
        error_name: error?.name || 'Error',
        error_message: sanitized,
        stack: error?.stack ? error.stack.slice(0, 1000) : '',
        component_stack: errorInfo?.componentStack ? errorInfo.componentStack.slice(0, 1000) : '',
      });
    } catch {
      // Non-blocking telemetry
    }
  }

  private handleReload = async (): Promise<void> => {
    try {
      if (Updates.isEnabled) {
        await Updates.reloadAsync();
      } else {
        this.setState({ hasError: false, error: null, errorInfo: null });
      }
    } catch {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  private handleClearCacheAndReload = async (): Promise<void> => {
    try {
      // Clear TanStack query cache and persisted queries without wiping auth tokens
      queryClient.clear();
      try {
        const allKeys = storage.getAllKeys();
        for (const key of allKeys) {
          if (key.startsWith('REACT_QUERY') || key.startsWith('spay_cached_')) {
            storage.delete(key);
          }
        }
      } catch {}

      if (Updates.isEnabled) {
        await Updates.reloadAsync();
      } else {
        this.setState({ hasError: false, error: null, errorInfo: null });
      }
    } catch {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  public override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.';

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          <View style={styles.card}>
            
            {/* Warning Icon Badge */}
            <View style={styles.iconContainer}>
              <AlertTriangle size={32} color="#f59e0b" strokeWidth={2.2} />
            </View>

            {/* Header Titles */}
            <Text style={styles.title}>Workspace Recovery</Text>
            <Text style={styles.subtitle}>
              S-Pay encountered an unexpected interface issue. Your local account data and settings remain safe.
            </Text>

            {/* Diagnostic Box */}
            <View style={styles.diagnosticBox}>
              <Text style={styles.diagnosticLabel}>DIAGNOSTIC LOG</Text>
              <Text style={styles.diagnosticText} numberOfLines={4}>
                {sanitizeErrorMessage(errorMessage)}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionColumn}>
              <TouchableOpacity
                onPress={this.handleReload}
                style={styles.primaryButton}
                activeOpacity={0.8}
              >
                <RefreshCw size={16} color="#ffffff" strokeWidth={2.2} />
                <Text style={styles.primaryButtonText}>Reload Workspace</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={this.handleClearCacheAndReload}
                style={styles.secondaryButton}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color="#94a3b8" strokeWidth={2} />
                <Text style={styles.secondaryButtonText}>Clear Cache & Restart</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#090d16',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 22,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    color: '#f8fafc',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 6,
  },
  diagnosticBox: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    gap: 4,
    marginVertical: 6,
  },
  diagnosticLabel: {
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  diagnosticText: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    color: '#cbd5e1',
    lineHeight: 16,
  },
  actionColumn: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ee4d2d',
    borderRadius: 14,
    height: 46,
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
    color: '#ffffff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    height: 46,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'Jakarta-Medium',
    color: '#94a3b8',
  },
});
