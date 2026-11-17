'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {getHomeOverview} = require('../src/homeOverview');

function fakeDb(savings = {total: 0}, income = {count: 0}, expenses = []) {
  return {
    one: (sql, params) => {
      assert.deepEqual(params, ['student1']);
      if (sql.includes('userSavings')) return Promise.resolve(savings);
      if (sql.includes('userIncome')) return Promise.resolve(income);
      throw Error('Unexpected query');
    },
    any: (sql, params) => {
      assert.match(sql, /FROM expenses/);
      assert.deepEqual(params, ['student1']);
      return Promise.resolve(expenses);
    },
  };
}

test('correctly sums multiple savings accounts and counts income sources', async () => {
  const x = await getHomeOverview(fakeDb({total: '1120.25'}, {count:'3'}, []), 'student1');
  assert.equal(x.savings, '1120.25');
  assert.equal(x.incomeCount, 3);
  assert.equal(x.expenses, '0.00');
  assert.equal(x.categoryCount, 0);
  assert.equal(x.partialData, false);
});

test('calculates spending categories and a recent-expense list', async () => {
  const expenses = [
    {expense_id: 3,expense_name:'Lunch',amount:'20.00',category:'Food'},
    {expense_id: 2,expense_name:'Bus',amount:'30.00',category:'Transport'},
    {expense_id: 1,expense_name:'Breakfast',amount:'50.00',category:'Food'},
  ];
  const x = await getHomeOverview(fakeDb({total:'0'}, {count:'1'}, expenses), 'student1');
  assert.equal(x.expenses, '100.00');
  assert.equal(x.categoryCount, 2);
  assert.deepEqual(x.categories.map(c => [c.name,c.amount,c.percent]), [['Food','70.00','70.0'],['Transport','30.00','30.0']]);
  assert.equal(x.recentExpenses.length, 3);
  assert.equal(x.recentExpenses[0].description, 'Lunch');
});

test('displays zero rather than sample metrics for an empty signed-in account', async () => {
  const x = await getHomeOverview(fakeDb(), 'student1');
  assert.equal(x.savings, '0.00');
  assert.equal(x.expenses, '0.00');
  assert.equal(x.hasRecentExpenses, false);
  assert.equal(x.hasCategories, false);
  assert.equal(x.savingsAvailable, true);
});

test('does not hide Home when savings table is unavailable', async () => {
  const db = fakeDb({total:'20'}, {count:'1'}, [{expense_name:'Snack',category:'Food',amount:'5'}]);
  db.one = (sql, params) => sql.includes('userSavings') ? Promise.reject(Error('column amount does not exist')) : Promise.resolve({count: 1});
  const x = await getHomeOverview(db, 'student1');
  assert.equal(x.partialData, true);
  assert.equal(x.savingsAvailable, false);
  assert.equal(x.expensesAvailable, true);
  assert.equal(x.expenses, '5.00');
});

test('does not read another user or accept missing authentication', async () => {
  await assert.rejects(getHomeOverview(fakeDb(), ''), /authenticated username/);
  const x = await getHomeOverview(fakeDb(), 'student1');
  assert.equal(x.incomeAvailable,true);
});

test('income is deliberately not summed across unlike frequencies', async () => {
  const x = await getHomeOverview(fakeDb({total:'200'},{count:'2'},[]),'student1');
  assert.equal(x.incomeCount, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(x,'monthlyIncome'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(x,'netCashFlow'),false);
});
