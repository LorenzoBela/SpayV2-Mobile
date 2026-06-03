import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download } from 'lucide-react-native';

interface OTAUpdateModalProps {
  visible: boolean;
  onRestart: () => void;
  runtimeVersion?: string | null;
}

export default function OTAUpdateModal({
  visible,
  onRestart,
  runtimeVersion,
}: OTAUpdateModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Portal>
      <Modal
        visible={visible}
        dismissable={false}
        onDismiss={() => {}}
        style={styles.overlay}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom + 20, 24) },
        ]}
      >
        <View style={styles.dragIndicator} />
        <View style={styles.iconFrame}>
          <Download size={30} color="#ee4d2d" />
        </View>
        <Text style={styles.title}>Update Ready</Text>
        <Text style={styles.description}>
          A newer version has been downloaded. The app will now close so you can reopen on the latest version.
        </Text>
        {runtimeVersion ? (
          <View style={styles.versionPill}>
            <Text style={styles.versionText}>v{runtimeVersion}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.button}
          onPress={onRestart}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Close app and apply update"
        >
          <Text style={styles.buttonText} numberOfLines={1} adjustsFontSizeToFit>
            Close and Reopen
          </Text>
        </TouchableOpacity>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  container: {
    backgroundColor: '#161c2a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#222d42',
    paddingHorizontal: 24,
    paddingTop: 12,
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
});
