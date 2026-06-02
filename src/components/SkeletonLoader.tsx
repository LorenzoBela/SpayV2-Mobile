import React, { useContext } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { createShimmerPlaceholder } from 'react-native-shimmer-placeholder';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeContext } from '../navigation/navigationTypes';
import { useResponsiveLayout } from '../utils/responsive';

const ShimmerPlaceholder = createShimmerPlaceholder(LinearGradient);

interface ShimmerBlockProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const ShimmerBlock = ({ width = '100%', height = 20, borderRadius = 8, style }: ShimmerBlockProps) => {
  const theme = useContext(ThemeContext);
  const isDarkMode = theme?.isDarkMode ?? true;

  // Use elegant dark/light theme colors for the shimmer gradients
  const shimmerColors = isDarkMode
    ? ['#161c2a', '#2d3748', '#161c2a']
    : ['#e2e8f0', '#f1f5f9', '#e2e8f0'];

  return (
    <ShimmerPlaceholder
      style={[{ width, height, borderRadius }, style]}
      shimmerColors={shimmerColors}
    />
  );
};

// 1. Payments Screen Skeleton
export const PaymentsSkeleton = () => {
  const theme = useContext(ThemeContext);
  const isDarkMode = theme?.isDarkMode ?? true;
  const layout = useResponsiveLayout();
  const cardBg = isDarkMode ? '#161c2a' : '#ffffff';
  const cardBorder = isDarkMode ? '#222d42' : '#e2e8f0';

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDarkMode ? '#0b0f19' : '#f1f5f9' }]} contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}>
      {/* Next Billing Countdown Card */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.headerRow}>
          <ShimmerBlock width={36} height={36} borderRadius={10} />
          <View style={{ marginLeft: 12, gap: 6, flex: 1 }}>
            <ShimmerBlock width={120} height={10} />
            <ShimmerBlock width="60%" height={16} />
          </View>
        </View>
        <View style={{ marginTop: 20, alignItems: 'center', gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <ShimmerBlock key={i} width={50} height={60} borderRadius={10} />
            ))}
          </View>
          <ShimmerBlock width={140} height={10} style={{ marginTop: 6 }} />
          <ShimmerBlock width={180} height={16} />
          <ShimmerBlock width={120} height={36} borderRadius={12} style={{ marginTop: 4 }} />
        </View>
      </View>

      {/* Analytics stats (4 cards) */}
      <View style={styles.grid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.gridCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ShimmerBlock width={50} height={8} />
            <ShimmerBlock width={80} height={20} style={{ marginVertical: 8 }} />
            <ShimmerBlock width={70} height={8} />
          </View>
        ))}
      </View>

      {/* View Toggle Bar */}
      <View style={{ flexDirection: 'row', gap: 12, marginVertical: 16 }}>
        <ShimmerBlock width="48%" height={38} borderRadius={12} />
        <ShimmerBlock width="48%" height={38} borderRadius={12} />
      </View>

      {/* Search Bar Skeleton */}
      <ShimmerBlock width="100%" height={48} borderRadius={14} style={{ marginBottom: 16 }} />

      {/* Payments List */}
      <View style={{ gap: 12 }}>
        {[1, 2].map((i) => (
          <View key={i} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <ShimmerBlock width={150} height={14} />
              <ShimmerBlock width={70} height={18} borderRadius={8} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
              <View style={{ gap: 6 }}>
                <ShimmerBlock width={60} height={8} />
                <ShimmerBlock width={90} height={16} />
              </View>
              <View style={{ gap: 6, alignItems: 'flex-end' }}>
                <ShimmerBlock width={80} height={8} />
                <ShimmerBlock width={110} height={14} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

// 2. Orders Screen Skeleton
export const OrdersSkeleton = () => {
  const theme = useContext(ThemeContext);
  const isDarkMode = theme?.isDarkMode ?? true;
  const layout = useResponsiveLayout();
  const cardBg = isDarkMode ? '#161c2a' : '#ffffff';
  const cardBorder = isDarkMode ? '#222d42' : '#e2e8f0';

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDarkMode ? '#0b0f19' : '#f1f5f9' }]} contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}>
      {/* 4 Stats Cards */}
      <View style={styles.grid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.gridCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ShimmerBlock width={50} height={8} />
            <ShimmerBlock width={85} height={18} style={{ marginVertical: 8 }} />
          </View>
        ))}
      </View>

      {/* Controls: Search and filter pills */}
      <ShimmerBlock width="100%" height={46} borderRadius={12} style={{ marginVertical: 16 }} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <ShimmerBlock width={60} height={32} borderRadius={8} />
        <ShimmerBlock width={80} height={32} borderRadius={8} />
        <ShimmerBlock width={80} height={32} borderRadius={8} />
      </View>

      {/* Orders list */}
      <View style={{ gap: 14 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ gap: 6 }}>
                <ShimmerBlock width={160} height={14} />
                <ShimmerBlock width={100} height={9} />
              </View>
              <ShimmerBlock width={60} height={18} borderRadius={8} />
            </View>
            <View style={{ marginTop: 14 }}>
              <ShimmerBlock width="100%" height={6} borderRadius={3} style={{ marginBottom: 8 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <ShimmerBlock width={150} height={10} />
                <ShimmerBlock width={70} height={14} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

// 3. Budget Screen Skeleton
export const BudgetSkeleton = () => {
  const theme = useContext(ThemeContext);
  const isDarkMode = theme?.isDarkMode ?? true;
  const layout = useResponsiveLayout();
  const cardBg = isDarkMode ? '#161c2a' : '#ffffff';
  const cardBorder = isDarkMode ? '#222d42' : '#e2e8f0';

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDarkMode ? '#0b0f19' : '#f1f5f9' }]} contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}>
      {/* Shared Credit limit exposure gauge card */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, paddingVertical: 24 }]}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <ShimmerBlock width={140} height={10} />
          <ShimmerBlock width={200} height={28} />
          <ShimmerBlock width="100%" height={8} borderRadius={4} style={{ marginTop: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 4 }}>
            <ShimmerBlock width={100} height={10} />
            <ShimmerBlock width={130} height={10} />
          </View>
        </View>
      </View>

      {/* Credit limits list items */}
      <ShimmerBlock width={120} height={12} style={{ marginVertical: 16 }} />
      <View style={{ gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ShimmerBlock width={30} height={30} borderRadius={8} />
                <View style={{ gap: 4 }}>
                  <ShimmerBlock width={110} height={12} />
                  <ShimmerBlock width={70} height={8} />
                </View>
              </View>
              <ShimmerBlock width={90} height={16} />
            </View>
            <View style={{ marginTop: 16 }}>
              <ShimmerBlock width="100%" height={5} borderRadius={3} style={{ marginBottom: 6 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <ShimmerBlock width={80} height={8} />
                <ShimmerBlock width={100} height={8} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

// 4. Reports Screen Skeleton
export const ReportsSkeleton = () => {
  const theme = useContext(ThemeContext);
  const isDarkMode = theme?.isDarkMode ?? true;
  const layout = useResponsiveLayout();
  const cardBg = isDarkMode ? '#161c2a' : '#ffffff';
  const cardBorder = isDarkMode ? '#222d42' : '#e2e8f0';

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDarkMode ? '#0b0f19' : '#f1f5f9' }]} contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}>
      {/* Date selector shimmers */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <ShimmerBlock width="48%" height={38} borderRadius={10} />
        <ShimmerBlock width="48%" height={38} borderRadius={10} />
      </View>

      {/* Analytics widgets */}
      <View style={styles.grid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.gridCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ShimmerBlock width={60} height={8} />
            <ShimmerBlock width={90} height={18} style={{ marginVertical: 8 }} />
          </View>
        ))}
      </View>

      {/* Chart Card shimmer */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, marginVertical: 16 }]}>
        <ShimmerBlock width={120} height={12} style={{ marginBottom: 20 }} />
        <ShimmerBlock width="100%" height={160} borderRadius={12} />
      </View>

      {/* List breakdown skeleton */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <ShimmerBlock width={150} height={12} style={{ marginBottom: 16 }} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: i > 1 ? 1 : 0, borderColor: cardBorder }}>
            <View style={{ gap: 4 }}>
              <ShimmerBlock width={110} height={10} />
              <ShimmerBlock width={70} height={8} />
            </View>
            <ShimmerBlock width={80} height={14} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

