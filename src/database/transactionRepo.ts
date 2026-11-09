import * as SQLite from 'expo-sqlite';
import { TransactionItem, TransactionType } from '../types/finance';

export interface CreateTransactionPayload {
  wallet_id: number;
  target_wallet_id?: number | null;
  category_id?: number | null;
  type: TransactionType;
  amount: number;
  trans_date: string;
  note?: string;
}

export async function addTransactionAtomic(
  db: SQLite.SQLiteDatabase,
  payload: CreateTransactionPayload
): Promise<number> {
  let insertedId = 0;

  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `INSERT INTO transactions (wallet_id, target_wallet_id, category_id, type, amount, trans_date, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      payload.wallet_id,
      payload.target_wallet_id ?? null,
      payload.category_id ?? null,
      payload.type,
      payload.amount,
      payload.trans_date,
      payload.note ?? ''
    );
    insertedId = res.lastInsertRowId;

    if (payload.type === 'EXPENSE') {
      await db.runAsync(
        'UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?',
        payload.amount,
        payload.wallet_id
      );
    } else if (payload.type === 'INCOME') {
      await db.runAsync(
        'UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?',
        payload.amount,
        payload.wallet_id
      );
    } else if (payload.type === 'TRANSFER') {
      if (!payload.target_wallet_id) {
        throw new Error('Target wallet is required for transfer transactions.');
      }
      await db.runAsync(
        'UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?',
        payload.amount,
        payload.wallet_id
      );
      await db.runAsync(
        'UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?',
        payload.amount,
        payload.target_wallet_id
      );
    }
  });

  return insertedId;
}

export async function deleteTransactionAtomic(
  db: SQLite.SQLiteDatabase,
  transactionId: number
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const trans = await db.getFirstAsync<TransactionItem>(
      'SELECT * FROM transactions WHERE id = ?',
      transactionId
    );

    if (!trans) {
      return;
    }

    if (trans.type === 'EXPENSE') {
      await db.runAsync(
        'UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?',
        trans.amount,
        trans.wallet_id
      );
    } else if (trans.type === 'INCOME') {
      await db.runAsync(
        'UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?',
        trans.amount,
        trans.wallet_id
      );
    } else if (trans.type === 'TRANSFER') {
      await db.runAsync(
        'UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?',
        trans.amount,
        trans.wallet_id
      );
      if (trans.target_wallet_id) {
        await db.runAsync(
          'UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?',
          trans.amount,
          trans.target_wallet_id
        );
      }
    }

    await db.runAsync('DELETE FROM transactions WHERE id = ?', transactionId);
  });
}

export async function getTransactionsByMonth(
  db: SQLite.SQLiteDatabase,
  monthPeriod: string, // 'YYYY-MM'
  searchQuery?: string,
  walletId?: number
): Promise<TransactionItem[]> {
  let sql = `
    SELECT 
      t.id,
      t.wallet_id,
      w.name AS wallet_name,
      t.target_wallet_id,
      tw.name AS target_wallet_name,
      t.category_id,
      c.name AS category_name,
      c.icon AS category_icon,
      c.color AS category_color,
      t.type,
      t.amount,
      t.trans_date,
      t.note
    FROM transactions t
    LEFT JOIN wallets w ON t.wallet_id = w.id
    LEFT JOIN wallets tw ON t.target_wallet_id = tw.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE strftime('%Y-%m', t.trans_date) = ?
  `;

  const params: (string | number)[] = [monthPeriod];

  if (searchQuery && searchQuery.trim().length > 0) {
    sql += ` AND (t.note LIKE ? OR c.name LIKE ?)`;
    const pattern = `%${searchQuery.trim()}%`;
    params.push(pattern, pattern);
  }

  if (walletId && walletId > 0) {
    sql += ` AND (t.wallet_id = ? OR t.target_wallet_id = ?)`;
    params.push(walletId, walletId);
  }

  sql += ` ORDER BY t.trans_date DESC, t.id DESC`;

  return await db.getAllAsync<TransactionItem>(sql, ...params);
}

export async function getRecentTransactions(
  db: SQLite.SQLiteDatabase,
  limit: number = 5
): Promise<TransactionItem[]> {
  const sql = `
    SELECT 
      t.id,
      t.wallet_id,
      w.name AS wallet_name,
      t.target_wallet_id,
      tw.name AS target_wallet_name,
      t.category_id,
      c.name AS category_name,
      c.icon AS category_icon,
      c.color AS category_color,
      t.type,
      t.amount,
      t.trans_date,
      t.note
    FROM transactions t
    LEFT JOIN wallets w ON t.wallet_id = w.id
    LEFT JOIN wallets tw ON t.target_wallet_id = tw.id
    LEFT JOIN categories c ON t.category_id = c.id
    ORDER BY t.trans_date DESC, t.id DESC
    LIMIT ?
  `;

  return await db.getAllAsync<TransactionItem>(sql, limit);
}

