'use strict';
// In-memory route tests for the /financials GET handler, no database required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildFinancialsSummary, money } = require('../src/financialsSummary');

const file = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
const start = file.indexOf('// FINANCIALS_CU_COMBINED_V1');
const end = file.indexOf('// ----- Add Savings Account -----', start);
assert.ok(start >= 0 && end > start, 'combined Financials route must exist');
const routeText = file.slice(start, end);

function makeHandler(mockDB) {
  let handler, path, middleware;
  const guard = () => {};
  const app = { get(p, m, fn) { path = p; middleware = m; handler = fn; } };
  vm.runInNewContext(routeText, {
    app, auth: guard, getUsername: req => req.session.user.username,
    db: mockDB, console: {error() {}}, Promise,
    buildFinancialsSummary, financialsMoney: money,
  });
  assert.equal(path, '/financials');
  assert.equal(middleware, guard);
  return handler;
}

test('financials endpoint remains protected and filters every table by session username', async () => {
  const log = [];
  const handle = makeHandler({
    async any(sql, values) {
      assert.match(sql, /WHERE username = \$1/);
      log.push(values[0]);
      if (sql.includes('FROM userSavings')) return [{ savingsid: 2, accountname: 'Emergency Fund', amount: '250.00' }];
      if (sql.includes('FROM userIncome')) return [{ incomeid: 3, incomename: 'Tutoring', incometype: 'Weekly', amount: '80' }];
      if (sql.includes('FROM expenses')) return [{ expense_id: 9, expense_name: 'Groceries', category: 'Food', amount: '25.50' }];
      throw new Error('Unknown query');
    }
  });
  let rendered;
  await handle({session: {user: {username: 'alice'}}}, {render(page, data) { rendered = {page, data}; }});
  assert.deepEqual(log, ['alice', 'alice', 'alice']);
  assert.equal(rendered.page, 'pages/financials');
  assert.equal(rendered.data.savingsLabel, '250.00');
  assert.equal(rendered.data.expenseLabel, '25.50');
  assert.equal(rendered.data.incomeCount, 1);
  assert.equal(rendered.data.savingsAccounts[0].accountname, 'Emergency Fund');
  assert.equal(rendered.data.dataUnavailable, false);
});

test('a missing database table flags data as unavailable, not a fabricated zero balance', async () => {
  const handle = makeHandler({
    async any(sql) {
      if (sql.includes('FROM userSavings')) throw new Error('column missing');
      return [];
    }
  });
  let rendered;
  await handle({session: {user: {username: 'alice'}}}, {render(page, data) { rendered = data; }});
  assert.equal(rendered.dataUnavailable, true);
  assert.equal(rendered.savingsAvailable, false);
  assert.equal(rendered.expensesAvailable, true);
  assert.equal(rendered.warnings, 'savings');
});
