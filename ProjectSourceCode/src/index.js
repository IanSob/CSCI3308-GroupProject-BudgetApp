// *****************************************************
// Section 1 : Import Dependencies
// *****************************************************

const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const { readFileSync } = require('node:fs');
const {getHomeOverview} = require('./homeOverview');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const validation = require('./validation');
const { buildFinancialsSummary } = require('./financialsSummary');

// *****************************************************
// Section 2 : Connect to DB
// *****************************************************

const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
  helpers: {
    eq: (a, b) => a === b,
  },
});

const dbConfig = {
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

const db = pgp(dbConfig);

// *****************************************************
// Section 3 : App Settings
// *****************************************************

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(express.static(__dirname + '/resources'));

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// *****************************************************
// Section 4 : API Routes
// *****************************************************

const auth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

const no_auth = (req, res, next) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  next();
};

// The session always stores { username }; older code stored a bare string.
const getUsername = (req) =>
  typeof req.session.user === 'string'
    ? req.session.user
    : req.session.user.username;

// Add the next scheduled date without overflowing month-end dates.
const getNextDueDate = (dateString, frequency, anchorDay = Number(dateString.slice(8, 10))) => {
  const [year, month, day] = dateString.split('-').map(Number);

  let nextYear = year;
  let nextMonth = month - 1;
  let nextDay = anchorDay;

  if (frequency === 'weekly') {
    const date = new Date(Date.UTC(year, month - 1, day + 7));
    return date.toISOString().slice(0, 10);
  }

  if (frequency === 'biweekly') {
    const date = new Date(Date.UTC(year, month - 1, day + 14));
    return date.toISOString().slice(0, 10);
  }

  if (frequency === 'monthly') {
    nextMonth += 1;
    nextYear += Math.floor(nextMonth / 12);
    nextMonth %= 12;
  } else if (frequency === 'yearly') {
    nextYear += 1;
  } else {
    throw new Error('Invalid recurring expense frequency');
  }

  // Clamp dates such as January 31 to the last day of February.
  const lastDay = new Date(
    Date.UTC(nextYear, nextMonth + 1, 0)
  ).getUTCDate();

  nextDay = Math.min(nextDay, lastDay);

  return [
    nextYear,
    String(nextMonth + 1).padStart(2, '0'),
    String(nextDay).padStart(2, '0')
  ].join('-');
};

// Generate all overdue payments for one user's recurring expenses.
const processRecurringExpenses = async (username) => {
  await db.tx(async (t) => {
    // Use the database's date to avoid timezone inconsistencies.
    const { today } = await t.one(
      `SELECT CURRENT_DATE::TEXT AS today`
    );

    // Lock schedules while processing them to prevent concurrent duplicates.
    const recurringExpenses = await t.any(
      `SELECT recurring_expense_id,
              expense_name,
              amount,
              category,
              frequency,
              TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
              TO_CHAR(next_due_date, 'YYYY-MM-DD') AS next_due_date
       FROM recurring_expenses
       WHERE username = $1
         AND active = TRUE
         AND next_due_date <= CURRENT_DATE
       ORDER BY recurring_expense_id
       FOR UPDATE`,
      [username]
    );

    for (const recurring of recurringExpenses) {
      let dueDate = recurring.next_due_date;

      while (dueDate <= today) {
        // Check whether this scheduled payment was already recorded.
        const existingPayment = await t.oneOrNone(
          `SELECT payment_id
           FROM recurring_expense_payments
           WHERE recurring_expense_id = $1
             AND due_date = $2`,
          [recurring.recurring_expense_id, dueDate]
        );

        if (!existingPayment) {
          // Create the regular expense.
          const expense = await t.one(
            `INSERT INTO expenses
               (username, expense_name, amount, category)
             VALUES ($1, $2, $3, $4)
             RETURNING expense_id`,
            [
              username,
              recurring.expense_name,
              recurring.amount,
              recurring.category
            ]
          );

          // Record which scheduled payment generated that expense.
          await t.none(
            `INSERT INTO recurring_expense_payments
               (recurring_expense_id, due_date, expense_id)
             VALUES ($1, $2, $3)`,
            [
              recurring.recurring_expense_id,
              dueDate,
              expense.expense_id
            ]
          );
        }

        // Calculate the next scheduled payment date.
        dueDate = getNextDueDate(
              dueDate,
              recurring.frequency,
              Number(recurring.start_date.slice(8, 10))
        );
      }

      // Save the next upcoming date.
      await t.none(
        `UPDATE recurring_expenses
         SET next_due_date = $1
         WHERE recurring_expense_id = $2
           AND username = $3`,
        [dueDate, recurring.recurring_expense_id, username]
      );
    }
  });
};

