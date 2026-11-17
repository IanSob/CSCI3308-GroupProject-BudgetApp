'use strict';

// Pure data formatting for the combined Financials + Analysis page.
// This file never queries the database and does not depend on Express.
const COLORS = Object.freeze([
  '#CFB87C', '#272727', '#89764b', '#8c9396',
  '#ead9af', '#5b6063', '#b69a5c', '#c1c6c9'
]);

const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const money = (amount) => safeNumber(amount).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const get = (row, lower, camel) => row[lower] ?? row[camel];

function buildFinancialsSummary({ savingsAccounts = [], incomes = [], expenses = [] } = {}) {
  const totalSavings = savingsAccounts.reduce((sum, a) => sum + Math.max(0, safeNumber(a.amount)), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Math.max(0, safeNumber(e.amount)), 0);

  const grouped = new Map();
  for (const expense of expenses) {
    const category = String(expense.category || 'Uncategorized').trim() || 'Uncategorized';
    const key = category.toLocaleLowerCase('en-US');
    if (!grouped.has(key)) grouped.set(key, { name: category, total: 0, count: 0 });
    const item = grouped.get(key);
    item.total += Math.max(0, safeNumber(expense.amount));
    item.count += 1;
  }

  const categoryTotals = [...grouped.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const top = Math.max(0, ...categoryTotals.map(c => c.total));
  let from = 0;
  const stops = [];
  const categories = categoryTotals.map((item, i) => {
    const proportion = totalExpenses > 0 ? Math.max(0, item.total) / totalExpenses : 0;
    const to = i === categoryTotals.length - 1 ? 360 : from + proportion * 360;
    const color = COLORS[i % COLORS.length];
    stops.push(`${color} ${from.toFixed(4)}deg ${to.toFixed(4)}deg`);
    from = to;
    return {
      ...item,
      color,
      totalLabel: money(item.total),
      percent: totalExpenses > 0 ? ((item.total / totalExpenses) * 100).toFixed(1) : '0.0',
      barWidth: top > 0 ? ((Math.max(0, item.total) / top) * 100).toFixed(1) : '0',
    };
  });

  const byFrequency = new Map();
  for (const source of incomes) {
    const type = String(get(source, 'incometype', 'incomeType') || 'Unspecified').trim();
    if (!byFrequency.has(type)) byFrequency.set(type, { type, count: 0, total: 0 });
    const v = byFrequency.get(type);
    v.count += 1;
    v.total += safeNumber(source.amount);
  }
  const highestIncomeSourceCount = Math.max(1, ...[...byFrequency.values()].map(v => v.count));
  const incomeFrequencies = [...byFrequency.values()].map(v => ({
    ...v,
    totalLabel: money(v.total),
    countWidth: ((v.count / highestIncomeSourceCount) * 100).toFixed(1),
  }));

  let savingsShare = 0;
  const savingsAccountsMix = savingsAccounts.map((account, i) => {
    const balance = Math.max(0, safeNumber(account.amount));
    const percent = totalSavings > 0 ? balance / totalSavings * 100 : 0;
    savingsShare += percent;
    return {
      accountName: String(get(account, 'accountname', 'accountName') || 'Savings account'),
      amountLabel: money(balance),
      percent: percent.toFixed(1),
      color: COLORS[i % COLORS.length],
    };
  });

  const latestExpenses = [...expenses].sort((a, b) => {
    return safeNumber(b.expense_id ?? b.expenseId) - safeNumber(a.expense_id ?? a.expenseId);
  }).slice(0, 6).map(e => ({
    name: String(e.expense_name ?? e.expenseName ?? 'Expense'),
    category: String(e.category || 'Uncategorized'),
    amountLabel: money(e.amount),
  }));

  return {
    totalSavings,
    totalExpenses,
    savingsLabel: money(totalSavings),
    expenseLabel: money(totalExpenses),
    savingsCount: savingsAccounts.length,
    expenseCount: expenses.length,
    incomeCount: incomes.length,
    categoryCount: categories.length,
    averageExpenseLabel: money(expenses.length ? totalExpenses / expenses.length : 0),
    categories,
    hasCategories: categories.length > 0 && totalExpenses > 0,
    categoryGradient: stops.length ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#e7e7e7 0deg 360deg)',
    highestCategory: categories.length && totalExpenses > 0 ? categories[0] : null,
    incomeFrequencies,
    hasIncomeFrequencies: incomeFrequencies.length > 0,
    savingsAccountsMix,
    hasSavingsMix: totalSavings > 0 && savingsAccountsMix.length > 0,
    latestExpenses,
    hasRecentExpenses: latestExpenses.length > 0,
  };
}

module.exports = { buildFinancialsSummary, money };
