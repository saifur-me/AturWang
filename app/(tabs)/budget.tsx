import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BudgetComparisonItem, CategoryGroup } from '../../src/types/finance';
import {
  getMonthlyBudgetEvaluation,
  upsertCategoryBudget,
  copyBudgetFromPreviousMonth,
} from '../../src/database/budgetRepo';
import {
  formatRupiah,
  getCurrentMonthPeriod,
  shiftMonthPeriod,
  formatMonthLabel,
} from '../../src/utils/formatters';

export default function BudgetScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const [monthPeriod, setMonthPeriod] = useState<string>(getCurrentMonthPeriod());
  const [budgetItems, setBudgetItems] = useState<BudgetComparisonItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Modal State for Editing Budget
  const [editingItem, setEditingItem] = useState<BudgetComparisonItem | null>(null);
  const [budgetInputText, setBudgetInputText] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getMonthlyBudgetEvaluation(db, monthPeriod);
      setBudgetItems(items);
    } catch (err) {
      console.error('Error fetching budget evaluation:', err);
    } finally {
      setLoading(false);
    }
  }, [db, monthPeriod]);

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

  const handleCopyFromPrevious = async () => {
    const prevMonth = shiftMonthPeriod(monthPeriod, -1);
    Alert.alert(
      'Salin Anggaran',
      `Salin seluruh alokasi anggaran dari bulan ${formatMonthLabel(prevMonth)} ke bulan ${formatMonthLabel(monthPeriod)}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Salin',
          onPress: async () => {
            try {
              const count = await copyBudgetFromPreviousMonth(db, prevMonth, monthPeriod);
              Alert.alert(
                'Sukses',
                count > 0
                  ? `Berhasil menyalin ${count} anggaran kategori.`
                  : `Tidak ada data anggaran pada bulan ${formatMonthLabel(prevMonth)}.`
              );
              await loadData();
            } catch (err: any) {
              Alert.alert('Gagal', err?.message ?? 'Terjadi kesalahan database.');
            }
          },
        },
      ]
    );
  };

  const handleOpenEditModal = (item: BudgetComparisonItem) => {
    setEditingItem(item);
    setBudgetInputText(item.planned_amount > 0 ? item.planned_amount.toString() : '');
  };

  const handleSaveBudget = async () => {
    if (!editingItem) return;

    const parsed = parseInt(budgetInputText.replace(/\D/g, ''), 10) || 0;
    try {
      await upsertCategoryBudget(db, editingItem.category_id, monthPeriod, parsed);
      setEditingItem(null);
      await loadData();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err?.message ?? 'Terjadi kesalahan.');
    }
  };

  // Group summary for 50/30/20 rule
  const groupTotals = useMemo(() => {
    const summary: Record<CategoryGroup, { planned: number; actual: number }> = {
      NEEDS: { planned: 0, actual: 0 },
      WANTS: { planned: 0, actual: 0 },
      SAVINGS: { planned: 0, actual: 0 },
    };

    budgetItems.forEach((b) => {
      const g = b.group_type || 'NEEDS';
      if (summary[g]) {
        summary[g].planned += b.planned_amount;
        summary[g].actual += b.actual_amount;
      }
    });

    return summary;
  }, [budgetItems]);

  const getStatusBadge = (item: BudgetComparisonItem) => {
    switch (item.status) {
      case 'OVERBUDGET':
        return {
          label: 'OVERBUDGET',
          bg: '#FEE2E2',
          text: '#EF4444',
          barColor: '#EF4444',
        };
      case 'WARNING':
        return {
          label: 'WASPADA (≥75%)',
          bg: '#FEF3C7',
          text: '#D97706',
          barColor: '#F59E0B',
        };
      case 'UNPLANNED':
        return {
          label: 'BELUM DI-BUDGET',
          bg: '#EEF2FF',
          text: '#4F46E5',
          barColor: '#6366F1',
        };
      case 'SAFE':
      default:
        return {
          label: 'AMAN',
          bg: '#ECFDF5',
          text: '#059669',
          barColor: '#10B981',
        };
    }
  };

  return (
    <View style={styles.screen}>
      {/* 1. Modern Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <View style={styles.headerTitleWrap}>
          <Text numberOfLines={1} style={styles.headerTitle}>Rencana vs Aktual</Text>
          <Text style={styles.headerSubtitle}>Evaluasi Anggaran</Text>
        </View>
        <View style={styles.brandBadge}>
          <Ionicons name="pie-chart-outline" size={14} color="#2563EB" />
          <Text style={styles.brandBadgeText}>Target Anggaran</Text>
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
      >
        {/* 2. Distribution Overview */}
        <View style={styles.distributionBox}>
          <Text style={styles.distributionTitle}>
            Ringkasan Alokasi Anggaran
          </Text>
          <View style={styles.distributionRow}>
            {/* Needs Card */}
            <View style={[styles.distCard, { borderColor: '#93C5FD' }]}>
              <Text numberOfLines={1} style={styles.distBadge}>KEBUTUHAN</Text>
              <Text numberOfLines={1} style={styles.distAmount}>
                {formatRupiah(groupTotals.NEEDS.planned)}
              </Text>
              <Text numberOfLines={1} style={styles.distActual}>
                Aktual: {formatRupiah(groupTotals.NEEDS.actual)}
              </Text>
            </View>

            {/* Wants Card */}
            <View style={[styles.distCard, { borderColor: '#FDBA74' }]}>
              <Text numberOfLines={1} style={[styles.distBadge, { color: '#C2410C' }]}>
                KEINGINAN
              </Text>
              <Text numberOfLines={1} style={styles.distAmount}>
                {formatRupiah(groupTotals.WANTS.planned)}
              </Text>
              <Text numberOfLines={1} style={styles.distActual}>
                Aktual: {formatRupiah(groupTotals.WANTS.actual)}
              </Text>
            </View>

            {/* Savings Card */}
            <View style={[styles.distCard, { borderColor: '#86EFAC' }]}>
              <Text numberOfLines={1} style={[styles.distBadge, { color: '#15803D' }]}>
                TABUNGAN
              </Text>
              <Text numberOfLines={1} style={styles.distAmount}>
                {formatRupiah(groupTotals.SAVINGS.planned)}
              </Text>
              <Text numberOfLines={1} style={styles.distActual}>
                Aktual: {formatRupiah(groupTotals.SAVINGS.actual)}
              </Text>
            </View>
          </View>
        </View>

        {/* 4. Category Budget vs Actual List */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderTitle}>Evaluasi per Kategori Pengeluaran</Text>
          <Text style={styles.listHeaderCount}>{budgetItems.length} Kategori</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 24 }} />
        ) : (
          budgetItems.map((item) => {
            const badge = getStatusBadge(item);
            const fillWidth = Math.min(100, item.usage_percentage);

            return (
              <View key={`budget-item-${item.category_id}`} style={styles.categoryCard}>
                {/* Header Row */}
                <View style={styles.catHeader}>
                  <View style={styles.catLeft}>
                    <View
                      style={[
                        styles.catIconCircle,
                        { backgroundColor: `${item.color}20` },
                      ]}
                    >
                      <Ionicons
                        name={(item.icon as any) || 'pricetag-outline'}
                        size={18}
                        color={item.color}
                      />
                    </View>
                    <View>
                      <Text style={styles.catName}>{item.category_name}</Text>
                      <Text style={styles.catGroup}>
                        Grup: {item.group_type === 'NEEDS' ? 'Kebutuhan' : item.group_type === 'WANTS' ? 'Keinginan' : 'Tabungan'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.catHeaderRight}>
                    <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.editIconBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => handleOpenEditModal(item)}
                      accessibilityLabel={`Ubah Anggaran ${item.category_name}`}
                    >
                      <Ionicons name="pencil" size={14} color="#2563EB" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Progress Bar & Percentage */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${fillWidth}%`,
                          backgroundColor: badge.barColor,
                        },
                      ]}
                    />
                  </View>
                  {item.planned_amount > 0 && (
                    <Text style={[styles.progressPercentText, { color: badge.barColor }]}>
                      {item.usage_percentage}%
                    </Text>
                  )}
                </View>

                {/* Clear 3-Column Financial Breakdown */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>Realisasi (Terpakai)</Text>
                    <Text numberOfLines={1} style={styles.metricActualValue}>
                      {formatRupiah(item.actual_amount)}
                    </Text>
                  </View>

                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>Target Rencana</Text>
                    <Text numberOfLines={1} style={styles.metricPlannedValue}>
                      {formatRupiah(item.planned_amount)}
                    </Text>
                  </View>

                  <View style={[styles.metricCol, { alignItems: 'flex-end' }]}>
                    <Text style={styles.metricLabel}>
                      {item.remaining_amount >= 0 ? 'Sisa Anggaran' : 'Kelebihan (Over)'}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.metricRemainingValue,
                        { color: item.remaining_amount >= 0 ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {item.remaining_amount >= 0
                        ? formatRupiah(item.remaining_amount)
                        : `-${formatRupiah(Math.abs(item.remaining_amount))}`}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Edit Budget Modal */}
      <Modal
        visible={!!editingItem}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Atur Anggaran Bulanan</Text>
            <Text style={styles.modalSubtitle}>
              Kategori: {editingItem?.category_name} ({formatMonthLabel(monthPeriod)})
            </Text>

            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              autoFocus
              placeholder="Contoh: 1500000"
              value={budgetInputText}
              onChangeText={setBudgetInputText}
            />

            <Text style={styles.modalPreviewText}>
              Nominal: {formatRupiah(parseInt(budgetInputText || '0', 10) || 0)}
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingItem(null)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveBudget}
              >
                <Text style={styles.modalSaveBtnText}>Simpan Anggaran</Text>
              </TouchableOpacity>
            </View>
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
    paddingBottom: 40,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 16,
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  distributionBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  distributionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  distributionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  distCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 8,
  },
  distBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1D4ED8',
    marginBottom: 4,
  },
  distAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  distActual: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  listHeaderCount: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  catGroup: {
    fontSize: 11,
    color: '#64748B',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  catHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  progressTrack: {
    flex: 1,
    height: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: '800',
    minWidth: 32,
    textAlign: 'right',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricCol: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 3,
  },
  metricActualValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  metricPlannedValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  metricRemainingValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 6,
  },
  modalPreviewText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSaveBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