// Shared navigation information for Handlebars
app.use((req, res, next) => {

  // Check if the user is logged in
  res.locals.isAuthenticated = Boolean(req.session.user);

  // Main navigation pages
  res.locals.activeHome = req.path === '/';
  res.locals.activeDashboard = req.path === '/dashboard';
  res.locals.activeFinancials = req.path === '/financials';
  res.locals.activeExpenses = req.path === '/expenses';
  res.locals.activeAnalysis = req.path === '/analysis';

  // Account navigation
  res.locals.activeSettings = req.path === '/settings';
  res.locals.activeLogin = req.path === '/login';
  res.locals.activeRegister = req.path === '/register';

  next();
});

// Home page
app.get('/', async (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser) {
    return res.render('pages/home.hbs', { homeLoggedIn: false });
  }

  const username = getUsername(req);
  if (typeof username !== 'string' || !username) {
    return res.render('pages/home.hbs', { homeLoggedIn: false });
  }

  try {
    const home = await getHomeOverview(db, username);
    return res.render('pages/home.hbs', {
      ...home,
      homeLoggedIn: true,
      homeName: (typeof sessionUser === 'object' && sessionUser.name) || username,
    });
  } catch (error) {
    console.error('Home overview error:', error.message || error);
    return res.render('pages/home.hbs', {
      homeLoggedIn: true,
      homeName: username,
      partialData: true,
    });
  }
});

// Expenses Display
app.get('/expenses', auth, async (req, res) => {
  try {
    const username = getUsername(req);

    await processRecurringExpenses(username);

    const expenses = await db.any(
      `SELECT expense_id, expense_name, amount, category
       FROM expenses
       WHERE username = $1
       ORDER BY expense_id DESC`,
      [username]
    );

    const recurringExpenses = await db.any(
      `SELECT recurring_expense_id,
              expense_name,
              amount,
              category,
              frequency,
              TO_CHAR(start_date, 'YYYY-MM-DD') AS start_date,
              TO_CHAR(next_due_date, 'YYYY-MM-DD') AS next_due_date,
              active
      FROM recurring_expenses
      WHERE username = $1
      ORDER BY active DESC, next_due_date ASC`,
      [username]
    );
    const totalExpenses = expenses.reduce(
      (total, expense) => total + Number(expense.amount),
      0
    );

  res.render('pages/expenses.hbs', {
    expenses: expenses,
    hasExpenses: expenses.length > 0,
    recurringExpenses: recurringExpenses,
    hasRecurringExpenses: recurringExpenses.length > 0,
    totalExpenses: totalExpenses.toFixed(2),
    successMessage: req.query.success
      ? 'Expense added successfully!'
      : null,
    recurringSuccessMessage: req.query.recurringSuccess
      ? 'Recurring expense added successfully!'
      : req.query.recurringUpdated
        ? 'Recurring expense updated successfully!'
        : req.query.recurringStopped
          ? 'Recurring expense stopped successfully!'
          : req.query.recurringDeleted
            ? 'Recurring expense deleted successfully!'
            : null,
  });

  } catch (err) {
    console.log('ERROR:', err.message || err);

    res.status(500).render('pages/expenses.hbs', {
      expenses: [],
      hasExpenses: false,
      recurringExpenses: [],
      hasRecurringExpenses: false,
      totalExpenses: '0.00',
      errorMessage: 'Unable to load expenses right now.',
    });
  }
});

// Expenses Input
app.post('/expenses', auth, async (req, res) => {
  try {
    const username = getUsername(req);

    const { expense_name, amount, category } = req.body;

    // Validate required fields
    if (
      !expense_name ||
      !expense_name.trim() ||
      !amount ||
      !category ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      return res.status(400).redirect('/expenses');
    }

    // Save expense to database
    await db.none(
      `INSERT INTO expenses (username, expense_name, amount, category)
       VALUES ($1, $2, $3, $4)`,
      [username, expense_name.trim(), Number(amount), category]
    );

    res.redirect('/expenses?success=1');
  } catch (err) {
    console.log('ERROR:', err.message || err);
    res.status(500).redirect('/expenses');
  }
});


