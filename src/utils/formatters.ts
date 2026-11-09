import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { DB_NAME } from '../database/db';
import { getTransactionsByMonth } from '../database/transactionRepo';

const INDO_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatRupiah(amount: number, showPrefix: boolean = true): string {
  const isNegative = amount < 0;
  const absAmount = Math.round(Math.abs(amount));
  const formattedNumber = absAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (!showPrefix) {
    return isNegative ? `-${formattedNumber}` : formattedNumber;
  }

  return isNegative ? `-Rp${formattedNumber}` : `Rp${formattedNumber}`;
}

export function getCurrentMonthPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

export function shiftMonthPeriod(monthPeriod: string, deltaMonths: number): string {
  const [yearStr, monthStr] = monthPeriod.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1; // 0-11

  month += deltaMonths;
  const targetDate = new Date(year, month, 1);
  const nextYear = targetDate.getFullYear();
  const nextMonth = (targetDate.getMonth() + 1).toString().padStart(2, '0');

  return `${nextYear}-${nextMonth}`;
}

export function formatMonthLabel(monthPeriod: string): string {
  const [yearStr, monthStr] = monthPeriod.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (month >= 1 && month <= 12) {
    return `${INDO_MONTHS[month - 1]} ${year}`;
  }
  return monthPeriod;
}

export async function exportTransactionsToCSV(
  db: SQLite.SQLiteDatabase,
  monthPeriod: string
): Promise<string> {
  const transactions = await getTransactionsByMonth(db, monthPeriod);

  const header = ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Dompet Asal', 'Dompet Tujuan', 'Nominal', 'Catatan'];
  const rows = transactions.map((t) => [
    t.id.toString(),
    `"${t.trans_date}"`,
    `"${t.type}"`,
    `"${t.category_name ?? '-'}"`,
    `"${t.wallet_name ?? '-'}"`,
    `"${t.target_wallet_name ?? '-'}"`,
    t.amount.toString(),
    `"${(t.note ?? '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

  const fileName = `laporan_transaksi_${monthPeriod}.csv`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Ekspor Transaksi ${formatMonthLabel(monthPeriod)}`,
      UTI: 'public.comma-separated-values-text',
    });
  }

  return fileUri;
}

export async function backupDatabaseFile(db: SQLite.SQLiteDatabase): Promise<string> {
  // Checkpoint WAL log and compact SQLite database file
  await db.execAsync('PRAGMA wal_checkpoint(FULL); VACUUM;');

  const dbDir = `${FileSystem.documentDirectory}SQLite/`;
  const dbPath = `${dbDir}${DB_NAME}`;

  const fileInfo = await FileSystem.getInfoAsync(dbPath);
  if (!fileInfo.exists) {
    throw new Error('Database file does not exist at expected location.');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `aturwang_backup_${timestamp}.db`;
  const backupUri = `${FileSystem.cacheDirectory}${backupFileName}`;

  await FileSystem.copyAsync({
    from: dbPath,
    to: backupUri,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(backupUri, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Simpan Backup Database AturWang',
    });
  }

  return backupUri;
}

export async function restoreDatabaseFile(db: SQLite.SQLiteDatabase): Promise<boolean> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: '*/*',
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return false;
  }

  const pickedFile = result.assets[0];
  const dbDir = `${FileSystem.documentDirectory}SQLite/`;
  const targetDbPath = `${dbDir}${DB_NAME}`;

  const dirInfo = await FileSystem.getInfoAsync(dbDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
  }

  // Copy picked backup file to replace current SQLite database
  await FileSystem.copyAsync({
    from: pickedFile.uri,
    to: targetDbPath,
  });

  // Checkpoint restored database
  await db.execAsync('PRAGMA wal_checkpoint(FULL);');

  return true;
}

