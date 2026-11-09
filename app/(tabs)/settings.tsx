import React, { useState, useCallback, ComponentProps } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Wallet, Category, CategoryGroup } from '../../src/types/finance';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
import {
  getAllWallets,
  createWallet,
  updateWalletBalanceManual,
  deleteWallet,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../src/database/walletRepo';
import {
  formatRupiah,
  getCurrentMonthPeriod,
  exportTransactionsToCSV,
  backupDatabaseFile,
  restoreDatabaseFile,
} from '../../src/utils/formatters';

const PRESET_COLORS = [
  '#2563EB',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#0F172A',
];

export default function SettingsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  // Modal: Add Wallet
  const [showAddWalletModal, setShowAddWalletModal] = useState<boolean>(false);
  const [walletName, setWalletName] = useState<string>('');
  const [walletBalance, setWalletBalance] = useState<string>('');
  const [selectedWalletColor, setSelectedWalletColor] = useState<string>(PRESET_COLORS[0]);

  // Modal: Adjust Balance
  const [adjustingWallet, setAdjustingWallet] = useState<Wallet | null>(null);
  const [adjustBalanceText, setAdjustBalanceText] = useState<string>('');

  // Modal: Add Category
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [categoryName, setCategoryName] = useState<string>('');
  const [categoryType, setCategoryType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroup>('NEEDS');
  const [selectedCategoryColor, setSelectedCategoryColor] = useState<string>(PRESET_COLORS[1]);

  // Modal: Edit Category
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState<string>('');
  const [editCategoryGroup, setEditCategoryGroup] = useState<CategoryGroup>('NEEDS');
  const [editCategoryColor, setEditCategoryColor] = useState<string>(PRESET_COLORS[1]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wList, cList] = await Promise.all([
        getAllWallets(db),
        getCategories(db),
      ]);
      setWallets(wList);
      setCategories(cList);
    } catch (err) {
      console.error('Error fetching settings data:', err);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // 1. Wallets Action Handlers
  const handleCreateWallet = async () => {
    if (!walletName.trim()) {
      Alert.alert('Perhatian', 'Nama dompet wajib diisi.');
      return;
    }
    const balanceNum = parseInt(walletBalance.replace(/\D/g, ''), 10) || 0;
    try {
      await createWallet(
        db,
        walletName.trim(),
        balanceNum,
        selectedWalletColor,
        'wallet-outline'
      );
      setWalletName('');
      setWalletBalance('');
      setShowAddWalletModal(false);
      await loadData();
    } catch (err: any) {
      Alert.alert('Gagal Membuat Dompet', err?.message ?? 'Terjadi kesalahan.');
    }
  };

  const handleOpenAdjustBalance = (w: Wallet) => {
    setAdjustingWallet(w);
    setAdjustBalanceText(w.current_balance.toString());
  };

  const handleSaveAdjustBalance = async () => {
    if (!adjustingWallet) return;
    const newBal = parseInt(adjustBalanceText.replace(/\D/g, ''), 10) || 0;
    try {
      await updateWalletBalanceManual(db, adjustingWallet.id, newBal);
      setAdjustingWallet(null);
      await loadData();
    } catch (err: any) {
      Alert.alert('Gagal Mengubah Saldo', err?.message ?? 'Terjadi kesalahan.');
    }
  };

  const handleDeleteWallet = (w: Wallet) => {
    if (wallets.length <= 1) {
      Alert.alert('Perhatian', 'Aplikasi membutuhkan minimal satu dompet aktif.');
      return;
    }
    Alert.alert(
      'Hapus Dompet',
      `Yakin ingin menghapus dompet "${w.name}"? Seluruh transaksi terkait akan ikut terhapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWallet(db, w.id);
              await loadData();
            } catch (err: any) {
              Alert.alert('Gagal Menghapus', err?.message ?? 'Terjadi kesalahan.');
            }
          },
        },
      ]
    );
  };

  // 2. Categories Action Handlers
  const handleCreateCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Perhatian', 'Nama kategori wajib diisi.');
      return;
    }
    try {
      await createCategory(
        db,
        categoryName.trim(),
        categoryType,
        categoryGroup,
        selectedCategoryColor,
        categoryType === 'INCOME' ? 'trending-up-outline' : 'cart-outline'
      );
      setCategoryName('');
      setShowAddCategoryModal(false);
      await loadData();
    } catch (err: any) {
      Alert.alert('Gagal Menambah Kategori', err?.message ?? 'Terjadi kesalahan.');
    }
  };

  const handleOpenEditCategory = (c: Category) => {
    setEditingCategory(c);
    setEditCategoryName(c.name);
    setEditCategoryGroup(c.group_type || 'NEEDS');
    setEditCategoryColor(c.color || PRESET_COLORS[1]);
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategory) return;
    if (!editCategoryName.trim()) {
      Alert.alert('Perhatian', 'Nama kategori wajib diisi.');
      return;
    }
    try {
      await updateCategory(
        db,
        editingCategory.id,
        editCategoryName.trim(),
        editCategoryGroup,
        editCategoryColor,
        editingCategory.icon
      );
      setEditingCategory(null);
      await loadData();
    } catch (err: any) {
      Alert.alert('Gagal Mengubah Kategori', err?.message ?? 'Terjadi kesalahan.');
    }
  };

  const handleDeleteCategory = (c: Category) => {
    Alert.alert(
      'Hapus Kategori',
      `Apakah Anda yakin ingin menghapus kategori "${c.name}"? Transaksi yang sudah tercatat akan tetap ada namun status kategorinya menjadi tanpa kategori.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(db, c.id);
              await loadData();
            } catch (err: any) {
              Alert.alert('Gagal Menghapus Kategori', err?.message ?? 'Terjadi kesalahan.');
            }
          },
        },
      ]
    );
  };

  // 3. Backup / Export / Restore Handlers
  const handleExportCSV = async () => {
    try {
      const currentMonth = getCurrentMonthPeriod();
      await exportTransactionsToCSV(db, currentMonth);
    } catch (err: any) {
      Alert.alert('Gagal Ekspor CSV', err?.message ?? 'Terjadi kesalahan.');
    }
  };

  const handleBackupDatabase = async () => {
    try {
      await backupDatabaseFile(db);
    } catch (err: any) {
      Alert.alert('Gagal Backup Database', err?.message ?? 'Terjadi kesalahan.');
    }
  };

  const handleRestoreDatabase = async () => {
    Alert.alert(
      'Restore Database',
      'Memulihkan database akan menimpa seluruh data keuangan lokal saat ini dengan file backup yang dipilih. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Pilih File .db',
          onPress: async () => {
            try {
              const success = await restoreDatabaseFile(db);
              if (success) {
                Alert.alert(
                  'Restore Selesai',
                  'Database berhasil dipulihkan. Memuat ulang data...',
                  [{ text: 'OK', onPress: () => loadData() }]
                );
              }
            } catch (err: any) {
              Alert.alert('Gagal Restore', err?.message ?? 'File database tidak valid.');
            }
          },
        },
      ]
    );
  };

  const filteredCategories = categories.filter((c) => c.type === activeCategoryTab);

  return (
    <View style={styles.screen}>
      {/* Modern Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
        <View style={styles.headerTitleWrap}>
          <Text numberOfLines={1} style={styles.headerTitle}>Pengaturan</Text>
          <Text style={styles.headerSubtitle}>Kelola Dompet, Kategori & Data</Text>
        </View>
        <View style={styles.brandBadge}>
          <Ionicons name="settings-outline" size={14} color="#2563EB" />
          <Text style={styles.brandBadgeText}>Konfigurasi</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 80 },
        ]}
      >
        {/* Section 1: Wallets Management */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Daftar Dompet / Rekening</Text>
          <TouchableOpacity
            style={styles.addSmallBtn}
            onPress={() => setShowAddWalletModal(true)}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addSmallBtnText}>Tambah</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#2563EB" />
        ) : (
          wallets.map((w) => (
            <View key={`wallet-item-${w.id}`} style={styles.walletItemCard}>
              <View style={[styles.walletIconCircle, { backgroundColor: `${w.color}20` }]}>
                <Ionicons
                  name={(w.icon as IoniconName) || 'wallet-outline'}
                  size={20}
                  color={w.color}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.walletItemName}>{w.name}</Text>
                <Text style={styles.walletItemBalance}>
                  {formatRupiah(w.current_balance)}
                </Text>
              </View>

              <View style={styles.walletItemActions}>
                <TouchableOpacity
                  style={styles.walletActionBtn}
                  onPress={() => handleOpenAdjustBalance(w)}
                >
                  <Ionicons name="create-outline" size={18} color="#2563EB" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.walletActionBtn}
                  onPress={() => handleDeleteWallet(w)}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Section 2: Categories Management */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Kelola Kategori</Text>
          <TouchableOpacity
            style={styles.addSmallBtn}
            onPress={() => setShowAddCategoryModal(true)}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addSmallBtnText}>Tambah</Text>
          </TouchableOpacity>
        </View>

        {/* Category Tabs */}
        <View style={styles.catTabRow}>
          <TouchableOpacity
            style={[
              styles.catTabBtn,
              activeCategoryTab === 'EXPENSE' && styles.catTabBtnActive,
            ]}
            onPress={() => setActiveCategoryTab('EXPENSE')}
          >
            <Text
              style={[
                styles.catTabText,
                activeCategoryTab === 'EXPENSE' && styles.catTabTextActive,
              ]}
            >
              Pengeluaran ({categories.filter((c) => c.type === 'EXPENSE').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.catTabBtn,
              activeCategoryTab === 'INCOME' && styles.catTabBtnActive,
            ]}
            onPress={() => setActiveCategoryTab('INCOME')}
          >
            <Text
              style={[
                styles.catTabText,
                activeCategoryTab === 'INCOME' && styles.catTabTextActive,
              ]}
            >
              Pemasukan ({categories.filter((c) => c.type === 'INCOME').length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 8 }}>
          {filteredCategories.map((c) => (
            <View key={`category-item-${c.id}`} style={styles.walletItemCard}>
              <View style={[styles.walletIconCircle, { backgroundColor: `${c.color}20` }]}>
                <Ionicons
                  name={
                    (c.icon as IoniconName) ||
                    (c.type === 'INCOME' ? 'trending-up-outline' : 'cart-outline')
                  }
                  size={20}
                  color={c.color}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.walletItemName}>{c.name}</Text>
                <Text style={styles.categoryItemGroup}>
                  {c.type === 'EXPENSE'
                    ? c.group_type === 'NEEDS'
                      ? 'Kebutuhan (Needs)'
                      : c.group_type === 'WANTS'
                        ? 'Keinginan (Wants)'
                        : 'Tabungan (Savings)'
                    : 'Pemasukan (Income)'}
                </Text>
              </View>

              <View style={styles.walletItemActions}>
                <TouchableOpacity
                  style={styles.walletActionBtn}
                  onPress={() => handleOpenEditCategory(c)}
                  accessibilityLabel="Ubah Kategori"
                >
                  <Ionicons name="create-outline" size={18} color="#2563EB" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.walletActionBtn}
                  onPress={() => handleDeleteCategory(c)}
                  accessibilityLabel="Hapus Kategori"
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Section 3: Data Management & Offline Backup */}
        <Text style={[styles.sectionTitle, { marginTop: 28, marginBottom: 12 }]}>
          Manajemen Data & Backup Mandiri
        </Text>

        <View style={styles.backupCard}>
          {/* CSV Export */}
          <TouchableOpacity
            style={styles.backupActionRow}
            activeOpacity={0.7}
            onPress={handleExportCSV}
          >
            <View style={[styles.backupIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="document-text-outline" size={22} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.backupActionTitle}>
                Ekspor Laporan Bulan Ini ke CSV (Excel)
              </Text>
              <Text style={styles.backupActionDesc}>
                Simpan atau bagikan riwayat transaksi dalam format CSV spreadsheet.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Backup Database */}
          <TouchableOpacity
            style={styles.backupActionRow}
            activeOpacity={0.7}
            onPress={handleBackupDatabase}
          >
            <View style={[styles.backupIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="cloud-upload-outline" size={22} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.backupActionTitle}>
                Backup Full Database (.db)
              </Text>
              <Text style={styles.backupActionDesc}>
                Simpan salinan database lokal SQLite ke Drive, WhatsApp, atau memori HP.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Restore Database */}
          <TouchableOpacity
            style={styles.backupActionRow}
            activeOpacity={0.7}
            onPress={handleRestoreDatabase}
          >
            <View style={[styles.backupIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="cloud-download-outline" size={22} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.backupActionTitle}>
                Restore Database (.db)
              </Text>
              <Text style={styles.backupActionDesc}>
                Pulihkan file backup SQLite cadangan ke perangkat ini.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Section 4: Privacy & Storage Info */}
        <View style={styles.storageInfoBox}>
          <Ionicons name="shield-checkmark" size={20} color="#10B981" />
          <View style={{ flex: 1 }}>
            <Text style={styles.storageInfoTitle}>100% Offline & Aman</Text>
            <Text style={styles.storageInfoText}>
              Aplikasi ini beroperasi sepenuhnya secara lokal menggunakan SQLite dengan mode WAL (Write-Ahead Logging). Seluruh data transaksi dan keuangan Anda tersimpan privat di dalam memori perangkat Anda sendiri.
            </Text>
          </View>
        </View>

        {/* Section 5: Tentang Aplikasi Button */}
        <TouchableOpacity
          style={styles.aboutButton}
          activeOpacity={0.7}
          onPress={() => router.push('/about')}
        >
          <View style={styles.aboutButtonLeft}>
            <View style={styles.aboutIconWrap}>
              <Ionicons name="information-circle-outline" size={22} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.aboutButtonTitle}>Tentang Aplikasi</Text>
              <Text style={styles.aboutButtonDesc}>Informasi versi, privasi, & pengembang</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </TouchableOpacity>

        {/* Footer App Version Info */}
        <View style={styles.appFooter}>
          <Text style={styles.appFooterText}>AturWang v1.0.0 • Offline Edition</Text>
        </View>
      </ScrollView>

      {/* Modal: Tambah Dompet */}
      <Modal
        visible={showAddWalletModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddWalletModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tambah Dompet Baru</Text>

            <Text style={styles.inputLabel}>Nama Dompet / Rekening:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Contoh: BCA Tabungan, Dompet Kulit..."
              value={walletName}
              onChangeText={setWalletName}
            />

            <Text style={styles.inputLabel}>Saldo Awal (Rp):</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              placeholder="0"
              value={walletBalance}
              onChangeText={setWalletBalance}
            />

            <Text style={styles.inputLabel}>Pilih Warna Aksen:</Text>
            <View style={styles.colorPaletteRow}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={`wallet-color-${c}`}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    selectedWalletColor === c && styles.colorDotSelected,
                  ]}
                  onPress={() => setSelectedWalletColor(c)}
                />
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddWalletModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleCreateWallet}
              >
                <Text style={styles.modalSaveBtnText}>Tambah Dompet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Sesuaikan Saldo Manual */}
      <Modal
        visible={!!adjustingWallet}
        transparent
        animationType="fade"
        onRequestClose={() => setAdjustingWallet(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sesuaikan Saldo Manual</Text>
            <Text style={styles.modalSubtitle}>
              Dompet: {adjustingWallet?.name}
            </Text>

            <Text style={styles.inputLabel}>Saldo Baru Sebenarnya (Rp):</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              autoFocus
              value={adjustBalanceText}
              onChangeText={setAdjustBalanceText}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAdjustingWallet(null)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveAdjustBalance}
              >
                <Text style={styles.modalSaveBtnText}>Simpan Saldo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Tambah Kategori */}
      <Modal
        visible={showAddCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tambah Kategori Baru</Text>

            <Text style={styles.inputLabel}>Nama Kategori:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Contoh: Skincare, Gym, Freelance..."
              value={categoryName}
              onChangeText={setCategoryName}
            />

            <Text style={styles.inputLabel}>Tipe Kategori:</Text>
            <View style={styles.modalSegmentRow}>
              <TouchableOpacity
                style={[
                  styles.modalSegmentBtn,
                  categoryType === 'EXPENSE' && styles.modalSegmentBtnExpense,
                ]}
                onPress={() => setCategoryType('EXPENSE')}
              >
                <Text
                  style={[
                    styles.modalSegmentBtnText,
                    categoryType === 'EXPENSE' && styles.modalSegmentBtnTextActive,
                  ]}
                >
                  Pengeluaran
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSegmentBtn,
                  categoryType === 'INCOME' && styles.modalSegmentBtnIncome,
                ]}
                onPress={() => setCategoryType('INCOME')}
              >
                <Text
                  style={[
                    styles.modalSegmentBtnText,
                    categoryType === 'INCOME' && styles.modalSegmentBtnTextActive,
                  ]}
                >
                  Pemasukan
                </Text>
              </TouchableOpacity>
            </View>

            {categoryType === 'EXPENSE' && (
              <>
                <Text style={styles.inputLabel}>Grup Anggaran:</Text>
                <View style={styles.modalSegmentRow}>
                  <TouchableOpacity
                    style={[
                      styles.modalSegmentBtn,
                      categoryGroup === 'NEEDS' && styles.modalSegmentBtnActiveBlue,
                    ]}
                    onPress={() => setCategoryGroup('NEEDS')}
                  >
                    <Text
                      style={[
                        styles.modalSegmentBtnText,
                        categoryGroup === 'NEEDS' && styles.modalSegmentBtnTextActive,
                      ]}
                    >
                      Kebutuhan (Needs)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalSegmentBtn,
                      categoryGroup === 'WANTS' && styles.modalSegmentBtnActiveBlue,
                    ]}
                    onPress={() => setCategoryGroup('WANTS')}
                  >
                    <Text
                      style={[
                        styles.modalSegmentBtnText,
                        categoryGroup === 'WANTS' && styles.modalSegmentBtnTextActive,
                      ]}
                    >
                      Keinginan (Wants)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalSegmentBtn,
                      categoryGroup === 'SAVINGS' && styles.modalSegmentBtnActiveBlue,
                    ]}
                    onPress={() => setCategoryGroup('SAVINGS')}
                  >
                    <Text
                      style={[
                        styles.modalSegmentBtnText,
                        categoryGroup === 'SAVINGS' && styles.modalSegmentBtnTextActive,
                      ]}
                    >
                      Tabungan (Savings)
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={styles.inputLabel}>Pilih Warna Kategori:</Text>
            <View style={styles.colorPaletteRow}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={`cat-color-${c}`}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    selectedCategoryColor === c && styles.colorDotSelected,
                  ]}
                  onPress={() => setSelectedCategoryColor(c)}
                />
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddCategoryModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleCreateCategory}
              >
                <Text style={styles.modalSaveBtnText}>Simpan Kategori</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Ubah Kategori */}
      <Modal
        visible={!!editingCategory}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingCategory(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ubah Kategori</Text>

            <Text style={styles.inputLabel}>Nama Kategori:</Text>
            <TextInput
              style={styles.modalInput}
              value={editCategoryName}
              onChangeText={setEditCategoryName}
            />

            {editingCategory?.type === 'EXPENSE' && (
              <>
                <Text style={styles.inputLabel}>Grup Anggaran:</Text>
                <View style={styles.modalSegmentRow}>
                  <TouchableOpacity
                    style={[
                      styles.modalSegmentBtn,
                      editCategoryGroup === 'NEEDS' && styles.modalSegmentBtnActiveBlue,
                    ]}
                    onPress={() => setEditCategoryGroup('NEEDS')}
                  >
                    <Text
                      style={[
                        styles.modalSegmentBtnText,
                        editCategoryGroup === 'NEEDS' && styles.modalSegmentBtnTextActive,
                      ]}
                    >
                      Kebutuhan (Needs)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalSegmentBtn,
                      editCategoryGroup === 'WANTS' && styles.modalSegmentBtnActiveBlue,
                    ]}
                    onPress={() => setEditCategoryGroup('WANTS')}
                  >
                    <Text
                      style={[
                        styles.modalSegmentBtnText,
                        editCategoryGroup === 'WANTS' && styles.modalSegmentBtnTextActive,
                      ]}
                    >
                      Keinginan (Wants)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalSegmentBtn,
                      editCategoryGroup === 'SAVINGS' && styles.modalSegmentBtnActiveBlue,
                    ]}
                    onPress={() => setEditCategoryGroup('SAVINGS')}
                  >
                    <Text
                      style={[
                        styles.modalSegmentBtnText,
                        editCategoryGroup === 'SAVINGS' && styles.modalSegmentBtnTextActive,
                      ]}
                    >
                      Tabungan (Savings)
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={styles.inputLabel}>Pilih Warna Kategori:</Text>
            <View style={styles.colorPaletteRow}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={`edit-cat-color-${c}`}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    editCategoryColor === c && styles.colorDotSelected,
                  ]}
                  onPress={() => setEditCategoryColor(c)}
                />
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingCategory(null)}
              >
                <Text style={styles.modalCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveEditCategory}
              >
                <Text style={styles.modalSaveBtnText}>Simpan Perubahan</Text>
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
  scrollContent: {
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  addSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 4,
  },
  addSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  walletItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  walletIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  walletItemBalance: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  categoryItemGroup: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  walletItemActions: {
    flexDirection: 'row',
    gap: 6,
  },
  walletActionBtn: {
    padding: 6,
  },
  catTabRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  catTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  catTabBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  catTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  catTabTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  catPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  backupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
  },
  backupActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  backupIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupActionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  backupActionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  storageInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
    gap: 10,
  },
  storageInfoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 2,
  },
  storageInfoText: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
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
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 14,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  modalSegmentRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  modalSegmentBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSegmentBtnExpense: {
    backgroundColor: '#EF4444',
  },
  modalSegmentBtnIncome: {
    backgroundColor: '#10B981',
  },
  modalSegmentBtnActiveBlue: {
    backgroundColor: '#2563EB',
  },
  modalSegmentBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  modalSegmentBtnTextActive: {
    color: '#FFFFFF',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  aboutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  aboutButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aboutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutButtonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  aboutButtonDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  appFooter: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  appFooterText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
});