// Create a recurring expense schedule
app.post('/recurring-expenses', auth, async (req, res) => {
  try {
    const username = getUsername(req);

    const {
      expense_name,
      amount,
      category,
      frequency,
      start_date
    } = req.body;

    const validCategories = [
      'Food',
      'Transportation',
      'Entertainment',
      'Shopping',
      'Other'
    ];

    const validFrequencies = [
      'weekly',
      'biweekly',
      'monthly',
      'yearly'
    ];

    // Validate the submitted information.
    const dateIsValid =
      /^\d{4}-\d{2}-\d{2}$/.test(start_date || '') &&
      !Number.isNaN(Date.parse(`${start_date}T00:00:00Z`)) &&
      new Date(`${start_date}T00:00:00Z`)
        .toISOString().slice(0, 10) === start_date;

    if (
      !expense_name ||
      !expense_name.trim() ||
      expense_name.trim().length > 100 ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0 ||
      Number(amount) > 99999999.99 ||
      !validCategories.includes(category) ||
      !validFrequencies.includes(frequency) ||
      !dateIsValid
    ) {
      return res.status(400).redirect('/expenses');
    }

    // Save the recurring schedule.
    await db.none(
      `INSERT INTO recurring_expenses
        (username, expense_name, amount, category,
         frequency, start_date, next_due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [
        username,
        expense_name.trim(),
        Number(amount),
        category,
        frequency,
        start_date
      ]
    );

    res.redirect('/expenses?recurringSuccess=1');
  } catch (err) {
    console.log('Recurring expense error:', err.message || err);
    res.status(500).redirect('/expenses');
  }
});


// Edit an existing recurring expense schedule
app.post('/recurring-expenses/:id/edit', auth, async (req, res) => {
  try {
    const username = getUsername(req);
    const recurringExpenseId = Number(req.params.id);

    const {
      expense_name,
      amount,
      category,
      frequency,
      start_date
    } = req.body;

    const validCategories = [
      'Food',
      'Transportation',
      'Entertainment',
      'Shopping',
      'Other'
    ];

    const validFrequencies = [
      'weekly',
      'biweekly',
      'monthly',
      'yearly'
    ];

    const dateIsValid =
      /^\d{4}-\d{2}-\d{2}$/.test(start_date || '') &&
      !Number.isNaN(Date.parse(`${start_date}T00:00:00Z`)) &&
      new Date(`${start_date}T00:00:00Z`)
        .toISOString().slice(0, 10) === start_date;

    if (
      !Number.isInteger(recurringExpenseId) ||
      recurringExpenseId <= 0 ||
      !expense_name ||
      !expense_name.trim() ||
      expense_name.trim().length > 100 ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0 ||
      Number(amount) > 99999999.99 ||
      !validCategories.includes(category) ||
      !validFrequencies.includes(frequency) ||
      !dateIsValid
    ) {
      return res.status(400).redirect('/expenses');
    }

    // Update only a schedule belonging to the logged-in user.
    const result = await db.result(
      `UPDATE recurring_expenses
       SET expense_name = $1,
           amount = $2,
           category = $3,
           frequency = $4,
           start_date = $5,
           next_due_date = $5
       WHERE recurring_expense_id = $6
         AND username = $7`,
      [
        expense_name.trim(),
        Number(amount),
        category,
        frequency,
        start_date,
        recurringExpenseId,
        username
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).redirect('/expenses');
    }

    res.redirect('/expenses?recurringUpdated=1');
  } catch (err) {
    console.log('Edit recurring expense error:', err.message || err);
    res.status(500).redirect('/expenses');
  }
});

// Stop an existing recurring expense schedule
app.post('/recurring-expenses/:id/stop', auth, async (req, res) => {
  try {
    const username = getUsername(req);
    const recurringExpenseId = Number(req.params.id);

    if (!Number.isInteger(recurringExpenseId) || recurringExpenseId <= 0) {
      return res.status(400).redirect('/expenses');
    }

    const result = await db.result(
      `UPDATE recurring_expenses
       SET active = FALSE
       WHERE recurring_expense_id = $1
         AND username = $2`,
      [recurringExpenseId, username]
    );

    if (result.rowCount === 0) {
      return res.status(404).redirect('/expenses');
    }

    res.redirect('/expenses?recurringStopped=1');
  } catch (err) {
    console.log('Stop recurring expense error:', err.message || err);
    res.status(500).redirect('/expenses');
  }
});

// Delete a recurring expense schedule
app.post('/recurring-expenses/:id/delete', auth, async (req, res) => {
  try {
    const username = getUsername(req);
    const recurringExpenseId = Number(req.params.id);

    if (!Number.isInteger(recurringExpenseId) || recurringExpenseId <= 0) {
      return res.status(400).redirect('/expenses');
    }

    const result = await db.result(
      `DELETE FROM recurring_expenses
       WHERE recurring_expense_id = $1
         AND username = $2`,
      [recurringExpenseId, username]
    );

    if (result.rowCount === 0) {
      return res.status(404).redirect('/expenses');
    }

    res.redirect('/expenses?recurringDeleted=1');
  } catch (err) {
    console.log('Delete recurring expense error:', err.message || err);
    res.status(500).redirect('/expenses');
  }
});

// Forgot Password Route, Saanvi
app.get('/forgot-password', (req, res) => {
  res.render('pages/forgot-password.hbs');
});


// ---------------------Income & Savings---------------------------//

const VALID_INCOME_TYPES = ['Hourly', 'Weekly', 'Bi-Weekly', 'Monthly'];
 
// Hours are required for Hourly income and ignored (saved as NULL) for every other type.
// Returns { ok, hours }.
const parseIncomeHours = (incomeType, rawHours) => {
  if (incomeType !== 'Hourly') {
    return { ok: true, hours: null };
  }
  const hours = parseFloat(rawHours);
  if (!(hours > 0 && hours <= 168)) {
    return { ok: false, hours: null };
  }
  return { ok: true, hours };
};

app.get('/financials', auth, async (req, res) => {
  try {
    const username = req.session.user.username;
 
    const savingsAccounts = await db.any(
      `SELECT savingsID, accountName, amount
       FROM userSavings
       WHERE username = $1
       ORDER BY savingsID`,
      [username]
    );
 
    const incomeRows = await db.any(
      `SELECT incomeID, incomeName, incomeType, amount, hoursPerWeek
       FROM userIncome
       WHERE username = $1
       ORDER BY incomeID`,
      [username]
    );
 
    // DECIMAL columns come back from pg as strings ("15.00"), so convert them.
    // weeklyEstimate = hourly rate x hours per week, only for hourly income.
    const incomes = incomeRows.map((row) => {
      const hours = row.hoursperweek === null ? null : Number(row.hoursperweek);
      return {
        ...row,
        hoursperweek: hours,
        weeklyestimate: hours ? (Number(row.amount) * hours).toFixed(2) : null,
      };
    });
 
    const totalSavings = savingsAccounts.reduce(
      (total, account) => total + Number(account.amount),
      0
    );
 
    res.render('pages/financials', {
      savings: totalSavings.toFixed(2),
      savingsAccounts,
      incomes,
    });
  } catch (err) {
    console.log('ERROR:', err.message || err);
    res.render('pages/financials', {
      savings: '0.00',
      savingsAccounts: [],
      incomes: [],
      message: 'Could not load financial data.',
      error: true,
    });
  }
});


// Analysis
app.get('/analysis', auth, async (req, res) => {
  const username = getUsername(req);
  const unavailable = [];

  async function fetchRows(section, sql) {
    try {
      return await db.any(sql, [username]);
    } catch (error) {
      unavailable.push(section);
      console.error(`Analysis ${section} query failed:`, error.message || error);
      return [];
    }
  }

  const [savingsRows, incomeRows, expenseRows] = await Promise.all([
    fetchRows('savings',
      `SELECT savingsID, accountName, amount FROM userSavings
       WHERE username = $1 ORDER BY savingsID`),
    fetchRows('income',
      `SELECT incomeID, incomeName, incomeType, amount FROM userIncome
       WHERE username = $1 ORDER BY incomeID`),
    fetchRows('expenses',
      `SELECT expense_id, expense_name, amount, category FROM expenses
       WHERE username = $1 ORDER BY expense_id DESC`),
  ]);

  const summary = buildFinancialsSummary({
    savingsAccounts: savingsRows,
    incomes: incomeRows,
    expenses: expenseRows,
  });
  const savingsAvailable = !unavailable.includes('savings');
  const incomesAvailable = !unavailable.includes('income');
  const expensesAvailable = !unavailable.includes('expenses');

  res.render('pages/analysis', {
    ...summary,
    savingsAvailable,
    incomesAvailable,
    expensesAvailable,
    dataUnavailable: unavailable.length > 0,
    warnings: unavailable.join(', '),
  });
});


// ----- Add Savings Account -----
app.post('/savings', auth, async (req, res) => {
  const { accountName, amount } = req.body;
  const parsedAmount = parseFloat(amount);
 
  if (!accountName || !accountName.trim() || accountName.trim().length > 50 || !(parsedAmount >= 0)) {
    return res.redirect('/financials');
  }
 
  try {
    await db.none(
      `INSERT INTO userSavings (username, accountName, amount)
       VALUES ($1, $2, $3)`,
      [getUsername(req), accountName.trim(), parsedAmount]
    );
  } catch (err) {
    console.log('ERROR:', err.message || err);
  }
 
  res.redirect('/financials');
});
 
 
// ----- Edit Savings Account -----
app.post('/savings/update', auth, async (req, res) => {
  const { savingsId, accountName, amount } = req.body;
  const id = parseInt(savingsId, 10);
  const parsedAmount = parseFloat(amount);
 
  if (!Number.isInteger(id) || !accountName || !accountName.trim() || accountName.trim().length > 50 || !(parsedAmount >= 0)) {
    return res.redirect('/financials');
  }
 
  try {
    // "AND username = $4" makes sure users can only edit their own accounts
    await db.none(
      `UPDATE userSavings
       SET accountName = $1, amount = $2
       WHERE savingsID = $3 AND username = $4`,
      [accountName.trim(), parsedAmount, id, getUsername(req)]
    );
  } catch (err) {
    console.log('ERROR:', err.message || err);
  }
 
  res.redirect('/financials');
});
 
 
// ----- Remove Savings Account -----
app.post('/savings/delete', auth, async (req, res) => {
  const id = parseInt(req.body.savingsId, 10);
 
  if (!Number.isInteger(id)) {
    return res.redirect('/financials');
  }
 
  try {
    await db.none(
      'DELETE FROM userSavings WHERE savingsID = $1 AND username = $2',
      [id, getUsername(req)]
    );
  } catch (err) {
    console.log('ERROR:', err.message || err);
  }
 
  res.redirect('/financials');
});


// Add Income
app.post('/income', auth, async (req, res) => {
  const { incomeName, incomeType, amount, hoursPerWeek } = req.body;
  const parsedAmount = parseFloat(amount);
  const { ok, hours } = parseIncomeHours(incomeType, hoursPerWeek);
 
  if (!incomeName || !VALID_INCOME_TYPES.includes(incomeType) || !(parsedAmount > 0) || !ok) {
    return res.redirect('/financials');
  }
 
  try {
    await db.none(
      `INSERT INTO userIncome (username, incomeName, incomeType, amount, hoursPerWeek)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.session.user.username, incomeName.trim(), incomeType, parsedAmount, hours]
    );
  } catch (err) {
    console.log('ERROR:', err.message || err);
  }
 
  res.redirect('/financials');
});

