import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Wallet,
  TransactionItem,
  MonthlySummary,
  BudgetComparisonItem,
} from '../../src/types/finance';
import { getAllWallets, getTotalNetWorth } from '../../src/database/walletRepo';
import { getRecentTransactions, deleteTransactionAtomic } from '../../src/database/transactionRepo';
import {
  getMonthlySummaryMetrics,
  getMonthlyBudgetEvaluation,
} from '../../src/database/budgetRepo';
import {
  formatRupiah,
  getCurrentMonthPeriod,
  shiftMonthPeriod,
  formatMonthLabel,
} from '../../src/utils/formatters';

export default function DashboardScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const [monthPeriod, setMonthPeriod] = useState<string>(getCurrentMonthPeriod());
  const [netWorth, setNetWorth] = useState<number>(0);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionItem[]>([]);
  const [summary, setSummary] = useState<MonthlySummary>({
    totalIncome: 0,
    totalExpense: 0,
    totalPlannedBudget: 0,
    remainingBudget: 0,
    dailySafeToSpend: 0,
    remainingDaysInMonth: 0,
    overallBudgetPercentage: 0,
  });
  const [alertBudgets, setAlertBudgets] = useState<BudgetComparisonItem[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedDetailTx, setSelectedDetailTx] = useState<TransactionItem | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      const [
        totalWorth,
        allWallets,
        recentList,
        monthSummary,
        budgetList,
      ] = await Promise.all([
        getTotalNetWorth(db),
        getAllWallets(db),
        getRecentTransactions(db, 5),
        getMonthlySummaryMetrics(db, monthPeriod),
        getMonthlyBudgetEvaluation(db, monthPeriod),
      ]);

      setNetWorth(totalWorth);
      setWallets(allWallets);
      setRecentTransactions(recentList);
      setSummary(monthSummary);

      const criticalBudgets = budgetList.filter(
        (b) => b.status === 'OVERBUDGET' || b.status === 'WARNING' || b.status === 'UNPLANNED'
      ).slice(0, 3);
      setAlertBudgets(criticalBudgets);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  }, [db, monthPeriod]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handlePrevMonth = () => {
    setMonthPeriod((prev) => shiftMonthPeriod(prev, -1));
  };

  const handleNextMonth = () => {
    setMonthPeriod((prev) => shiftMonthPeriod(prev, 1));
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#EF4444';
    if (percentage >= 75) return '#F59E0B';
    return '#10B981';
  };

  return (
    <View style={styles.screen}>
      {/* 1. Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <View style={styles.headerTitleWrap}>
          <Text numberOfLines={1} style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Ringkasan Keuangan</Text>
        </View>
        <View style={styles.brandBadge}>
          <Ionicons name="wallet" size={14} color="#2563EB" />
          <Text style={styles.brandBadgeText}>AturWang</Text>
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

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 80 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563EB']} />
        }
      >
        {/* 2. Total Net Worth & Monthly Cashflow Card */}
        <View style={styles.netWorthCard}>
          <View style={styles.netWorthHeader}>
            <Text style={styles.netWorthLabel}>Total Saldo (Kekayaan Bersih)</Text>
            <Ionicons name="shield-checkmark" size={18} color="#60A5FA" />
          </View>
          <Text style={styles.netWorthValue}>{formatRupiah(netWorth)}</Text>

          <View style={styles.cashflowRow}>
            <View style={styles.cashflowItem}>
              <View style={[styles.cashflowIcon, { backgroundColor: '#065F46' }]}>
                <Ionicons name="arrow-down" size={14} color="#34D399" />
              </View>
              <View>
                <Text style={styles.cashflowLabel}>Pemasukan Bulan Ini</Text>
                <Text style={styles.cashflowIncomeText}>
                  +{formatRupiah(summary.totalIncome)}
                </Text>
              </View>
            </View>

            <View style={styles.cashflowItem}>
              <View style={[styles.cashflowIcon, { backgroundColor: '#7F1D1D' }]}>
                <Ionicons name="arrow-up" size={14} color="#F87171" />
              </View>
              <View>
                <Text style={styles.cashflowLabel}>Pengeluaran Bulan Ini</Text>
                <Text style={styles.cashflowExpenseText}>
                  -{formatRupiah(summary.totalExpense)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Executive Plan vs Actual Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Ionicons name="pie-chart-outline" size={20} color="#2563EB" />
              <Text style={styles.cardTitle}>Evaluasi Rencana vs Realisasi</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/budget')}>
              <Text style={styles.cardActionText}>Detail</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(100, summary.overallBudgetPercentage)}%`,
                  backgroundColor: getProgressColor(summary.overallBudgetPercentage),
                },
              ]}
            />
          </View>

          <View style={styles.budgetNumbersRow}>
            <View>
              <Text style={styles.budgetNumberLabel}>Rencana Anggaran</Text>
              <Text style={styles.budgetNumberValue}>
                {formatRupiah(summary.totalPlannedBudget)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.budgetNumberLabel}>
                {summary.remainingBudget >= 0 ? 'Sisa Anggaran' : 'Defisit Anggaran'}
              </Text>
              <Text
                style={[
                  styles.budgetNumberValue,
                  { color: summary.remainingBudget >= 0 ? '#10B981' : '#EF4444' },
                ]}
              >
                {formatRupiah(Math.abs(summary.remainingBudget))}
              </Text>
            </View>
          </View>

          {/* Safe-to-Spend Daily Banner */}
          <View style={styles.safeToSpendBanner}>
            <Ionicons name="sparkles" size={18} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.safeToSpendTitle}>
                Jatah Aman Pengeluaran Harian:
              </Text>
              <Text style={styles.safeToSpendHighlight}>
                {formatRupiah(summary.dailySafeToSpend)} / hari
                {summary.remainingDaysInMonth > 0
                  ? ` (Sisa ${summary.remainingDaysInMonth} hari)`
                  : ' (Bulan telah berakhir)'}
              </Text>
            </View>
          </View>
        </View>

        {/* 4. Horizontal Wallets List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Dompet & Rekening</Text>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Text style={styles.sectionActionText}>Kelola</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.walletsScroll}
        >
          {wallets.map((wallet) => (
            <View key={`wallet-${wallet.id}`} style={styles.walletCard}>
              <View style={[styles.walletIconCircle, { backgroundColor: `${wallet.color}20` }]}>
                <Ionicons
                  name={(wallet.icon as any) || 'wallet-outline'}
                  size={20}
                  color={wallet.color}
                />
              </View>
              <Text numberOfLines={1} style={styles.walletName}>
                {wallet.name}
              </Text>
              <Text style={styles.walletBalance}>
                {formatRupiah(wallet.current_balance)}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* 5. Critical Budget Alerts */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Peringatan Anggaran</Text>
          <Text style={styles.sectionSubtitle}>Perlu Perhatian</Text>
        </View>

        {alertBudgets.length === 0 ? (
          <View style={styles.allSafeBox}>
            <Ionicons name="checkmark-circle" size={22} color="#10B981" />
            <Text style={styles.allSafeText}>
              Seluruh pos pengeluaran bulan ini masih aman terkendali!
            </Text>
          </View>
        ) : (
          alertBudgets.map((item) => {
            const isOver = item.status === 'OVERBUDGET';
            const isUnplanned = item.status === 'UNPLANNED';
            return (
              <View
                key={`alert-${item.category_id}`}
                style={[
                  styles.alertCard,
                  isOver && styles.alertCardOver,
                  isUnplanned && styles.alertCardUnplanned,
                ]}
              >
                <View style={styles.alertIconCol}>
                  <Ionicons
                    name={isOver ? 'alert-circle' : isUnplanned ? 'help-circle' : 'warning'}
                    size={24}
                    color={isOver ? '#EF4444' : isUnplanned ? '#6366F1' : '#F59E0B'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.alertHeaderRow}>
                    <Text style={styles.alertCategoryName}>{item.category_name}</Text>
                    <Text
                      style={[
                        styles.alertBadgeText,
                        isOver && { color: '#EF4444' },
                        isUnplanned && { color: '#6366F1' },
                      ]}
                    >
                      {isOver
                        ? 'OVERBUDGET'
                        : isUnplanned
                          ? 'BELUM DI-BUDGET'
                          : 'WASPADA (≥75%)'}
                    </Text>
                  </View>
                  <Text style={styles.alertDetailText}>
                    {isUnplanned
                      ? `Terpakai ${formatRupiah(item.actual_amount)} tanpa anggaran.`
                      : `Terpakai ${formatRupiah(item.actual_amount)} dari rencana ${formatRupiah(item.planned_amount)} (${item.usage_percentage}%).`}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        {/* 6. Recent 5 Transactions */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Transaksi Terakhir</Text>
          <TouchableOpacity onPress={() => router.push('/transactions')}>
            <Text style={styles.sectionActionText}>Lihat Semua</Text>
          </TouchableOpacity>
        </View>

        {recentTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
            <Text style={styles.emptyText}>Belum ada transaksi tercatat.</Text>
          </View>
        ) : (
          recentTransactions.map((tx) => {
            const isExpense = tx.type === 'EXPENSE';
            const isIncome = tx.type === 'INCOME';
            const isTransfer = tx.type === 'TRANSFER';

            return (
              <TouchableOpacity
                key={`tx-${tx.id}`}
                activeOpacity={0.7}
                style={styles.txRow}
                onPress={() => setSelectedDetailTx(tx)}
              >
                <View
                  style={[
                    styles.txIconWrap,
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
                        : (tx.category_icon as any) || (isExpense ? 'cart-outline' : 'cash-outline')
                    }
                    size={20}
                    color={
                      isExpense
                        ? '#EF4444'
                        : isIncome
                          ? '#10B981'
                          : '#2563EB'
                    }
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.txTitle}>
                    {isTransfer
                      ? `Transfer: ${tx.wallet_name} → ${tx.target_wallet_name}`
                      : tx.category_name || 'Tanpa Kategori'}
                  </Text>
                  <Text style={styles.txMeta}>
                    {tx.wallet_name} • {tx.trans_date.slice(0, 16)}
                  </Text>
                  {tx.note ? <Text numberOfLines={1} style={styles.txNote}>"{tx.note}"</Text> : null}
                </View>

                <Text
                  style={[
                    styles.txAmount,
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
                  {formatRupiah(tx.amount)}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#CBD5E1" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Detail Transaksi Modal */}
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
                                await loadDashboardData();
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
  scrollContent: {
    padding: 16,
  },
  netWorthCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  netWorthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  netWorthLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  netWorthValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 18,
  },
  cashflowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 14,
    gap: 12,
  },
  cashflowItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cashflowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashflowLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  cashflowIncomeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399',
  },
  cashflowExpenseText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F87171',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  budgetNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  budgetNumberLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 2,
  },
  budgetNumberValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  safeToSpendBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  safeToSpendTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  safeToSpendHighlight: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350F',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  walletsScroll: {
    gap: 10,
    paddingBottom: 8,
    marginBottom: 8,
  },
  walletCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    minWidth: 140,
  },
  walletIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  walletName: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  walletBalance: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  allSafeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  allSafeText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  alertCardOver: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  alertCardUnplanned: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  alertIconCol: {
    justifyContent: 'center',
  },
  alertHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  alertCategoryName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  alertDetailText: {
    fontSize: 12,
    color: '#475569',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  txMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  txNote: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#94A3B8',
    marginTop: 2,
  },
  txAmount: {
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
});

