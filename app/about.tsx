import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function AboutScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: Math.max(insets.bottom, 20) + 32 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. App Identity Hero */}
      <View style={styles.heroCard}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="wallet" size={38} color="#2563EB" />
          </View>
        </View>

        <Text style={styles.appName}>AturWang</Text>
        <Text style={styles.appTagline}>Catat Cepat, Pantau Bijak, Bebas Internet</Text>

        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>Versi 1.0.0 (Offline Edition)</Text>
        </View>
      </View>

      {/* 2. Core Values & Highlights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Keunggulan Utama</Text>

        <View style={styles.featureCard}>
          <View style={[styles.featureIconWrap, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="shield-checkmark" size={22} color="#059669" />
          </View>
          <View style={styles.featureTextGroup}>
            <Text style={styles.featureTitle}>100% Offline & Privat</Text>
            <Text style={styles.featureDesc}>
              Semua data finansial, dompet, dan riwayat transaksi tersimpan utuh di perangkat lokal Anda tanpa melibatkan server luar ataupun pelacak data.
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={[styles.featureIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="card-outline" size={22} color="#2563EB" />
          </View>
          <View style={styles.featureTextGroup}>
            <Text style={styles.featureTitle}>Kelola Banyak Dompet</Text>
            <Text style={styles.featureDesc}>
              Pisahkan pencatatan uang tunai (cash), saldo rekening bank, hingga e-wallet. Dilengkapi fitur transfer antar-dompet yang aman dan akurat.
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={[styles.featureIconWrap, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="pie-chart-outline" size={22} color="#D97706" />
          </View>
          <View style={styles.featureTextGroup}>
            <Text style={styles.featureTitle}>Rencana vs Aktual</Text>
            <Text style={styles.featureDesc}>
              Bebas tentukan batas alokasi anggaran bulanan untuk setiap kategori, pantau realisasi pengeluaran, dan hindari pemborosan.
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={[styles.featureIconWrap, { backgroundColor: '#F3E8FF' }]}>
            <Ionicons name="cloud-upload-outline" size={22} color="#7C3AED" />
          </View>
          <View style={styles.featureTextGroup}>
            <Text style={styles.featureTitle}>Kendali Data Penuh</Text>
            <Text style={styles.featureDesc}>
              Data Anda adalah milik Anda seutuhnya. Anda dapat melakukan Backup, Restore database SQLite (.db), maupun ekspor CSV ke WhatsApp, Google Drive, atau komputer.
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Tech Specs & Engine */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informasi Teknis</Text>
        <View style={styles.specsCard}>
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Nama Aplikasi</Text>
            <Text style={styles.specValue}>AturWang</Text>
          </View>
          <View style={styles.specDivider} />

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Basis Teknologi</Text>
            <Text style={styles.specValue}>React Native • Expo SDK 58</Text>
          </View>
          <View style={styles.specDivider} />

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Basis Data</Text>
            <Text style={styles.specValue}>SQLite (Local WAL Mode)</Text>
          </View>
          <View style={styles.specDivider} />

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Konektivitas</Text>
            <Text style={styles.specValue}>Standalone Offline</Text>
          </View>
          <View style={styles.specDivider} />

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Platform</Text>
            <Text style={styles.specValue}>Android & iOS</Text>
          </View>
        </View>
      </View>

      {/* 4. Tips Pemeliharaan Data */}
      <View style={styles.tipsBox}>
        <View style={styles.tipsHeader}>
          <Ionicons name="bulb-outline" size={18} color="#D97706" />
          <Text style={styles.tipsTitle}>Tips Pemeliharaan Cadangan</Text>
        </View>
        <Text style={styles.tipsContent}>
          Karena seluruh data tersimpan hanya di memori ponsel Anda, disarankan untuk secara berkala melakukan **Backup Database** pada menu Pengaturan dan menyimpannya di Google Drive atau cloud pribadi Anda untuk menjaga data jika berganti perangkat.
        </Text>
      </View>

      {/* 5. Footer Copyright */}
      <View style={styles.footerWrap}>
        <Text style={styles.copyrightText}>
          AturWang • Aplikasi Pengelola Keuangan Mandiri
        </Text>
        <Text style={styles.copyrightSub}>
          © 2026 AturWang. Dibuat untuk kenyamanan pencatatan keuangan Anda.
        </Text>
      </View>
    </ScrollView>
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
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  logoContainer: {
    marginBottom: 14,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#BFDBFE',
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
  },
  appTagline: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  versionBadge: {
    marginTop: 14,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
    paddingHorizontal: 2,
    letterSpacing: 0.2,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextGroup: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  specsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  specLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  specValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  specDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  tipsBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 20,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  tipsContent: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  footerWrap: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  copyrightText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  copyrightSub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