// Edit Income
app.post('/income/update', auth, async (req, res) => {
  const { incomeId, incomeName, incomeType, amount, hoursPerWeek } = req.body;
  const id = parseInt(incomeId, 10);
  const parsedAmount = parseFloat(amount);
  const { ok, hours } = parseIncomeHours(incomeType, hoursPerWeek);
 
  if (!Number.isInteger(id) || !incomeName || !VALID_INCOME_TYPES.includes(incomeType) || !(parsedAmount > 0) || !ok) {
    return res.redirect('/financials');
  }
 
  try {
    // Switching away from Hourly saves hoursPerWeek as NULL
    await db.none(
      `UPDATE userIncome
       SET incomeName = $1, incomeType = $2, amount = $3, hoursPerWeek = $4
       WHERE incomeID = $5 AND username = $6`,
      [incomeName.trim(), incomeType, parsedAmount, hours, id, req.session.user.username]
    );
  } catch (err) {
    console.log('ERROR:', err.message || err);
  }
 
  res.redirect('/financials');
});

// Remove Income
app.post('/income/delete', auth, async (req, res) => {
  const id = parseInt(req.body.incomeId, 10);

  if (!Number.isInteger(id)) {
    return res.redirect('/financials');
  }

  try {
    await db.none(
      'DELETE FROM userIncome WHERE incomeID = $1 AND username = $2',
      [id, getUsername(req)]
    );
  } catch (err) {
    console.log('ERROR:', err.message || err);
  }

  res.redirect('/financials');
});



