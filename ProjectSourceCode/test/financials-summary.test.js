'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildFinancialsSummary } = require('../src/financialsSummary');

test('empty account shows true zeros and no invented charts', () => {
  const x = buildFinancialsSummary();
  assert.equal(x.savingsLabel, '0.00');
  assert.equal(x.expenseLabel, '0.00');
  assert.equal(x.hasCategories, false);
  assert.equal(x.hasRecentExpenses, false);
});

test('multiple savings accounts sum using new team schema amount', () => {
  const x = buildFinancialsSummary({ savingsAccounts: [{ amount: '120.50' }, { amount: '300' }] });
  assert.equal(x.totalSavings, 420.50);
  assert.equal(x.savingsCount, 2);
});

test('category grouping handles names, numeric database strings and ranks', () => {
  const x = buildFinancialsSummary({ expenses: [
    { expense_id: 1, expense_name: 'Pizza', category: 'Food', amount: '12.50' },
    { expense_id: 2, expense_name: 'Snacks', category: 'food', amount: '7.50' },
    { expense_id: 3, expense_name: 'Rent', category: 'Housing', amount: '80.00' },
  ]});
  assert.equal(x.expenseLabel, '100.00');
  assert.equal(x.categories.length, 2);
  assert.equal(x.highestCategory.name, 'Housing');
  assert.equal(x.highestCategory.percent, '80.0');
  assert.equal(x.categories[1].percent, '20.0');
  assert.match(x.categoryGradient, /^conic-gradient\(/);
  assert.equal(x.latestExpenses[0].name, 'Rent');
});

test('income sources with different frequencies stay separate', () => {
  const x = buildFinancialsSummary({ incomes: [
    { incometype: 'Weekly', amount: '200.00' },
    { incomeType: 'Monthly', amount: '1000' },
    { incomeType: 'Weekly', amount: '50.00' },
  ] });
  assert.equal(x.incomeCount, 3);
  assert.equal(x.incomeFrequencies.find(x => x.type === 'Weekly').totalLabel, '250.00');
  assert.equal(x.incomeFrequencies.find(x => x.type === 'Monthly').totalLabel, '1,000.00');
});

test('summary handles missing data and does not produce NaN', () => {
  const x = buildFinancialsSummary({ savingsAccounts: [{ amount: null }], expenses: [{ category: null, amount: 'n/a' }] });
  assert.equal(x.savingsLabel, '0.00');
  assert.equal(x.expenseLabel, '0.00');
  assert.equal(x.categories[0].name, 'Uncategorized');
});

test('savings distribution uses exact account amounts and percentages', () => {
  const s = buildFinancialsSummary({ savingsAccounts: [
    { accountname: 'Emergency', amount: '200' },
    { accountname: 'Travel', amount: '300' },
  ]});
  assert.equal(s.savingsAccountsMix.length, 2);
  assert.equal(s.savingsAccountsMix[0].accountName, 'Emergency');
  assert.equal(s.savingsAccountsMix[0].percent, '40.0');
  assert.equal(s.savingsAccountsMix[1].percent, '60.0');
});

test('income frequency bars show source count rather than summing incompatible rates', () => {
  const s = buildFinancialsSummary({ incomes: [
    { incometype: 'Hourly', amount: '18' },
    { incometype: 'Hourly', amount: '20' },
    { incometype: 'Monthly', amount: '200' },
  ]});
  assert.equal(s.incomeFrequencies.find(x => x.type === 'Hourly').countWidth, '100.0');
  assert.equal(s.incomeFrequencies.find(x => x.type === 'Monthly').countWidth, '50.0');
});

test('negative expense amounts do not produce a misleading negative chart', () => {
  const s = buildFinancialsSummary({ expenses: [
    { expense_id: 1, expense_name: 'Bad input', amount: '-50', category: 'Other' },
  ] });
  assert.equal(s.expenseLabel, '0.00');
  assert.equal(s.hasCategories, false);
  assert.equal(s.highestCategory, null);
});
