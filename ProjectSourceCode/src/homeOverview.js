'use strict';

/**
 * The Home page is deliberately read-only. The three lookups are independent:
 * a missing or out-of-date table cannot hide the entire landing page.
 * Source amounts may have different periods, so income is counted, not summed.
 */
const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};

async function getHomeOverview(db, username) {
  if (!username || typeof username !== 'string') {
    throw new Error('Home overview requires an authenticated username');
  }

  const home = {
    savings: '0.00',
    expenses: '0.00',
    incomeCount: 0,
    categoryCount: 0,
    savingsAvailable: false,
    expensesAvailable: false,
    incomeAvailable: false,
    categories: [],
    recentExpenses: [],
    hasCategories: false,
    hasRecentExpenses: false,
    partialData: false,
  };

  const lookups = await Promise.allSettled([
    db.one(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM userSavings WHERE username = $1',
      [username]
    ),
    db.one('SELECT COUNT(*) AS count FROM userIncome WHERE username = $1', [username]),
    db.any(
      `SELECT expense_id, expense_name, amount, category
       FROM expenses
       WHERE username = $1
       ORDER BY expense_id DESC`,
      [username]
    ),
  ]);

  if (lookups[0].status === 'fulfilled') {
    home.savings = money(lookups[0].value.total);
    home.savingsAvailable = true;
  }
  if (lookups[1].status === 'fulfilled') {
    const count = Number(lookups[1].value.count);
    home.incomeCount = Number.isFinite(count) ? count : 0;
    home.incomeAvailable = true;
  }
  if (lookups[2].status === 'fulfilled') {
    const expenses = Array.isArray(lookups[2].value) ? lookups[2].value : [];
    const grouped = new Map();
    let total = 0;
    for (const item of expenses) {
      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount < 0) continue;
      total += amount;
      const category = String(item.category || 'Other').trim() || 'Other';
      grouped.set(category, (grouped.get(category) || 0) + amount);
    }
    home.expenses = money(total);
    home.expensesAvailable = true;
    const ordered = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
    home.categoryCount = ordered.length;
    home.categories = ordered.slice(0, 4).map(([name, amount]) => ({
      name,
      amount: money(amount),
      percent: total > 0 ? (100 * amount / total).toFixed(1) : '0.0',
    }));
    home.hasCategories = home.categories.length > 0 && total > 0;
    home.recentExpenses = expenses.slice(0, 5).map(item => ({
      description: String(item.expense_name || 'Expense'),
      category: String(item.category || 'Other'),
      amount: money(item.amount),
    }));
    home.hasRecentExpenses = home.recentExpenses.length > 0;
  }

  home.partialData = lookups.some(result => result.status === 'rejected');
  return home;
}

module.exports = {getHomeOverview, money};