// Registration page
app.get('/register', no_auth, (req, res) => {
  res.render('pages/register.hbs');
});

// Registration submission
// app.post('/register', no_auth, async (req, res) => {
//   const pass = req.body.password;
//   const passConfirm = req.body.passwordConfirm;
//   const usr = req.body.username;
//   const usrName = req.body.name;
//   const email = req.body.email;

//   if (!pass || !passConfirm || !usr || !usrName || !email) {
//     return res.status(400).send('Please complete all registration fields.');
//   }

//   if (pass !== passConfirm) {
//     return res.status(400).send('Passwords do not match.');
//   }

//   try {
//     // Hash the user's password
//     const hash = await bcrypt.hash(pass, 10);

//     // Generate a secure verification token
//     const verificationToken = crypto.randomBytes(32).toString('hex');

//     // Hash the token before saving it in the database
//     const tokenHash = crypto
//       .createHash('sha256')
//       .update(verificationToken)
//       .digest('hex');

//     // Set token expiration to 24 hours
//     const tokenExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000);

//     // Insert the new user into the database
//     await db.none(
//       `INSERT INTO users
//        (username, email, name, password, email_verified,
//         verification_token, verification_token_expires)
//        VALUES ($1, $2, $3, $4, FALSE, $5, $6)`,
//       [usr, email, usrName, hash, tokenHash, tokenExpiration]
//     );

