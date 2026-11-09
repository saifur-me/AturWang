import * as SQLite from 'expo-sqlite';

export const DB_NAME = 'finance_offline.db';

export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion === 0) {
    await db.withTransactionAsync(async () => {
      // 1. Tabel Dompet (wallets)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS wallets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          initial_balance INTEGER NOT NULL DEFAULT 0,
          current_balance INTEGER NOT NULL DEFAULT 0,
          icon TEXT DEFAULT 'wallet-outline',
          color TEXT DEFAULT '#2563EB'
        );
      `);

      // 2. Tabel Kategori (categories)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE')),
          group_type TEXT DEFAULT 'NEEDS',
          icon TEXT DEFAULT 'pricetag-outline',
          color TEXT DEFAULT '#10B981'
        );
      `);

      // 3. Tabel Transaksi (transactions)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wallet_id INTEGER NOT NULL,
          target_wallet_id INTEGER,
          category_id INTEGER,
          type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
          amount INTEGER NOT NULL,
          trans_date TEXT NOT NULL,
          note TEXT DEFAULT '',
          FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
          FOREIGN KEY (target_wallet_id) REFERENCES wallets(id) ON DELETE SET NULL,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_trans_date ON transactions(trans_date);
        CREATE INDEX IF NOT EXISTS idx_trans_cat ON transactions(category_id);
        CREATE INDEX IF NOT EXISTS idx_trans_wallet ON transactions(wallet_id);
      `);

      // 4. Tabel Perencanaan Bulanan (budgets)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS budgets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL,
          month_period TEXT NOT NULL,
          planned_amount INTEGER NOT NULL DEFAULT 0,
          UNIQUE(category_id, month_period),
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_budget_period ON budgets(month_period);
      `);

      // Seeding Data Default
      await db.execAsync(`
        INSERT INTO wallets (name, initial_balance, current_balance, icon, color) VALUES
        ('Tunai (Cash)', 0, 0, 'cash-outline', '#10B981'),
        ('Rekening Bank', 0, 0, 'card-outline', '#2563EB'),
        ('E-Wallet (GoPay/OVO)', 0, 0, 'phone-portrait-outline', '#8B5CF6');

        INSERT INTO categories (name, type, group_type, icon, color) VALUES
        ('Gaji Bulanan', 'INCOME', 'NEEDS', 'briefcase-outline', '#10B981'),
        ('Bonus & Insentif', 'INCOME', 'SAVINGS', 'gift-outline', '#059669'),
        ('Pemasukan Lainnya', 'INCOME', 'NEEDS', 'trending-up-outline', '#0D9488'),
        ('Makan & Minum', 'EXPENSE', 'NEEDS', 'fast-food-outline', '#EF4444'),
        ('Transportasi & BBM', 'EXPENSE', 'NEEDS', 'car-outline', '#F59E0B'),
        ('Belanja Kebutuhan Harian', 'EXPENSE', 'NEEDS', 'cart-outline', '#3B82F6'),
        ('Tagihan, Listrik & Internet', 'EXPENSE', 'NEEDS', 'flash-outline', '#6366F1'),
        ('Kopi, Jajan & Hiburan', 'EXPENSE', 'WANTS', 'cafe-outline', '#EC4899'),
        ('Belanja Hobi / Lifestyle', 'EXPENSE', 'WANTS', 'bag-handle-outline', '#8B5CF6'),
        ('Tabungan & Investasi', 'EXPENSE', 'SAVINGS', 'shield-checkmark-outline', '#14B8A6'),
        ('Dana Darurat / Sosial', 'EXPENSE', 'SAVINGS', 'medkit-outline', '#06B6D4');
      `);

      await db.execAsync('PRAGMA user_version = 1;');
    });
  }
}

