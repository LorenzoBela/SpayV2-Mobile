import React, { useContext } from 'react';
import {
  Modal,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  SafeAreaView,
  Platform,
} from 'react-native';
import {
  ShoppingBag,
  X,
  Link,
  DollarSign,
  Calendar,
  CheckCircle2,
  Package,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';

export interface BuyRequestGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BuyRequestGuideModal({
  visible,
  onClose,
}: BuyRequestGuideModalProps) {
  const themeContext = useContext(ThemeContext);
  const colorScheme = useColorScheme();
  const isDarkMode = themeContext?.isDarkMode ?? (colorScheme === 'dark');

  const t = {
    overlayBg: isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.5)',
    contentBg: isDarkMode ? '#0f172a' : '#ffffff',
    headerBorder: isDarkMode ? '#1e293b' : '#f1f5f9',
    cardBg: isDarkMode ? '#1e293b' : '#f8fafc',
    cardBorder: isDarkMode ? '#334155' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    accent: '#ee4d2d', // Shopee Orange
    accentLight: isDarkMode ? 'rgba(238, 77, 45, 0.2)' : 'rgba(238, 77, 45, 0.08)',
    accentBorder: isDarkMode ? 'rgba(238, 77, 45, 0.4)' : 'rgba(238, 77, 45, 0.3)',
  };

  const steps = [
    {
      num: '1',
      icon: Link,
      title: 'Copy Product Link',
      desc: 'Open Shopee, navigate to your desired product, and tap Share → Copy Link.',
    },
    {
      num: '2',
      icon: ShoppingBag,
      title: 'Specify Variant & Quantity',
      desc: 'Select the exact color, size, or model variation and set the quantity you need.',
    },
    {
      num: '3',
      icon: DollarSign,
      title: 'Input Exact Shopee Price',
      desc: 'Enter the price reflected on Shopee (including vouchers/discounts).',
    },
    {
      num: '4',
      icon: Calendar,
      title: 'Pick Installment Plan',
      desc: 'Choose 1, 3, 6, or 12 months. Your monthly amortization will be computed live.',
    },
    {
      num: '5',
      icon: Package,
      title: 'Admin Procurement & Delivery',
      desc: 'Once approved, admin purchases the item on Shopee and links it to your SPay schedule.',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.overlay, { backgroundColor: t.overlayBg }]}>
        <View style={[styles.container, { backgroundColor: t.contentBg }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: t.headerBorder }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.iconCircle, { backgroundColor: t.accentLight }]}>
                <ShoppingBag size={20} color={t.accent} />
              </View>
              <View>
                <Text style={[styles.title, { color: t.textPrimary }]}>How Buy Request Works</Text>
                <Text style={[styles.subtitle, { color: t.textSecondary }]}>Easy 5-step procurement guide</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: t.cardBg }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color={t.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Steps Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Note banner */}
            <View style={[styles.banner, { backgroundColor: t.accentLight, borderColor: t.accentBorder }]}>
              <Info size={16} color={t.accent} style={{ marginTop: 2 }} />
              <Text style={[styles.bannerText, { color: t.textPrimary }]}>
                Manually input the exact price from Shopee to get an instant amortization preview before submitting.
              </Text>
            </View>

            {steps.map((s, idx) => {
              const IconComp = s.icon;
              return (
                <View
                  key={s.num}
                  style={[
                    styles.stepCard,
                    { backgroundColor: t.cardBg, borderColor: t.cardBorder },
                  ]}
                >
                  <View style={[styles.stepNumBadge, { backgroundColor: t.accent }]}>
                    <Text style={styles.stepNumText}>{s.num}</Text>
                  </View>
                  <View style={styles.stepInfo}>
                    <View style={styles.stepTitleRow}>
                      <IconComp size={15} color={t.accent} />
                      <Text style={[styles.stepTitle, { color: t.textPrimary }]}>{s.title}</Text>
                    </View>
                    <Text style={[styles.stepDesc, { color: t.textSecondary }]}>{s.desc}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: t.headerBorder }]}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.primaryButton, { backgroundColor: t.accent }]}
            >
              <Text style={styles.primaryButtonText}>Got It, Let&apos;s Start</Text>
              <ArrowRight size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    gap: 12,
  },
  banner: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  stepNumBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  stepInfo: {
    flex: 1,
    gap: 4,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
