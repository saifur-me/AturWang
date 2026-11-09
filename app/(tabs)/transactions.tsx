import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TransactionItem, Wallet } from '../../src/types/finance';
import { getAllWallets } from '../../src/database/walletRepo';
import {
  getTransactionsByMonth,
  deleteTransactionAtomic,
} from '../../src/database/transactionRepo';
import {
  formatRupiah,
  getCurrentMonthPeriod,
  shiftMonthPeriod,
  formatMonthLabel,
} from '../../src/utils/formatters';

export default function TransactionsScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const [monthPeriod, setMonthPeriod] = useState<string>(getCurrentMonthPeriod());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedDetailTx, setSelectedDetailTx] = useState<TransactionItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allWallets, transList] = await Promise.all([
        getAllWallets(db),
        getTransactionsByMonth(
          db,
          monthPeriod,
          searchQuery,
          selectedWalletId ?? undefined
        ),
      ]);
      setWallets(allWallets);
      setTransactions(transList);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [db, monthPeriod, searchQuery, selectedWalletId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handlePrevMonth = () => {
    setMonthPeriod((prev) => shiftMonthPeriod(prev, -1));
  };

  const handleNextMonth = () => {
    setMonthPeriod((prev) => shiftMonthPeriod(prev, 1));
  };

  const handleDelete = (tx: TransactionItem) => {
    Alert.alert(
      'Hapus Transaksi',
      `Apakah Anda yakin ingin menghapus transaksi ini sebesar ${formatRupiah(tx.amount)}? Saldo dompet akan dikembalikan secara otomatis.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransactionAtomic(db, tx.id);
              await loadData();
            } catch (err: any) {
              Alert.alert('Gagal Menghapus', err?.message ?? 'Terjadi kesalahan.');
            }
          },
        },
      ]
    );
  };

  const renderTransactionItem = ({ item }: { item: TransactionItem }) => {
    const isExpense = item.type === 'EXPENSE';
    const isIncome = item.type === 'INCOME';
    const isTransfer = item.type === 'TRANSFER';

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.card}
        onPress={() => setSelectedDetailTx(item)}
      >
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: isExpense
                ? '#FEE2E2'
                : isIncome
                  ? '#D1FAE5'
                  : '#DBEAFE',
            },
          ]}
        >
          <Ionicons
            name={
              isTransfer
                ? 'swap-horizontal'
                : (item.category_icon as any) || (isExpense ? 'cart-outline' : 'cash-outline')
            }
            size={22}
            color={
              isExpense
                ? '#EF4444'
                : isIncome
                  ? '#10B981'
                  : '#2563EB'
            }
          />
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.categoryTitle}>
            {isTransfer
              ? `Transfer: ${item.wallet_name} → ${item.target_wallet_name}`
              : item.category_name || 'Tanpa Kategori'}
          </Text>
          <Text style={styles.metaText}>
            {item.wallet_name} • {item.trans_date}
          </Text>
          {item.note ? <Text numberOfLines={1} style={styles.noteText}>"{item.note}"</Text> : null}
        </View>

        <View style={styles.actionCol}>
          <Text
            style={[
              styles.amountText,
              {
                color: isExpense
                  ? '#EF4444'
                  : isIncome
                    ? '#10B981'
                    : '#2563EB',
              },
            ]}
          >
            {isExpense ? '-' : isIncome ? '+' : ''}
            {formatRupiah(item.amount)}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#CBD5E1" style={{ marginTop: 2 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      {/* 1. Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <View style={styles.headerTitleWrap}>
          <Text numberOfLines={1} style={styles.headerTitle}>Riwayat Bulanan</Text>
          <Text style={styles.headerSubtitle}>Catatan Keluar & Masuk</Text>
        </View>
        <View style={styles.brandBadge}>
          <Ionicons name="receipt-outline" size={14} color="#2563EB" />
          <Text style={styles.brandBadgeText}>{transactions.length} Transaksi</Text>
        </View>
      </View>

      {/* 2. Month Navigator Bar (Below Header) */}
      <View style={styles.monthBarContainer}>
        <TouchableOpacity
          style={styles.monthArrowBtn}
          onPress={handlePrevMonth}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Bulan Sebelumnya"
        >
          <Ionicons name="chevron-back" size={18} color="#2563EB" />
        </TouchableOpacity>

        <View style={styles.monthCenterBadge}>
          <View style={styles.calendarIconCircle}>
            <Ionicons name="calendar-outline" size={15} color="#2563EB" />
          </View>
          <Text style={styles.monthText}>{formatMonthLabel(monthPeriod)}</Text>
        </View>

        <TouchableOpacity
          style={styles.monthArrowBtn}
          onPress={handleNextMonth}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Bulan Berikutnya"
        >
          <Ionicons name="chevron-forward" size={18} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* 2. Search Box */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#94A3B8" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari transaksi atau kategori..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* 3. Horizontal Wallet Chips Filter */}
      <View style={styles.walletFilterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 0, name: 'Semua Dompet' } as any, ...wallets]}
          keyExtractor={(item) => `filter-wallet-${item.id}`}
          renderItem={({ item }) => {
            const isSelected =
              item.id === 0
                ? selectedWalletId === null
                : selectedWalletId === item.id;
            return (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipActive,
                ]}
                onPress={() => setSelectedWalletId(item.id === 0 ? null : item.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        />
      </View>

      {/* 4. Transactions List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => `tx-list-${item.id}`}
          renderItem={renderTransactionItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 80 },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="file-tray-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>Tidak ada transaksi</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Tidak ditemukan transaksi yang cocok dengan kata kunci.'
                  : 'Belum ada transaksi di periode bulan ini.'}
              </Text>
            </View>
          }
        />
      )}

      {/* 5. Detail Transaksi Modal */}
      <Modal
        visible={!!selectedDetailTx}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDetailTx(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Detail Transaksi</Text>
              <TouchableOpacity
                onPress={() => setSelectedDetailTx(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedDetailTx && (
              <>
                {/* Hero Amount & Type Badge */}
                <View style={styles.modalHeroSection}>
                  <View
                    style={[
                      styles.modalHeroIconWrap,
                      {
                        backgroundColor:
                          selectedDetailTx.type === 'EXPENSE'
                            ? '#FEE2E2'
                            : selectedDetailTx.type === 'INCOME'
                              ? '#D1FAE5'
                              : '#DBEAFE',
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        selectedDetailTx.type === 'TRANSFER'
                          ? 'swap-horizontal'
                          : (selectedDetailTx.category_icon as any) ||
                            (selectedDetailTx.type === 'EXPENSE' ? 'cart-outline' : 'cash-outline')
                      }
                      size={28}
                      color={
                        selectedDetailTx.type === 'EXPENSE'
                          ? '#EF4444'
                          : selectedDetailTx.type === 'INCOME'
                            ? '#10B981'
                            : '#2563EB'
                      }
                    />
                  </View>

                  <Text
                    style={[
                      styles.modalHeroAmount,
                      {
                        color:
                          selectedDetailTx.type === 'EXPENSE'
                            ? '#EF4444'
                            : selectedDetailTx.type === 'INCOME'
                              ? '#10B981'
                              : '#2563EB',
                      },
                    ]}
                  >
                    {selectedDetailTx.type === 'EXPENSE'
                      ? '- '
                      : selectedDetailTx.type === 'INCOME'
                        ? '+ '
                        : ''}
                    {formatRupiah(selectedDetailTx.amount)}
                  </Text>

                  <View
                    style={[
                      styles.modalTypeBadge,
                      {
                        backgroundColor:
                          selectedDetailTx.type === 'EXPENSE'
                            ? '#FEE2E2'
                            : selectedDetailTx.type === 'INCOME'
                              ? '#D1FAE5'
                              : '#DBEAFE',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalTypeBadgeText,
                        {
                          color:
                            selectedDetailTx.type === 'EXPENSE'
                              ? '#B91C1C'
                              : selectedDetailTx.type === 'INCOME'
                                ? '#047857'
                                : '#1D4ED8',
                        },
                      ]}
                    >
                      {selectedDetailTx.type === 'EXPENSE'
                        ? 'Pengeluaran'
                        : selectedDetailTx.type === 'INCOME'
                          ? 'Pemasukan'
                          : 'Transfer Antar-Dompet'}
                    </Text>
                  </View>
                </View>

                {/* Details List Box */}
                <View style={styles.modalDetailsBox}>
                  {/* Category */}
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Kategori</Text>
                    <Text style={styles.modalDetailValue}>
                      {selectedDetailTx.type === 'TRANSFER'
                        ? 'Transfer Saldo'
                        : selectedDetailTx.category_name || 'Tanpa Kategori'}
                    </Text>
                  </View>

                  {/* Source Wallet */}
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>
                      {selectedDetailTx.type === 'TRANSFER' ? 'Dompet Sumber' : 'Dompet / Rekening'}
                    </Text>
                    <Text style={styles.modalDetailValue}>
                      {selectedDetailTx.wallet_name || '-'}
                    </Text>
                  </View>

                  {/* Target Wallet (if transfer) */}
                  {selectedDetailTx.type === 'TRANSFER' && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Dompet Tujuan</Text>
                      <Text style={styles.modalDetailValue}>
                        {selectedDetailTx.target_wallet_name || '-'}
                      </Text>
                    </View>
                  )}

                  {/* Date & Time */}
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Waktu Transaksi</Text>
                    <Text style={styles.modalDetailValue}>
                      {selectedDetailTx.trans_date}
                    </Text>
                  </View>

                  {/* Note */}
                  <View style={[styles.modalDetailRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.modalDetailLabel}>Catatan</Text>
                    <Text style={[styles.modalDetailValue, { flex: 1, textAlign: 'right' }]}>
                      {selectedDetailTx.note ? selectedDetailTx.note : '-'}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActionButtons}>
                  <TouchableOpacity
                    style={styles.modalDeleteButton}
                    onPress={() => {
                      const txToDelete = selectedDetailTx;
                      Alert.alert(
                        'Hapus Transaksi',
                        `Apakah Anda yakin ingin menghapus transaksi ini sebesar ${formatRupiah(txToDelete.amount)}? Saldo dompet akan dikembalikan secara otomatis.`,
                        [
                          { text: 'Batal', style: 'cancel' },
                          {
                            text: 'Hapus',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                setSelectedDetailTx(null);
                                await deleteTransactionAtomic(db, txToDelete.id);
                                await loadData();
                              } catch (err: any) {
                                Alert.alert('Gagal Menghapus', err?.message ?? 'Terjadi kesalahan.');
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    <Text style={styles.modalDeleteButtonText}>Hapus Transaksi</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setSelectedDetailTx(null)}
                  >
                    <Text style={styles.modalCloseButtonText}>Tutup</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  brandBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  monthBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  monthArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthCenterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  walletFilterContainer: {
    marginVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  noteText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#94A3B8',
    marginTop: 3,
  },
  actionCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  amountText: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeroSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  modalHeroIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalHeroAmount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  modalTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalDetailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  modalDetailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalActionButtons: {
    gap: 8,
  },
  modalDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 11,
  },
  modalDeleteButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  modalCloseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 10,
  },
  modalCloseButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

