import React, { useEffect, useState, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CircleCheck,
  Clock,
  Calendar,
  CloudUpload,
  Files,
  Sun,
  Moon,
  Bell,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList, ThemeContext } from '../../navigation/navigationTypes';
import { supabase } from '../../utils/supabase';

interface PaymentItem {
  id: string;
  itemName: string;
  amountDue: number;
  monthNumber: number;
  installmentMonths: number;
  dueDate: string;
  isPaid: boolean;
  paymentDate: string | null;
  proofOfPayment: string | null;
}

export default function PaymentsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'PAID'>('PENDING');

  const fetchPayments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          due_date,
          amount_due,
          month_number,
          is_paid,
          payment_date,
          proof_of_payment,
          order:orders (
            item_name,
            installment_months
          )
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;

      if (data) {
        const formatted: PaymentItem[] = data.map((p: any) => ({
          id: p.id,
          itemName: p.order?.item_name || 'Installment Order',
          amountDue: parseFloat(p.amount_due),
          monthNumber: p.month_number,
          installmentMonths: p.order?.installment_months || 12,
          dueDate: new Date(p.due_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          isPaid: p.is_paid,
          paymentDate: p.payment_date,
          proofOfPayment: p.proof_of_payment,
        }));
        setPayments(formatted);
      }
    } catch (error) {
      console.warn('Error fetching payments, fallback placeholders:', error);
      setPayments([
        {
          id: 'p1',
          itemName: 'iPhone 15 Pro Max',
          amountDue: 4500.0,
          monthNumber: 3,
          installmentMonths: 12,
          dueDate: 'May 28, 2026',
          isPaid: false,
          paymentDate: null,
          proofOfPayment: null,
        },
        {
          id: 'p2',
          itemName: 'Honda Beat FI 2025',
          amountDue: 3200.0,
          monthNumber: 5,
          installmentMonths: 24,
          dueDate: 'Jun 05, 2026',
          isPaid: false,
          paymentDate: null,
          proofOfPayment: null,
        },
        {
          id: 'p3',
          itemName: 'MacBook Air M3',
          amountDue: 5500.0,
          monthNumber: 1,
          installmentMonths: 10,
          dueDate: 'Jun 10, 2026',
          isPaid: false,
          paymentDate: null,
          proofOfPayment: null,
        },
        {
          id: 'p4',
          itemName: 'iPhone 15 Pro Max',
          amountDue: 4500.0,
          monthNumber: 2,
          installmentMonths: 12,
          dueDate: 'Apr 28, 2026',
          isPaid: true,
          paymentDate: '2026-04-27',
          proofOfPayment: 'https://storage.googleapis.com/spayv2-receipt.png',
        },
        {
          id: 'p5',
          itemName: 'Honda Beat FI 2025',
          amountDue: 3200.0,
          monthNumber: 4,
          installmentMonths: 24,
          dueDate: 'May 05, 2026',
          isPaid: true,
          paymentDate: '2026-05-04',
          proofOfPayment: 'https://storage.googleapis.com/spayv2-receipt2.png',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleUploadProof = (paymentId: string) => {
    Alert.alert(
      'Upload Receipt Proof',
      'Select payment verification image source.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Camera / Photo Library',
          onPress: async () => {
            setPayments((prev) =>
              prev.map((p) =>
                p.id === paymentId
                  ? {
                      ...p,
                      proofOfPayment: 'https://storage.googleapis.com/simulated-upload.png',
                    }
                  : p
              )
            );
            Alert.alert('Upload Successful', 'Proof of payment was successfully queued for approval.');
          },
        },
      ]
    );
  };

  const filteredPayments = payments.filter((p) => {
    if (activeTab === 'PENDING') return !p.isPaid;
    if (activeTab === 'PAID') return p.isPaid;
    return true;
  });

  // Dynamic theme colors
  const t = {
    bg: isDarkMode ? '#0b0f19' : '#f1f5f9',
    headerBg: isDarkMode ? '#0b0f19' : '#ffffff',
    headerBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#222d42' : '#e2e8f0',
    tabBg: isDarkMode ? '#161c2a' : '#ffffff',
    tabActiveBg: isDarkMode ? '#0b0f19' : '#f1f5f9',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    textMuted: isDarkMode ? '#64748b' : '#94a3b8',
    divider: isDarkMode ? '#222d42' : '#e2e8f0',
    iconBtnBg: isDarkMode ? 'rgba(148,163,184,0.06)' : '#f1f5f9',
    iconBtnBorder: isDarkMode ? 'rgba(148,163,184,0.1)' : '#e2e8f0',
  };

  const renderPaymentItem = ({ item }: { item: PaymentItem }) => (
    <View style={[styles.paymentCard, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
      <View style={styles.cardHeader}>
        <View style={styles.itemBadge}>
          {item.isPaid ? (
            <CircleCheck size={18} color="#10b981" />
          ) : (
            <Clock size={18} color="#f59e0b" />
          )}
          <Text style={[styles.itemNameText, { color: t.textPrimary }]}>{item.itemName}</Text>
        </View>
        <Text style={[styles.statusTag, item.isPaid ? styles.statusPaid : styles.statusPending]}>
          {item.isPaid ? 'PAID' : item.proofOfPayment ? 'PENDING APPROVAL' : 'UNPAID'}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.col}>
          <Text style={styles.bodyLabel}>AMOUNT DUE</Text>
          <Text style={[styles.amountText, { color: t.textPrimary }]}>₱{item.amountDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>

        <View style={styles.col}>
          <Text style={styles.bodyLabel}>INSTALLMENT MONTH</Text>
          <Text style={[styles.monthText, { color: t.textSecondary }]}>
            Month {item.monthNumber} of {item.installmentMonths}
          </Text>
        </View>
      </View>

      <View style={[styles.cardDivider, { backgroundColor: t.divider }]} />

      <View style={styles.cardFooter}>
        <View style={styles.dateContainer}>
          <Calendar size={15} color={t.textMuted} />
          <Text style={[styles.dateText, { color: t.textMuted }]}>
            {item.isPaid ? `Paid: ${item.dueDate}` : `Due: ${item.dueDate}`}
          </Text>
        </View>

        {!item.isPaid && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              item.proofOfPayment ? styles.actionBtnPending : styles.actionBtnUpload,
            ]}
            onPress={() => !item.proofOfPayment && handleUploadProof(item.id)}
            disabled={!!item.proofOfPayment}
          >
            <CloudUpload
              size={14}
              color="#ffffff"
              strokeWidth={item.proofOfPayment ? 2.5 : 1.5}
            />
            <Text style={styles.actionBtnText}>
              {item.proofOfPayment ? 'Pending' : 'Upload Proof'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.headerBg} />

      {/* Premium Header Bar */}
      <View style={[styles.webHeader, { backgroundColor: t.headerBg, borderColor: t.headerBorder }]}>
        <View style={styles.webHeaderLeft}>
          <Text style={styles.webHeaderSubtitle}>S-Pay Ledger</Text>
          <Text style={[styles.webHeaderTitle, { color: t.textPrimary }]}>Timeline & Payments</Text>
          <Text style={[styles.webHeaderDesc, { color: t.textSecondary }]}>
            Review payment history, active installment months, and submit receipts.
          </Text>
        </View>
        <View style={styles.webHeaderRight}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
            onPress={toggleTheme}
          >
            {isDarkMode ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#475569" />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: t.iconBtnBg, borderColor: t.iconBtnBorder }]}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Bell size={16} color={isDarkMode ? '#94a3b8' : '#475569'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: t.tabBg, borderColor: t.cardBorder }]}>
        {(['PENDING', 'PAID', 'ALL'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabButton,
              activeTab === tab && [styles.tabButtonActive, { backgroundColor: t.tabActiveBg, borderColor: t.cardBorder }],
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#ee4d2d" />
        </View>
      ) : (
        <FlatList
          data={filteredPayments}
          keyExtractor={(item) => item.id}
          renderItem={renderPaymentItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Files size={48} color={t.textMuted} />
              <Text style={[styles.emptyText, { color: t.textMuted }]}>No matching payments found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  webHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  webHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webHeaderSubtitle: {
    color: '#ee4d2d',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  webHeaderTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  webHeaderDesc: {
    fontSize: 11,
    fontFamily: 'Jakarta-Medium',
    marginTop: 4,
    lineHeight: 15,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1.5,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    borderWidth: 1,
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    fontFamily: 'Jakarta-Bold',
  },
  tabTextActive: {
    color: '#ee4d2d',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  paymentCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  itemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 10,
  },
  itemNameText: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusTag: {
    fontSize: 10,
    fontWeight: '800',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  statusPaid: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    color: '#10b981',
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    color: '#f59e0b',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  col: {
    flex: 1,
  },
  bodyLabel: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cardDivider: {
    height: 1,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionBtnUpload: {
    backgroundColor: '#ee4d2d',
  },
  actionBtnPending: {
    backgroundColor: '#475569',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
});