// 5. Calendar Screen Skeleton
export const CalendarSkeleton = () => {
  const theme = useContext(ThemeContext);
  const isDarkMode = theme?.isDarkMode ?? true;
  const layout = useResponsiveLayout();
  const cardBg = isDarkMode ? '#161c2a' : '#ffffff';
  const cardBorder = isDarkMode ? '#222d42' : '#e2e8f0';

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDarkMode ? '#0b0f19' : '#f1f5f9' }]} contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}>
      {/* Calendar Card Shimmer */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, height: 320, justifyContent: 'center' }]}>
        <ShimmerBlock width={160} height={16} style={{ alignSelf: 'center', marginBottom: 20 }} />
        <View style={{ gap: 16, paddingHorizontal: 16 }}>
          {[1, 2, 3, 4, 5].map((row) => (
            <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                <ShimmerBlock key={col} width={26} height={26} borderRadius={13} />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Due Events list */}
      <ShimmerBlock width={130} height={12} style={{ marginVertical: 16 }} />
      <View style={{ gap: 12 }}>
        {[1, 2].map((i) => (
          <View key={i} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ gap: 6, flex: 1 }}>
                <ShimmerBlock width="70%" height={12} />
                <ShimmerBlock width="50%" height={8} />
              </View>
              <ShimmerBlock width={70} height={16} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

// 6. Profile Screen Skeleton
export const ProfileSkeleton = () => {
  const theme = useContext(ThemeContext);
  const isDarkMode = theme?.isDarkMode ?? true;
  const layout = useResponsiveLayout();
  const cardBg = isDarkMode ? '#161c2a' : '#ffffff';
  const cardBorder = isDarkMode ? '#222d42' : '#e2e8f0';

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDarkMode ? '#0b0f19' : '#f1f5f9' }]} contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}>
      {/* Profile Info Header */}
      <View style={{ alignItems: 'center', marginVertical: 20, gap: 10 }}>
        <ShimmerBlock width={80} height={80} borderRadius={40} />
        <ShimmerBlock width={140} height={16} />
        <ShimmerBlock width={180} height={10} />
      </View>

      {/* Profile form fields */}
      <View style={{ gap: 16, marginTop: 10 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ gap: 6 }}>
            <ShimmerBlock width={90} height={8} />
            <ShimmerBlock width="100%" height={46} borderRadius={12} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