//     // Create the verification link
//     const verificationLink =
//       `${process.env.APP_URL}/verify-email?token=${verificationToken}`;

//     // Send the verification email
//     await transporter.sendMail({
//       from: process.env.EMAIL_FROM,
//       to: email,
//       subject: 'Verify Your BudgetApp Email',
//       text: `Hello ${usrName},

// Thank you for registering for BudgetApp!

// Please click the link below to verify your email address:

// ${verificationLink}

// This link expires in 24 hours.`,
//       html: `
//         <h2>Welcome to BudgetApp!</h2>
//         <p>Hello ${usrName},</p>
//         <p>Please click the link below to verify your email address.</p>
//         <a href="${verificationLink}">Verify My Email</a>
//         <p>This link expires in 24 hours.</p>
//       `,
//     });

//     // Tell the user to check their email
//     res.status(201).send(
//       'Account created! Please check your email to verify your account.'
//     );

//   } catch (err) {
//     console.log('Registration error:', err.message || err);
//     res.status(400).send(
//       'Registration failed. Please check your information and try again.'
//     );
//   }
// });

app.post('/register', no_auth, async (req, res) =>
{
  const pass = req.body.password;
  const passConfirm = req.body.passwordConfirm;
  const usr = req.body.username;
  const usrName = req.body.name;
  const email = req.body.email;

  const errMessage = validation.validateRegistration(pass, passConfirm, usr, usrName, email);
  // We have all the required data and it is formatted properly
  if(!errMessage)
  {
    try
    {
      // The username already exists
      if((await db.any("SELECT username FROM users WHERE username = $1", [usr])).length > 0)
      {
        res.status(400).render('pages/register.hbs', 
        {
          error: true,
          message: "Username already exists."
        });
      }
      // The email is already taken
      else if((await db.any("SELECT email FROM users WHERE email = $1", [email])).length > 0)
      {
        res.status(400).render('pages/register.hbs', 
        {
          error: true,
          message: "Email is taken."
        });
      }
      else
      {
        // The hashed password
        const hash = await bcrypt.hash(pass, 10);

        await db.none(
          `INSERT INTO users (username, email, name, password)
          VALUES ($1, $2, $3, $4)`,
          [usr, email, usrName, hash]
        );

        // Log the new user in with the same session shape as /login
        req.session.regenerate((err) => {
          if (err) {
            return res.status(500).send('Unable to start your session.');
          }

          req.session.user = { username: usr };

          req.session.save((err) => {
            if (err) {
              return res.status(500).send('Unable to save session.');
            }

            res.redirect(303, '/dashboard');
          });
        });
      }
    }
    catch (err)
    {
      console.error('Registration error:', err.message || err);
      res.status(400).render('pages/register.hbs', 
      {
        error: true,
        message: "There was a problem creating your account. Check all information."
      });
    }
    
  }
  else
  {
    res.status(400).render('pages/register.hbs', 
    {
      error: true,
      message: errMessage
    });
  }
});

