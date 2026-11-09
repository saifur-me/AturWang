import * as SQLite from 'expo-sqlite';
import { Wallet, Category, CategoryGroup } from '../types/finance';

export async function getAllWallets(db: SQLite.SQLiteDatabase): Promise<Wallet[]> {
  return await db.getAllAsync<Wallet>('SELECT * FROM wallets ORDER BY id ASC');
}

export async function getTotalNetWorth(db: SQLite.SQLiteDatabase): Promise<number> {
  const result = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(current_balance), 0) AS total FROM wallets'
  );
  return result?.total ?? 0;
}

export async function createWallet(
  db: SQLite.SQLiteDatabase,
  name: string,
  initialBalance: number,
  color: string = '#2563EB',
  icon: string = 'wallet-outline'
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO wallets (name, initial_balance, current_balance, icon, color)
     VALUES (?, ?, ?, ?, ?)`,
    name,
    initialBalance,
    initialBalance,
    icon,
    color
  );
  return result.lastInsertRowId;
}

export async function updateWalletBalanceManual(
  db: SQLite.SQLiteDatabase,
  walletId: number,
  newBalance: number
): Promise<void> {
  await db.runAsync(
    'UPDATE wallets SET current_balance = ? WHERE id = ?',
    newBalance,
    walletId
  );
}

export async function deleteWallet(
  db: SQLite.SQLiteDatabase,
  walletId: number
): Promise<void> {
  await db.runAsync('DELETE FROM wallets WHERE id = ?', walletId);
}

export async function getCategories(
  db: SQLite.SQLiteDatabase,
  type?: 'INCOME' | 'EXPENSE'
): Promise<Category[]> {
  if (type) {
    return await db.getAllAsync<Category>(
      'SELECT * FROM categories WHERE type = ? ORDER BY id ASC',
      type
    );
  }
  return await db.getAllAsync<Category>('SELECT * FROM categories ORDER BY id ASC');
}

export async function createCategory(
  db: SQLite.SQLiteDatabase,
  name: string,
  type: 'INCOME' | 'EXPENSE',
  groupType: CategoryGroup = 'NEEDS',
  color: string = '#10B981',
  icon: string = 'pricetag-outline'
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO categories (name, type, group_type, icon, color)
     VALUES (?, ?, ?, ?, ?)`,
    name,
    type,
    groupType,
    icon,
    color
  );
  return result.lastInsertRowId;
}

export async function updateCategory(
  db: SQLite.SQLiteDatabase,
  categoryId: number,
  name: string,
  groupType: CategoryGroup = 'NEEDS',
  color: string = '#10B981',
  icon?: string
): Promise<void> {
  if (icon) {
    await db.runAsync(
      'UPDATE categories SET name = ?, group_type = ?, color = ?, icon = ? WHERE id = ?',
      name,
      groupType,
      color,
      icon,
      categoryId
    );
  } else {
    await db.runAsync(
      'UPDATE categories SET name = ?, group_type = ?, color = ? WHERE id = ?',
      name,
      groupType,
      color,
      categoryId
    );
  }
}

export async function deleteCategory(
  db: SQLite.SQLiteDatabase,
  categoryId: number
): Promise<void> {
  await db.runAsync('DELETE FROM categories WHERE id = ?', categoryId);
}