// 7. Settings Screen Skeleton
export const SettingsSkeleton = () => {
  const theme = useContext(ThemeContext);
  const isDarkMode = theme?.isDarkMode ?? true;
  const layout = useResponsiveLayout();
  const cardBg = isDarkMode ? '#161c2a' : '#ffffff';
  const cardBorder = isDarkMode ? '#222d42' : '#e2e8f0';

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDarkMode ? '#0b0f19' : '#f1f5f9' }]} contentContainerStyle={[styles.scrollContent, layout.scrollContentStyle]}>
      <View style={{ gap: 20, marginTop: 10 }}>
        {/* Settings Group 1 */}
        <View style={{ gap: 10 }}>
          <ShimmerBlock width={100} height={10} style={{ marginLeft: 4 }} />
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0 }]}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: i > 1 ? 1 : 0, borderColor: cardBorder }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <ShimmerBlock width={20} height={20} borderRadius={5} />
                  <ShimmerBlock width={120} height={12} />
                </View>
                <ShimmerBlock width={40} height={20} borderRadius={10} />
              </View>
            ))}
          </View>
        </View>

        {/* Settings Group 2 */}
        <View style={{ gap: 10 }}>
          <ShimmerBlock width={80} height={10} style={{ marginLeft: 4 }} />
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, padding: 0 }]}>
            {[1, 2].map((i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: i > 1 ? 1 : 0, borderColor: cardBorder }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <ShimmerBlock width={20} height={20} borderRadius={5} />
                  <ShimmerBlock width={100} height={12} />
                </View>
                <ShimmerBlock width={20} height={20} borderRadius={10} />
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 16,
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