// Email verification route
app.get('/verify-email', async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).send('Invalid verification link.');
  }

  try {
    // Hash the token received from the email
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Verify the token and update the user's account
    const result = await db.result(
      `UPDATE users
       SET email_verified = TRUE,
           verification_token = NULL,
           verification_token_expires = NULL
       WHERE verification_token = $1
       AND verification_token_expires > NOW()`,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      return res.status(400).send(
        'This verification link is invalid or has expired.'
      );
    }

    res.send('Your email has been successfully verified!');

  } catch (err) {
    console.log('Verification error:', err.message || err);
    res.status(500).send('Could not verify your email.');
  }
});


 // GET /login - Display the login page
app.get('/login', no_auth, (req, res) => {
    res.render('pages/login', {
        message: '',
        error: false
    });
});




 // POST /login - Authenticate the user
app.post('/login', no_auth, async (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
        return res.status(400).render('pages/login', {
            error: true,
            message: 'Enter a username and password.'
        });
    }

    try {
        const user = await db.oneOrNone(
            'SELECT username, password FROM users WHERE username = $1',
            [username]
        );

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).render('pages/login', {
                error: true,
                message: 'Incorrect username or password.'
            });
        }

        req.session.regenerate((err) => {
            if (err) {
                return res.status(500).send('Login failed.');
            }

            req.session.user = { username: user.username };

            req.session.save((err) => {
                if (err) {
                    return res.status(500).send('Unable to save session.');
                }

                res.redirect('/dashboard');
            });
        });

    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).render('pages/login', {
            error: true,
            message: 'Login failed. Please try again.'
        });
    }
});


// Convert one income source to a monthly amount.
// Hourly income = rate x hours per week x weeks per month (0 if no hours were saved).
const toMonthlyIncome = (income) => {
  const amount = Number(income.amount);
 
  switch (income.incometype) {
    case 'Hourly': {
      const hours = Number(income.hoursperweek);
      return hours > 0 ? amount * hours * WEEKS_PER_MONTH : 0;
    }
    case 'Weekly':
      return amount * WEEKS_PER_MONTH;
    case 'Bi-Weekly':
      return (amount * 26) / 12;
    case 'Monthly':
      return amount;
    default:
      return 0;
  }
};
 
// Convert one recurring expense schedule to a monthly amount.
const toMonthlyExpense = (schedule) => {
  const amount = Number(schedule.amount);
 
  switch (schedule.frequency) {
    case 'weekly':
      return amount * WEEKS_PER_MONTH;
    case 'biweekly':
      return (amount * 26) / 12;
    case 'monthly':
      return amount;
    case 'yearly':
      return amount / 12;
    default:
      return 0;
  }
};

const WEEKS_PER_MONTH = 52 / 12;

