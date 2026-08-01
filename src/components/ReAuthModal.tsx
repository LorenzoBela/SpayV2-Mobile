import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import { ShieldCheck, Eye, EyeOff, X } from 'lucide-react-native';
import { supabase } from '../utils/supabase';

export interface ReAuthModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: (token?: string) => void;
  title?: string;
  description?: string;
  email?: string;
}

export default function ReAuthModal({
  visible,
  onDismiss,
  onSuccess,
  title = 'Re-Authentication Required',
  description = 'Please enter your current password to confirm this sensitive action.',
  email,
}: ReAuthModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!password) {
      setErrorMsg('Password is required.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      let userEmail = email;
      if (!userEmail) {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user?.email) {
          throw new Error('User email session not found.');
        }
        userEmail = userData.user.email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });

      if (error || !data.session) {
        throw new Error(error?.message || 'Invalid password. Verification failed.');
      }

      const token = data.session.access_token;
      setPassword('');
      setErrorMsg(null);
      onSuccess(token);
      onDismiss();
    } catch (err: any) {
      setErrorMsg(err.message || 'Re-authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setPassword('');
    setErrorMsg(null);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <ShieldCheck size={20} color="#f4f4f5" />
            </View>
            <TouchableOpacity
              onPress={handleClose}
              disabled={loading}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#71717a"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMsg) setErrorMsg(null);
              }}
              autoCapitalize="none"
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff size={18} color="#a1a1aa" />
              ) : (
                <Eye size={18} color="#a1a1aa" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#000000', // Pure OLED Black (#000000)
    borderColor: '#1f1f1f',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Outfit-Bold',
    color: '#ffffff',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
    color: '#a1a1aa',
    lineHeight: 18,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 20,
  },
  input: {
    height: 46,
    backgroundColor: '#0d0d0d',
    borderColor: '#1f1f1f',
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 44,
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Jakarta-Medium',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  cancelBtnText: {
    color: '#e4e4e7',
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
  },
  confirmBtn: {
    backgroundColor: '#ee4d2d',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
  },
});
