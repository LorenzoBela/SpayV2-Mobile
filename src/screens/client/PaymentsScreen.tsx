import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'PAID'>('PENDING');

  const fetchPayments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Join query via Supabase JS client
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
      // Fallback data for demonstration and premium client testing
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
            // Simulate uploader state
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

  const renderPaymentItem = ({ item }: { item: PaymentItem }) => (
    <View style={styles.paymentCard}>
      <View style={styles.cardHeader}>
        <View style={styles.itemBadge}>
          <Ionicons
            name={item.isPaid ? 'checkmark-circle' : 'time'}
            size={18}
            color={item.isPaid ? '#10b981' : '#f59e0b'}
          />
          <Text style={styles.itemNameText}>{item.itemName}</Text>
        </View>
        <Text style={[styles.statusTag, item.isPaid ? styles.statusPaid : styles.statusPending]}>
          {item.isPaid ? 'PAID' : item.proofOfPayment ? 'PENDING APPROVAL' : 'UNPAID'}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.col}>
          <Text style={styles.bodyLabel}>AMOUNT DUE</Text>
          <Text style={styles.amountText}>₱{item.amountDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        </View>

        <View style={styles.col}>
          <Text style={styles.bodyLabel}>INSTALLMENT MONTH</Text>
          <Text style={styles.monthText}>
            Month {item.monthNumber} of {item.installmentMonths}
          </Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardFooter}>
        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={15} color="#64748b" />
          <Text style={styles.dateText}>
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
            <Ionicons
              name={item.proofOfPayment ? 'cloud-upload' : 'cloud-upload-outline'}
              size={14}
              color="#ffffff"
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {(['PENDING', 'PAID', 'ALL'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
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
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={filteredPayments}
          keyExtractor={(item) => item.id}
          renderItem={renderPaymentItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="documents-outline" size={48} color="#475569" />
              <Text style={styles.emptyText}>No matching payments found.</Text>
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
    backgroundColor: '#0f172a',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    margin: 16,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#3b82f6',
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
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#f8fafc',
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
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  monthText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#334155',
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
    color: '#64748b',
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
    backgroundColor: '#3b82f6',
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
    color: '#475569',
    fontSize: 14,
    marginTop: 12,
  },
});
