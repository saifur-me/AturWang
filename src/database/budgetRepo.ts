import * as SQLite from 'expo-sqlite';
import {
  BudgetComparisonItem,
  BudgetStatus,
  CategoryGroup,
  MonthlySummary,
} from '../types/finance';

interface RawBudgetRow {
  category_id: number;
  category_name: string;
  group_type: CategoryGroup;
  icon: string;
  color: string;
  planned_amount: number;
  actual_amount: number;
}

export async function upsertCategoryBudget(
  db: SQLite.SQLiteDatabase,
  categoryId: number,
  monthPeriod: string,
  plannedAmount: number
): Promise<void> {
  await db.runAsync(
    `INSERT INTO budgets (category_id, month_period, planned_amount)
     VALUES (?, ?, ?)
     ON CONFLICT(category_id, month_period)
     DO UPDATE SET planned_amount = excluded.planned_amount`,
    categoryId,
    monthPeriod,
    Math.max(0, Math.round(plannedAmount))
  );
}

export async function copyBudgetFromPreviousMonth(
  db: SQLite.SQLiteDatabase,
  sourceMonth: string,
  targetMonth: string
): Promise<number> {
  let copiedCount = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO budgets (category_id, month_period, planned_amount)
       SELECT category_id, ?, planned_amount
       FROM budgets
       WHERE month_period = ? AND planned_amount > 0
       ON CONFLICT(category_id, month_period)
       DO UPDATE SET planned_amount = excluded.planned_amount`,
      targetMonth,
      sourceMonth
    );
    copiedCount = result.changes;
  });
  return copiedCount;
}

export async function getMonthlyBudgetEvaluation(
  db: SQLite.SQLiteDatabase,
  monthPeriod: string
): Promise<BudgetComparisonItem[]> {
  const query = `
    SELECT 
      c.id AS category_id,
      c.name AS category_name,
      c.group_type,
      c.icon,
      c.color,
      COALESCE(b.planned_amount, 0) AS planned_amount,
      COALESCE(SUM(t.amount), 0) AS actual_amount
    FROM categories c
    LEFT JOIN budgets b 
      ON c.id = b.category_id AND b.month_period = ?
    LEFT JOIN transactions t 
      ON c.id = t.category_id 
      AND t.type = 'EXPENSE' 
      AND strftime('%Y-%m', t.trans_date) = ?
    WHERE c.type = 'EXPENSE'
    GROUP BY c.id
    ORDER BY planned_amount DESC, actual_amount DESC, c.id ASC
  `;

  const rows = await db.getAllAsync<RawBudgetRow>(query, monthPeriod, monthPeriod);

  return rows.map((row) => {
    const planned = row.planned_amount;
    const actual = row.actual_amount;
    const remaining = planned - actual;

    let usagePercentage = 0;
    if (planned > 0) {
      usagePercentage = Math.round((actual / planned) * 100);
    } else if (actual > 0) {
      usagePercentage = 100;
    }

    let status: BudgetStatus = 'SAFE';
    if (planned === 0 && actual > 0) {
      status = 'UNPLANNED';
    } else if (usagePercentage >= 100) {
      status = 'OVERBUDGET';
    } else if (usagePercentage >= 75) {
      status = 'WARNING';
    } else {
      status = 'SAFE';
    }

    return {
      category_id: row.category_id,
      category_name: row.category_name,
      group_type: row.group_type,
      icon: row.icon,
      color: row.color,
      planned_amount: planned,
      actual_amount: actual,
      remaining_amount: remaining,
      usage_percentage: usagePercentage,
      status,
    };
  });
}

export async function getMonthlySummaryMetrics(
  db: SQLite.SQLiteDatabase,
  monthPeriod: string
): Promise<MonthlySummary> {
  const incomeResult = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total 
     FROM transactions 
     WHERE type = 'INCOME' AND strftime('%Y-%m', trans_date) = ?`,
    monthPeriod
  );
  const totalIncome = incomeResult?.total ?? 0;

  const expenseResult = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total 
     FROM transactions 
     WHERE type = 'EXPENSE' AND strftime('%Y-%m', trans_date) = ?`,
    monthPeriod
  );
  const totalExpense = expenseResult?.total ?? 0;

  const budgetResult = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(planned_amount), 0) AS total 
     FROM budgets 
     WHERE month_period = ?`,
    monthPeriod
  );
  const totalPlannedBudget = budgetResult?.total ?? 0;

  const remainingBudget = totalPlannedBudget - totalExpense;

  // Calculate remaining days
  const [yearStr, monthStr] = monthPeriod.split('-');
  const targetYear = parseInt(yearStr, 10);
  const targetMonth = parseInt(monthStr, 10); // 1-12

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();

  let remainingDaysInMonth = 0;
  if (
    targetYear < currentYear ||
    (targetYear === currentYear && targetMonth < currentMonth)
  ) {
    remainingDaysInMonth = 0;
  } else if (
    targetYear > currentYear ||
    (targetYear === currentYear && targetMonth > currentMonth)
  ) {
    remainingDaysInMonth = daysInTargetMonth;
  } else {
    // Current month: count today until end of month
    remainingDaysInMonth = Math.max(1, daysInTargetMonth - currentDay + 1);
  }

  const dailySafeToSpend =
    remainingBudget > 0 && remainingDaysInMonth > 0
      ? Math.floor(remainingBudget / remainingDaysInMonth)
      : 0;

  const overallBudgetPercentage =
    totalPlannedBudget > 0
      ? Math.round((totalExpense / totalPlannedBudget) * 100)
      : 0;

  return {
    totalIncome,
    totalExpense,
    totalPlannedBudget,
    remainingBudget,
    dailySafeToSpend,
    remainingDaysInMonth,
    overallBudgetPercentage,
  };
}

