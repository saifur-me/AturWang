# AturWang

Aplikasi pengelola keuangan pribadi **100% Offline (Local-First)** yang dibangun dengan **React Native + Expo SDK 58**, **TypeScript**, dan **Expo SQLite**. Didesain dengan fokus pada kesederhanaan, privasi mutlak tanpa ketergantungan internet, evaluasi target anggaran (**Rencana vs Aktual**), dan pencatatan transaksi harian yang cepat.

---

## Fitur Utama

### 1. Dashboard Ringkasan Keuangan
- **Total Saldo (Kekayaan Bersih):** Akumulasi saldo gabungan dari seluruh dompet tunai, rekening bank, dan e-wallet.
- **Arus Kas Bulanan:** Menampilkan perbandingan total pemasukan dan total pengeluaran pada bulan aktif.
- **Jatah Aman Harian (*Daily Safe-to-Spend*):** Perhitungan otomatis batas belanja harian yang aman berdasarkan sisa anggaran dibagi sisa hari pada bulan berjalan.
- **Peringatan Anggaran Rawan (*Budget Alerts*):** Deteksi dini untuk kategori yang melebihi batas (*Overbudget*), mendekati batas (*Warning ≥75%*), atau belum direncanakan (*Unplanned*).
- **Transaksi Terkini:** Akses cepat ke riwayat pengeluaran dan pemasukan terbaru langsung dari beranda.

### 2. Riwayat Bulanan Interaktif
- **Navigasi Bulan Fleksibel:** Tombol ganti bulan yang responsif untuk meninjau pembukuan lampau.
- **Pencarian & Filter Real-Time:** Filter berdasarkan kata kunci catatan atau dompet tertentu.
- **Modal Detail Transaksi:** Ketuk transaksi mana pun untuk melihat rincian lengkap (nominal, dompet, kategori, catatan, waktu) serta tombol hapus aman dengan konfirmasi.
- **Rollback Saldo Otomatis (ACID):** Pembatalan atau penghapusan transaksi akan otomatis mengembalikan saldo dompet ke kondisi semula secara atomik.

### 3. Rencana vs Aktual (Target Anggaran)
- **Ringkasan Alokasi Anggaran:** Pengelompokan alokasi pos pengeluaran ke dalam grup **Kebutuhan**, **Keinginan**, dan **Tabungan**.
- **Indikator Status Anggaran:**
  - 🟢 **Aman (<75%):** Pengeluaran masih terkendali.
  - 🟡 **Waspada (75% - 99%):** Pengeluaran mendekati pagu anggaran.
  - 🔴 **Overbudget (≥100%):** Pengeluaran telah melampaui batas yang direncanakan.
- **Atur Anggaran Per Kategori:** Tetapkan target batas pengeluaran untuk masing-masing kategori dengan mudah.

### 4. Pencatatan Transaksi Cepat
- **Tipe Transaksi:** Pengeluaran (*Expense*), Pemasukan (*Income*), dan Transfer antar-dompet.
- **Input Angka Nyaman:** Menggunakan keyboard numerik bawaan ponsel (*number-pad*) dilengkapi tombol pintas nominal (+10rb, +50rb, +100rb, +500rb).
- **Native Date Picker:** Pemilih tanggal standar bawaan sistem operasi (Android / iOS) yang intuitif untuk mencatat transaksi yang telah lewat.
- **Pilihan Kategori Ringkas:** Tampilan kategori horizontal 3 baris yang efisien dan tidak menutupi layar.

### 5. Manajemen Dompet & Kategori
- **Multi-Dompet:** Tambah dompet baru (Tunai, Bank BCA, Mandiri, GoPay, OVO, ShopeePay, dll) dengan pilihan warna aksen dan penyesuaian saldo manual.
- **Kategori Fleksibel:** Tambah, edit nama, dan sesuaikan grup kategori sesuai kebutuhan hidup Anda.

### 6. Kedaulatan & Keamanan Data (100% Offline)
- **Privasi Terjaga:** Semua data tersimpan eksklusif di dalam database SQLite lokal perangkat Anda. Tidak ada server pihak ketiga, tidak ada pelacakan.
- **Ekspor CSV (Excel):** Ekspor catatan transaksi bulanan ke format `.csv` dan bagikan langsung lewat WhatsApp, Google Drive, atau Email.
- **Backup & Restore Penuh:** Simpan salinan file database `.db` dan pulihkan kapan saja ketika berganti perangkat.
- **Halaman Tentang Aplikasi:** Informasi spesifikasi teknis, versi, dan panduan pemeliharaan cadangan.

---

## Arsitektur & Teknologi

- **Framework:** React Native (Expo SDK 58)
- **Navigasi:** `expo-router` v4 (File-based Routing)
- **Bahasa:** TypeScript (`strict: true`)
- **Basis Data:** `expo-sqlite` dengan:
  - `PRAGMA journal_mode = WAL;` (Write-Ahead Logging untuk performa baca/tulis tinggi)
  - `PRAGMA foreign_keys = ON;` (Integritas relasi antar tabel)
  - Transaksi atomik via `withTransactionAsync`
- **Komponen Date Picker:** `@react-native-community/datetimepicker`
- **File Management & Sharing:** `expo-file-system`, `expo-sharing`, `expo-document-picker`
- **Ikonografi:** `@expo/vector-icons` (`Ionicons`)

---

## Struktur Folder

```text
AturWang/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Navigasi Bottom Tab Bar & Tombol Tambah (+)
│   │   ├── index.tsx             # Dashboard, Safe-to-Spend & Alerts
│   │   ├── transactions.tsx      # Riwayat Bulanan & Detail Transaksi
│   │   ├── budget.tsx            # Rencana vs Aktual & Evaluasi Target
│   │   └── settings.tsx          # Pengaturan Dompet, Kategori, Backup & Ekspor
│   ├── _layout.tsx               # Root Layout + SQLiteProvider
│   ├── modal-input.tsx           # Layar Modal Catat Transaksi
│   └── about.tsx                 # Halaman Tentang Aplikasi
├── src/
│   ├── database/
│   │   ├── db.ts                 # Skema DDL SQLite & Seeding Awal
│   │   ├── walletRepo.ts         # Query Dompet & Kategori
│   │   ├── transactionRepo.ts    # Transaksi Atomik & Rollback Saldo
│   │   └── budgetRepo.ts         # Evaluasi Anggaran & Safe-to-Spend
│   ├── types/
│   │   └── finance.ts            # Interface TypeScript
│   └── utils/
│       └── formatters.ts         # Formatter Rupiah, CSV, Backup & Restore
├── scripts/
│   └── patch-expo.js             # Skrip patching aset & kompatibilitas lingkungan
├── app.json                      # Konfigurasi Proyek Expo & Android
├── eas.json                      # Konfigurasi EAS Build
├── package.json                  # Dependensi Proyek
└── tsconfig.json                 # Konfigurasi TypeScript
```

---

## Cara Menjalankan Aplikasi

### 1. Prasyarat
- Node.js (v18 atau lebih baru)
- Aplikasi **Expo Go** (SDK 58) di perangkat Android / iOS

### 2. Instalasi Dependensi
Jalankan di terminal proyek:
```bash
npm install
```

### 3. Menjalankan Server Pengembangan
```bash
npx expo start -c
```
Pindai (scan) kode QR yang tampil di terminal menggunakan aplikasi **Expo Go** di ponsel Anda.

---

## Lisensi
Proyek ini dibuat untuk kebutuhan pengelolaan keuangan mandiri. Bebas digunakan dan dikembangkan sesuai kebutuhan Anda.
