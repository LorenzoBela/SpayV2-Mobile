import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  UserCheck,
  ShieldAlert,
  Users,
  Phone,
  Mail,
  List,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { ThemeContext } from '../navigation/navigationTypes';
import { fetchAdminClients } from '../services/adminService';
import { useImpersonation } from '../context/ImpersonationContext';
import { useQuery } from '@tanstack/react-query';
import { useResponsiveLayout } from '../utils/responsive';
import BiometricReAuthModal from './BiometricReAuthModal';

interface AdminImpersonationModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectClient?: (client: any) => void;
}

export function AdminImpersonationModal({
  visible,
  onClose,
  onSelectClient,
}: AdminImpersonationModalProps) {
  const { isDarkMode } = useContext(ThemeContext);
  const { startImpersonation } = useImpersonation();
  const layout = useResponsiveLayout();

  const [searchVal, setSearchVal] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchVal);
      setPage(1); // Reset to page 1 on new search query
    }, 300);
    return () => clearTimeout(timer);
  }, [searchVal]);

  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['admin-clients-impersonate-modal', debouncedSearch, page, pageSize],
    queryFn: () =>
      fetchAdminClients({
        page,
        pageSize,
        searchQuery: debouncedSearch,
        status: 'all',
      }),
    enabled: visible,
    staleTime: 15000,
  });

  const clients = useMemo(() => clientsData?.clients || [], [clientsData]);
  const totalClients = clientsData?.total || clients.length;
  const totalPages = Math.max(1, Math.ceil(totalClients / pageSize));

  const [isReAuthOpen, setIsReAuthOpen] = useState(false);
  const [pendingClient, setPendingClient] = useState<any>(null);

  const executeImpersonate = (client: any) => {
    startImpersonation(client);
    if (onSelectClient) {
      onSelectClient(client);
    }
    onClose();
  };

  const handleImpersonate = (client: any) => {
    setPendingClient(client);
    setIsReAuthOpen(true);
  };

  const t = {
    bg: isDarkMode ? '#000000' : '#f8fafc',
    cardBg: isDarkMode ? '#161c2a' : '#ffffff',
    cardBorder: isDarkMode ? '#223049' : '#e2e8f0',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#1e293b' : '#f1f5f9',
    accent: '#ee4d2d',
    accentLight: 'rgba(238, 77, 45, 0.1)',
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

        {/* Modal Header */}
        <View style={[styles.header, { backgroundColor: t.cardBg, borderBottomColor: t.cardBorder }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <ShieldAlert size={20} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerSubtitle}>ADMIN SECURITY CONTROL</Text>
              <Text style={[styles.headerTitle, { color: t.textPrimary }]} numberOfLines={1}>
                Impersonate Client User
              </Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: t.border }]} onPress={onClose}>
            <X size={18} color={t.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Controls Bar: Search + Layout Toggle */}
        <View style={styles.searchSection}>
          <View style={[styles.searchBox, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
            <Search size={18} color={t.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: t.textPrimary }]}
              placeholder="Search client by name, email, or mobile..."
              placeholderTextColor={t.textSecondary}
              value={searchVal}
              onChangeText={setSearchVal}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchVal ? (
              <TouchableOpacity onPress={() => setSearchVal('')}>
                <X size={16} color={t.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* View Mode & Stats Toggle Bar */}
          <View style={styles.toolbarRow}>
            <Text style={[styles.resultCountText, { color: t.textSecondary }]}>
              {totalClients > 0
                ? `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalClients)} of ${totalClients} clients`
                : 'No clients found'}
            </Text>

            <View style={[styles.viewToggleGroup, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === 'list' && { backgroundColor: t.accentLight }]}
                onPress={() => setViewMode('list')}
              >
                <List size={16} color={viewMode === 'list' ? t.accent : t.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === 'grid' && { backgroundColor: t.accentLight }]}
                onPress={() => setViewMode('grid')}
              >
                <LayoutGrid size={16} color={viewMode === 'grid' ? t.accent : t.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Client Content Area */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={t.accent} />
            <Text style={[styles.loadingText, { color: t.textSecondary }]}>Loading client accounts...</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              key={viewMode} // Re-render FlatList when switching layout columns
              data={clients}
              keyExtractor={(item) => item.id}
              numColumns={viewMode === 'grid' ? (layout.isTablet ? 3 : 2) : 1}
              columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Users size={36} color={t.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No Clients Found</Text>
                  <Text style={[styles.emptySubtitle, { color: t.textSecondary }]}>
                    Try adjusting your search by client name, email, or phone.
                  </Text>
                </View>
              }
              renderItem={({ item }) =>
                viewMode === 'list' ? (
                  // List Row View (With Email Cutoff Prevention)
                  <View style={[styles.clientCardList, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                    <View style={styles.clientInfoRow}>
                      <Image
                        source={{
                          uri:
                            item.avatar_url ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=ee4d2d&color=fff&size=100&bold=true`,
                        }}
                        style={styles.avatarList}
                      />

                      <View style={styles.metaContainerList}>
                        <Text style={[styles.clientName, { color: t.textPrimary }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.email ? (
                          <View style={styles.iconDetailRow}>
                            <Mail size={12} color={t.textSecondary} style={{ flexShrink: 0 }} />
                            <Text
                              style={[styles.clientEmail, { color: t.textSecondary }]}
                              numberOfLines={1}
                              ellipsizeMode="middle"
                            >
                              {item.email}
                            </Text>
                          </View>
                        ) : null}
                        {item.mobile_number ? (
                          <View style={styles.iconDetailRow}>
                            <Phone size={12} color={t.textSecondary} style={{ flexShrink: 0 }} />
                            <Text style={[styles.clientPhone, { color: t.textSecondary }]} numberOfLines={1}>
                              {item.mobile_number}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <TouchableOpacity
                        style={styles.impersonateBtnList}
                        onPress={() => handleImpersonate(item)}
                        activeOpacity={0.8}
                      >
                        <UserCheck size={14} color="#ffffff" />
                        <Text style={styles.impersonateBtnText}>Impersonate</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  // Card Grid Bento View
                  <View style={[styles.clientCardGrid, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
                    <Image
                      source={{
                        uri:
                          item.avatar_url ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=ee4d2d&color=fff&size=100&bold=true`,
                      }}
                      style={styles.avatarGrid}
                    />
                    <Text style={[styles.gridName, { color: t.textPrimary }]} numberOfLines={1}>
                      {item.name}
                    </Text>

                    {item.email ? (
                      <View style={styles.iconDetailRowGrid}>
                        <Mail size={11} color={t.textSecondary} style={{ flexShrink: 0 }} />
                        <Text
                          style={[styles.gridEmail, { color: t.textSecondary }]}
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {item.email}
                        </Text>
                      </View>
                    ) : null}

                    {item.mobile_number ? (
                      <View style={styles.iconDetailRowGrid}>
                        <Phone size={11} color={t.textSecondary} style={{ flexShrink: 0 }} />
                        <Text style={[styles.gridPhone, { color: t.textSecondary }]} numberOfLines={1}>
                          {item.mobile_number}
                        </Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={styles.impersonateBtnGrid}
                      onPress={() => handleImpersonate(item)}
                      activeOpacity={0.8}
                    >
                      <UserCheck size={13} color="#ffffff" />
                      <Text style={styles.impersonateBtnTextGrid}>Impersonate</Text>
                    </TouchableOpacity>
                  </View>
                )
              }
            />

            {/* Pagination Controls Footer */}
            {totalPages > 1 ? (
              <View style={[styles.paginationFooter, { backgroundColor: t.cardBg, borderTopColor: t.cardBorder }]}>
                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    { backgroundColor: t.border },
                    page <= 1 && styles.disabledPageBtn,
                  ]}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={16} color={page <= 1 ? t.textSecondary : t.textPrimary} />
                  <Text style={[styles.pageBtnText, { color: page <= 1 ? t.textSecondary : t.textPrimary }]}>
                    Previous
                  </Text>
                </TouchableOpacity>

                <View style={styles.pageBadge}>
                  <Text style={[styles.pageIndicatorText, { color: t.textPrimary }]}>
                    Page <Text style={{ color: t.accent, fontFamily: 'Jakarta-Bold' }}>{page}</Text> of {totalPages}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    { backgroundColor: t.border },
                    page >= totalPages && styles.disabledPageBtn,
                  ]}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <Text style={[styles.pageBtnText, { color: page >= totalPages ? t.textSecondary : t.textPrimary }]}>
                    Next
                  </Text>
                  <ChevronRight size={16} color={page >= totalPages ? t.textSecondary : t.textPrimary} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
        <BiometricReAuthModal
          visible={isReAuthOpen}
          onDismiss={() => {
            setIsReAuthOpen(false);
            setPendingClient(null);
          }}
          onSuccess={() => {
            if (pendingClient) {
              const clientToImpersonate = pendingClient;
              setPendingClient(null);
              executeImpersonate(clientToImpersonate);
            }
          }}
          title="Impersonation Re-Authentication"
          description={`Please verify your identity with biometrics or current password to activate impersonation mode for ${pendingClient?.name || 'this client'}.`}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1.5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSubtitle: {
    color: '#f59e0b',
    fontSize: 9,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Jakarta-Bold',
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Jakarta-Medium',
  },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  resultCountText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },
  viewToggleGroup: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Jakarta-Medium',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  gridRow: {
    justifyContent: 'space-between',
    gap: 10,
  },

  // List Row Styling
  clientCardList: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
  },
  clientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarList: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  metaContainerList: {
    flex: 1,
    gap: 3,
    paddingRight: 4,
  },
  clientName: {
    fontSize: 15,
    fontFamily: 'Jakarta-Bold',
  },
  iconDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  clientEmail: {
    fontSize: 12,
    fontFamily: 'Jakarta-Regular',
    flexShrink: 1,
  },
  clientPhone: {
    fontSize: 12,
    fontFamily: 'Jakarta-Regular',
  },
  impersonateBtnList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ee4d2d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'center',
  },
  impersonateBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },

  // Bento Card Grid Styling
  clientCardGrid: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  avatarGrid: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 2,
  },
  gridName: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
    textAlign: 'center',
  },
  iconDetailRowGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    paddingHorizontal: 4,
  },
  gridEmail: {
    fontSize: 11,
    fontFamily: 'Jakarta-Regular',
    textAlign: 'center',
    flexShrink: 1,
  },
  gridPhone: {
    fontSize: 11,
    fontFamily: 'Jakarta-Regular',
    textAlign: 'center',
  },
  impersonateBtnGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#ee4d2d',
    width: '100%',
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 6,
  },
  impersonateBtnTextGrid: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
  },

  paginationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1.5,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  disabledPageBtn: {
    opacity: 0.5,
  },
  pageBtnText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Bold',
  },
  pageBadge: {
    alignItems: 'center',
  },
  pageIndicatorText: {
    fontSize: 12,
    fontFamily: 'Jakarta-Medium',
  },

  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Jakarta-Bold',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Jakarta-Regular',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default AdminImpersonationModal;