// Dashboard Route
app.get('/dashboard', auth, async (req, res) => {
  try {
 
    // 1. Identify the logged-in user
 
    const username = getUsername(req);
 
 
    // 2. Process recurring expenses
 
    await processRecurringExpenses(username);
 
 
    // 3. Get total savings
 
    const savingsRow = await db.one(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM userSavings
       WHERE username = $1`,
      [username]
    );
 
 
    // 4. Get income sources
    
 
    const incomes = await db.any(
      `SELECT incomeName, incomeType, amount, hoursPerWeek
       FROM userIncome
       WHERE username = $1
       ORDER BY incomeID DESC`,
      [username]
    );
 
 
    // 5. Get recorded expenses
    const expenses = await db.any(
      `SELECT expense_id,
              expense_name,
              amount,
              category
       FROM expenses
       WHERE username = $1
       ORDER BY expense_id DESC`,
      [username]
    );
 
    // 6. Get upcoming recurring expenses
 
    const recurringExpenses = await db.any(
      `SELECT recurring_expense_id,
              expense_name,
              amount,
              category,
              frequency,
              TO_CHAR(
                next_due_date,
                'YYYY-MM-DD'
              ) AS next_due_date
       FROM recurring_expenses
       WHERE username = $1
         AND active = TRUE
         AND next_due_date > CURRENT_DATE
       ORDER BY next_due_date ASC,
                recurring_expense_id ASC
       LIMIT 5`,
      [username]
    );
 
 
    
    // Every active recurring schedule counts toward the monthly net,
    // not just the five upcoming ones shown in the table.
    const activeSchedules = await db.any(
      `SELECT amount, frequency
       FROM recurring_expenses
       WHERE username = $1
         AND active = TRUE`,
      [username]
    );
 
 
    // 7. Format financial data
 
    const formatMoney = (amount) => {
      return Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };
 
 
    // Calculate total recorded expenses
    const totalExpenses = expenses.reduce(
      (total, expense) => total + Number(expense.amount),
      0
    );




    // Expected monthly net = monthly income - monthly recurring expenses
    const monthlyIncome = incomes.reduce(
      (total, income) => total + toMonthlyIncome(income),
      0
    );
 
    const monthlyRecurring = activeSchedules.reduce(
      (total, schedule) => total + toMonthlyExpense(schedule),
      0
    );
 
    const netMonthly =
      Math.round((monthlyIncome - monthlyRecurring) * 100) / 100;
 
    // Hourly incomes without saved hours cannot be estimated
    const incomesMissingHours = incomes.filter(
      (income) =>
        income.incometype === 'Hourly' && !(Number(income.hoursperweek) > 0)
    ).length;
 
 
    // Format income sources
    const formattedIncomes = incomes.map(income => ({
      name: income.incomename,
      type: income.incometype,
      amount: formatMoney(income.amount)
    }));



    // Format five most recently recorded expenses
    const recentExpenses = expenses.slice(0, 5).map(expense => ({
      description: expense.expense_name,
      category: expense.category,
      amount: formatMoney(expense.amount)
    }));
 
 
    // Format recurring expenses
    const formattedRecurringExpenses = recurringExpenses.map(expense => ({
      name: expense.expense_name,
      category: expense.category,
      amount: formatMoney(expense.amount),
      frequency: expense.frequency,
      nextDueDate: expense.next_due_date
    }));
 
 
    // =====================================
    // 8. Render Dashboard
    // =====================================
 
    res.render('pages/dashboard', {
 
      username: username,
 
      // Financial summary
      savingsAmount: formatMoney(savingsRow.total),
      totalExpenses: formatMoney(totalExpenses),
 
      // Expected monthly net (netMonthly is shown without a sign)
      netMonthly: formatMoney(Math.abs(netMonthly)),
      netIsPositive: netMonthly >= 0,
      monthlyIncome: formatMoney(monthlyIncome),
      monthlyRecurring: formatMoney(monthlyRecurring),
      incomesMissingHours: incomesMissingHours,
 
      // Income sources
      incomes: formattedIncomes,
 
      // Recent expenses
      recentExpenses: recentExpenses,
      hasExpenses: recentExpenses.length > 0,
 
      // Recurring expenses
      upcomingRecurringExpenses: formattedRecurringExpenses,
      hasUpcomingExpenses: formattedRecurringExpenses.length > 0
 
    });
 
  } catch (error) {
 
    console.error('Dashboard error:', error.message);
 
    res.status(500).render('pages/dashboard', {
 
      errorMessage: 'Unable to load your financial data.',
 
      username: '',
 
      savingsAmount: '0.00',
      totalExpenses: '0.00',
 
      netMonthly: '0.00',
      netIsPositive: true,
      monthlyIncome: '0.00',
      monthlyRecurring: '0.00',
      incomesMissingHours: 0,
 
      incomes: [],
 
      recentExpenses: [],
      hasExpenses: false,
 
      upcomingRecurringExpenses: [],
      hasUpcomingExpenses: false
 
    });
 
  }
});



// Log out the current user without affecting registration or login handling.
app.post('/logout', auth, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send('Unable to log out.');
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// *****************************************************
// Section 5 : Start Server
// *****************************************************

async function startServer() {
  const schema = readFileSync(path.join(__dirname, 'init_data', 'create.sql'), 'utf8');
  await db.tx(async transaction => {
    await transaction.one('SELECT pg_advisory_xact_lock(3308, 1)');
    await transaction.none(schema);
  });
  app.listen(3000, () => console.log('Server is listening on port 3000'));
}

startServer().catch(error => {
  console.error('Database initialization failed:', error.message);
  pgp.end();
  process.exitCode = 1;
});
