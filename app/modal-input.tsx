import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TransactionType, Wallet, Category } from '../src/types/finance';
import { getAllWallets, getCategories } from '../src/database/walletRepo';
import { addTransactionAtomic } from '../src/database/transactionRepo';
import { formatRupiah } from '../src/utils/formatters';

const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDO_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];
const INDO_MONTHS_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function getSqlDateTime(d: Date): string {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

function isYesterday(d: Date): boolean {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return isSameDay(d, y);
}

function formatDisplayDate(d: Date): string {
  const dayName = INDO_DAYS[d.getDay()];
  return `${dayName}, ${d.getDate()} ${INDO_MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ModalInputScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<any>(null);

  const [transType, setTransType] = useState<TransactionType>('EXPENSE');
  const [amountText, setAmountText] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);
  const [targetWalletId, setTargetWalletId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [wList, cList] = await Promise.all([
          getAllWallets(db),
          getCategories(db),
        ]);
        setWallets(wList);
        setCategories(cList);

        if (wList.length > 0) {
          setSelectedWalletId(wList[0].id);
          if (wList.length > 1) {
            setTargetWalletId(wList[1].id);
          }
        }
      } catch (err) {
        console.error('Error loading wallets & categories:', err);
      }
    }
    loadData();
  }, [db]);

  const filteredCategories = useMemo(() => {
    if (transType === 'TRANSFER') return [];
    return categories.filter((c) => c.type === transType);
  }, [categories, transType]);

  // Chunk categories into 3 rows horizontally
  const categoryColumns = useMemo(() => {
    const cols: Category[][] = [];
    const itemsPerCol = 3;
    for (let i = 0; i < filteredCategories.length; i += itemsPerCol) {
      cols.push(filteredCategories.slice(i, i + itemsPerCol));
    }
    return cols;
  }, [filteredCategories]);

  useEffect(() => {
    if (filteredCategories.length > 0) {
      setSelectedCategoryId(filteredCategories[0].id);
    } else {
      setSelectedCategoryId(null);
    }
  }, [transType, filteredCategories]);

  const parsedAmount = useMemo(() => {
    const clean = amountText.replace(/\D/g, '');
    return parseInt(clean, 10) || 0;
  }, [amountText]);

  const handleAddQuickAmount = (val: number) => {
    const nextVal = parsedAmount + val;
    setAmountText(nextVal.toString());
  };

  const handleSaveTransaction = async () => {
    if (parsedAmount <= 0) {
      Alert.alert('Perhatian', 'Silakan masukkan nominal transaksi yang valid.');
      return;
    }

    if (!selectedWalletId) {
      Alert.alert('Perhatian', 'Silakan pilih dompet sumber transaksi.');
      return;
    }

    if (transType === 'TRANSFER') {
      if (!targetWalletId) {
        Alert.alert('Perhatian', 'Silakan pilih dompet tujuan transfer.');
        return;
      }
      if (selectedWalletId === targetWalletId) {
        Alert.alert('Perhatian', 'Dompet asal dan dompet tujuan tidak boleh sama.');
        return;
      }
    } else {
      if (!selectedCategoryId) {
        Alert.alert('Perhatian', 'Silakan pilih kategori transaksi.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await addTransactionAtomic(db, {
        wallet_id: selectedWalletId,
        target_wallet_id: transType === 'TRANSFER' ? targetWalletId : null,
        category_id: transType !== 'TRANSFER' ? selectedCategoryId : null,
        type: transType,
        amount: parsedAmount,
        trans_date: getSqlDateTime(selectedDate),
        note: note.trim(),
      });

      router.back();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err?.message ?? 'Terjadi kesalahan pada database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeColor = () => {
    switch (transType) {
      case 'EXPENSE':
        return '#EF4444';
      case 'INCOME':
        return '#10B981';
      case 'TRANSFER':
        return '#2563EB';
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        ref={scrollViewRef}
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 320 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Transaction Type Segmented Bar */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.segmentTab,
              transType === 'EXPENSE' && { backgroundColor: '#EF4444' },
            ]}
            onPress={() => setTransType('EXPENSE')}
          >
            <Ionicons
              name="arrow-up-circle-outline"
              size={16}
              color={transType === 'EXPENSE' ? '#FFFFFF' : '#64748B'}
            />
            <Text
              style={[
                styles.segmentText,
                transType === 'EXPENSE' && styles.segmentTextActive,
              ]}
            >
              Pengeluaran
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.segmentTab,
              transType === 'INCOME' && { backgroundColor: '#10B981' },
            ]}
            onPress={() => setTransType('INCOME')}
          >
            <Ionicons
              name="arrow-down-circle-outline"
              size={16}
              color={transType === 'INCOME' ? '#FFFFFF' : '#64748B'}
            />
            <Text
              style={[
                styles.segmentText,
                transType === 'INCOME' && styles.segmentTextActive,
              ]}
            >
              Pemasukan
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.segmentTab,
              transType === 'TRANSFER' && { backgroundColor: '#2563EB' },
            ]}
            onPress={() => setTransType('TRANSFER')}
          >
            <Ionicons
              name="swap-horizontal-outline"
              size={16}
              color={transType === 'TRANSFER' ? '#FFFFFF' : '#64748B'}
            />
            <Text
              style={[
                styles.segmentText,
                transType === 'TRANSFER' && styles.segmentTextActive,
              ]}
            >
              Transfer
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. Amount Input Card with Default Phone Keyboard */}
        <View style={styles.amountCard}>
          <Text style={styles.amountCardLabel}>Nominal Transaksi (Rp)</Text>
          <View style={styles.amountInputRow}>
            <Text style={[styles.currencyPrefix, { color: getTypeColor() }]}>Rp</Text>
            <TextInput
              style={[styles.amountInput, { color: getTypeColor() }]}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#CBD5E1"
              value={amountText ? parsedAmount.toLocaleString('id-ID') : ''}
              onChangeText={(val) => {
                const digits = val.replace(/\D/g, '');
                setAmountText(digits);
              }}
              autoFocus
            />
            {amountText.length > 0 && (
              <TouchableOpacity
                onPress={() => setAmountText('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.clearBtn}
              >
                <Ionicons name="close-circle" size={20} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick-Add Amount Pills */}
          <View style={styles.quickAddRow}>
            <TouchableOpacity
              style={styles.quickAddPill}
              onPress={() => handleAddQuickAmount(10000)}
            >
              <Text style={styles.quickAddPillText}>+10rb</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAddPill}
              onPress={() => handleAddQuickAmount(50000)}
            >
              <Text style={styles.quickAddPillText}>+50rb</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAddPill}
              onPress={() => handleAddQuickAmount(100000)}
            >
              <Text style={styles.quickAddPillText}>+100rb</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAddPill}
              onPress={() => handleAddQuickAmount(500000)}
            >
              <Text style={styles.quickAddPillText}>+500rb</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Transaction Date Input with Native DatePicker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tanggal Transaksi:</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.dateInputField}
            onPress={() => setShowDatePicker(true)}
          >
            <View style={styles.dateInputLeft}>
              <View style={styles.dateIconCircle}>
                <Ionicons name="calendar-outline" size={18} color="#2563EB" />
              </View>
              <View style={styles.dateTextGroup}>
                <Text style={styles.dateDisplayLabel}>
                  {formatDisplayDate(selectedDate)}
                </Text>
                <Text style={styles.dateSubLabel}>
                  {isToday(selectedDate)
                    ? 'Hari ini'
                    : isYesterday(selectedDate)
                    ? 'Kemarin'
                    : 'Ketuk untuk pilih dari kalender'}
                </Text>
              </View>
            </View>

            <View style={styles.dateChangeBtn}>
              <Text style={styles.dateChangeText}>Pilih</Text>
              <Ionicons name="chevron-forward" size={14} color="#2563EB" />
            </View>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onValueChange={(_event: DateTimePickerChangeEvent, date: Date) => {
                setShowDatePicker(false);
                if (date) {
                  setSelectedDate(date);
                }
              }}
              onDismiss={() => {
                setShowDatePicker(false);
              }}
            />
          )}
        </View>

        {/* 4. Source Wallet Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {transType === 'TRANSFER' ? 'Dompet Sumber (Dari):' : 'Pilih Dompet:'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {wallets.map((w) => {
              const isSelected = selectedWalletId === w.id;
              return (
                <TouchableOpacity
                  key={`wallet-${w.id}`}
                  style={[
                    styles.walletChip,
                    isSelected && { backgroundColor: w.color, borderColor: w.color },
                  ]}
                  onPress={() => setSelectedWalletId(w.id)}
                >
                  <Ionicons
                    name={(w.icon as any) || 'wallet-outline'}
                    size={15}
                    color={isSelected ? '#FFFFFF' : '#334155'}
                  />
                  <Text
                    style={[
                      styles.walletChipText,
                      isSelected && styles.walletChipTextSelected,
                    ]}
                  >
                    {w.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 5. Target Wallet Selection (Transfer Only) */}
        {transType === 'TRANSFER' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dompet Tujuan (Ke):</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {wallets.map((w) => {
                const isSelected = targetWalletId === w.id;
                const isSameAsSource = selectedWalletId === w.id;
                return (
                  <TouchableOpacity
                    key={`target-wallet-${w.id}`}
                    disabled={isSameAsSource}
                    style={[
                      styles.walletChip,
                      isSelected && { backgroundColor: w.color, borderColor: w.color },
                      isSameAsSource && styles.walletChipDisabled,
                    ]}
                    onPress={() => setTargetWalletId(w.id)}
                  >
                    <Ionicons
                      name={(w.icon as any) || 'wallet-outline'}
                      size={15}
                      color={isSelected ? '#FFFFFF' : isSameAsSource ? '#94A3B8' : '#334155'}
                    />
                    <Text
                      style={[
                        styles.walletChipText,
                        isSelected && styles.walletChipTextSelected,
                        isSameAsSource && styles.walletChipTextDisabled,
                      ]}
                    >
                      {w.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 6. Horizontal Category Selection (3 Rows, scrollable to side) */}
        {transType !== 'TRANSFER' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pilih Kategori:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryHorizontalContainer}
            >
              {categoryColumns.map((col, colIdx) => (
                <View key={`cat-col-${colIdx}`} style={styles.categoryColumn}>
                  {col.map((cat) => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={`cat-${cat.id}`}
                        style={[
                          styles.categoryChip,
                          isSelected && {
                            backgroundColor: `${cat.color}15`,
                            borderColor: cat.color,
                          },
                        ]}
                        onPress={() => setSelectedCategoryId(cat.id)}
                      >
                        <View
                          style={[
                            styles.catIconWrapSmall,
                            { backgroundColor: isSelected ? cat.color : `${cat.color}20` },
                          ]}
                        >
                          <Ionicons
                            name={(cat.icon as any) || 'pricetag-outline'}
                            size={13}
                            color={isSelected ? '#FFFFFF' : cat.color}
                          />
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.categoryChipText,
                            isSelected && { color: cat.color, fontWeight: '700' },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 7. Note Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catatan / Keterangan (Opsional):</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Contoh: Makan siang warteg, beli bensin..."
            placeholderTextColor="#94A3B8"
            value={note}
            onChangeText={setNote}
            maxLength={100}
            onFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 250);
            }}
          />
        </View>

        {/* 8. Save Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={isSubmitting}
          style={[styles.submitButton, { backgroundColor: getTypeColor() }]}
          onPress={handleSaveTransaction}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Menyimpan...' : 'SIMPAN TRANSAKSI'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 7,
    gap: 5,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  amountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  amountCardLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 10,
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '800',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAddPill: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickAddPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dateInputField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInputLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dateIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTextGroup: {
    flex: 1,
  },
  dateDisplayLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateSubLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  dateChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  dateChangeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  walletChipDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  walletChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  walletChipTextSelected: {
    color: '#FFFFFF',
  },
  walletChipTextDisabled: {
    color: '#94A3B8',
  },
  categoryHorizontalContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  categoryColumn: {
    flexDirection: 'column',
    gap: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  catIconWrapSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  noteInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  submitButton: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
