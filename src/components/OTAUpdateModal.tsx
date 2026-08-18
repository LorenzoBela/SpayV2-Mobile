import React from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  View,
  Modal,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Download } from 'lucide-react-native';
import { translateCommitToPlainLanguage } from '../utils/changelogTranslator';
import { BUNDLED_CHANGELOGS } from '../data/changelogs';

interface OTAUpdateModalProps {
  visible: boolean;
  onRestart?: () => void;
  onApply?: () => void;
  onDismiss?: () => void;
  runtimeVersion?: string | null;
  type?: 'ota' | 'apk';
  summary?: string | null;
  rawCommit?: string | null;
}

export default function OTAUpdateModal({
  visible,
  onRestart,
  onApply,
  onDismiss,
  runtimeVersion,
  type = 'ota',
  summary,
  rawCommit,
}: OTAUpdateModalProps) {
  const handleAction = onRestart || onApply || (() => {});
  const isApk = type === 'apk';

  const modalDescription = React.useMemo(() => {
    if (summary && summary.trim().length > 0) {
      return summary.trim();
    }
    if (rawCommit && rawCommit.trim().length > 0) {
      const translated = translateCommitToPlainLanguage(rawCommit);
      return translated.title;
    }
    const latest = BUNDLED_CHANGELOGS[0];
    if (latest?.summary) {
      return latest.summary;
    }
    return isApk
      ? 'A new build is available. Update to get the latest features and improvements.'
      : 'A newer version has been downloaded. Restart S-Pay now to apply the latest features.';
  }, [summary, rawCommit, isApk]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss || (() => {})}
    >
      <SafeAreaProvider>
        <Pressable
          style={[styles.backdrop, { backgroundColor: 'rgba(11, 15, 25, 0.7)' }]}
          onPress={onDismiss}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <SafeAreaView edges={['bottom']} style={styles.safeAreaSheet}>
              <View style={styles.dragIndicator} />
              <View style={styles.iconFrame}>
                <Download size={30} color="#ee4d2d" />
              </View>
              <Text style={styles.title}>
                {isApk ? 'App Update Available' : 'Update Ready'}
              </Text>
              <Text style={styles.description}>
                {modalDescription}
              </Text>
              {runtimeVersion ? (
                <View style={styles.versionPill}>
                  <Text style={styles.versionText}>v{runtimeVersion}</Text>
                </View>
              ) : null}
              <View style={styles.buttonContainer}>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                  onPress={handleAction}
                  accessibilityRole="button"
                  accessibilityLabel={isApk ? 'Update App' : 'Restart and apply update'}
                >
                  <Text style={styles.buttonText} numberOfLines={1} adjustsFontSizeToFit>
                    {isApk ? 'Download & Install' : 'Restart Now'}
                  </Text>
                </Pressable>
                {onDismiss ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.laterButton,
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                    onPress={onDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Postpone update"
                  >
                    <Text style={styles.laterButtonText}>Later</Text>
                  </Pressable>
                ) : null}
              </View>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#161c2a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#222d42',
    width: '100%',
  },
  safeAreaSheet: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    alignItems: 'center',
  },
  dragIndicator: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#475569',
    marginBottom: 18,
  },
  iconFrame: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(238, 77, 45, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    color: '#94a3b8',
    fontSize: 15,
    fontFamily: 'Jakarta-Medium',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18,
  },
  versionPill: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 22,
  },
  versionText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  button: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    backgroundColor: '#ee4d2d',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  laterButton: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  laterButtonText: {
    color: '#94a3b8',
    fontSize: 15,
    fontFamily: 'Outfit-SemiBold',
  },
});
