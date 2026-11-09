export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type CategoryGroup = 'NEEDS' | 'WANTS' | 'SAVINGS';
export type BudgetStatus = 'SAFE' | 'WARNING' | 'OVERBUDGET' | 'UNPLANNED';

export interface Wallet {
  id: number;
  name: string;
  initial_balance: number;
  current_balance: number;
  icon: string;
  color: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  group_type: CategoryGroup;
  icon: string;
  color: string;
}

export interface TransactionItem {
  id: number;
  wallet_id: number;
  wallet_name?: string;
  target_wallet_id?: number | null;
  target_wallet_name?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
  type: TransactionType;
  amount: number;
  trans_date: string; // Format ISO SQL: 'YYYY-MM-DD HH:MM:SS'
  note: string;
}

export interface BudgetComparisonItem {
  category_id: number;
  category_name: string;
  group_type: CategoryGroup;
  icon: string;
  color: string;
  planned_amount: number;
  actual_amount: number;
  remaining_amount: number;
  usage_percentage: number;
  status: BudgetStatus;
}

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  totalPlannedBudget: number;
  remainingBudget: number;
  dailySafeToSpend: number;
  remainingDaysInMonth: number;
  overallBudgetPercentage: number;
}

