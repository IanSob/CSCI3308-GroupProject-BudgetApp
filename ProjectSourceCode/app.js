
// *****************************************************
// Section 1 : Import Dependencies
// *****************************************************

const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// *****************************************************
// Section 2 : Connect to DB
// *****************************************************

const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

const dbConfig = {
  host: 'db-test',
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

const db = pgp(dbConfig);

db.connect()
  .then(obj => {
    console.log('Database connection successful');
    obj.done();
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

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

// Shared display information for Handlebars. Route authorization stays unchanged.
app.use((req, res, next) => {
  res.locals.isAuthenticated = Boolean(req.session.user);
  res.locals.activeHome = req.path === '/';
  res.locals.activeDashboard = req.path === '/dashboard';
  res.locals.activeFinancials = req.path === '/financials';
  res.locals.activeExpenses = req.path === '/expenses';
  next();
});

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

// Home page
app.get('/', (req, res) => {
  res.render('pages/home.hbs');
});

// Expenses Display
app.get('/expenses', auth, async (req, res) => {
  try {
    const username = typeof req.session.user === 'string'
      ? req.session.user
      : req.session.user.username;

    const expenses = await db.any(
      `SELECT expense_id, expense_name, amount, category
       FROM expenses
       WHERE username = $1
       ORDER BY expense_id DESC`,
      [username]
    );

    const totalExpenses = expenses.reduce(
      (total, expense) => total + Number(expense.amount),
      0
    );

    res.render('pages/expenses.hbs', {
      expenses: expenses,
      hasExpenses: expenses.length > 0,
      totalExpenses: totalExpenses.toFixed(2),
    });
  } catch (err) {
    console.log('ERROR:', err.message || err);

    res.status(500).render('pages/expenses.hbs', {
      expenses: [],
      hasExpenses: false,
      totalExpenses: '0.00',
      errorMessage: 'Unable to load expenses right now.',
    });
  }
});

// Forgot Password Route, Saanvi
app.get('/forgot-password', (req, res) => {
  res.render('pages/forgot-password.hbs');
});

// Financials
app.get('/financials', async (req, res) => {
  try {
    // TEMP: hardcoded test user until login is merged
    const username = 'bobLovesdogs4';

    const savingsRow = await db.one(
      'SELECT savings FROM userSavings WHERE username = $1',
      [username]
    );

    const incomes = await db.any(
      'SELECT incomeName, incomeType, amount FROM userIncome WHERE username = $1',
      [username]
    );

    res.render('pages/financials', { savings: savingsRow.savings, incomes });
  } catch (err) {
    console.log('ERROR:', err.message || err);
    res.render('pages/financials', {
      savings: null,
      incomes: [],
      message: 'Could not load financial data.',
      error: true,
    });
  }
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

  // We have all the required data
  if(pass && passConfirm && usr && usrName && email)
  {
    // Passwords do not match
    if(pass != passConfirm)
    {
      req.status(400).send("Passwords do not match!");
    }
    // Passwords match
    else
    {
      // The hashed password
      const hash = await bcrypt.hash(pass, 10);

      try
      {
        const query = `INSERT INTO users (username, email, name, password)
        VALUES ('${usr}', '${email}', '${usrName}', '${hash}');`;

        await db.none(query);

        // Save the session after creating the account
        req.session.user = usr;
        req.session.save();

        // Redirect to the home page after account created
        res.status(201).redirect('/');
      }
      catch (err)
      {
        res.status(400).send("Problem creating user.");
      }
    }
  }
  else
  {
    res.status(400).send("Missing registration information!");
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
app.get('/login', (req, res) => {
    res.render('pages/login', {
        message: '',
        error: false
    });
});




 // POST /login - Authenticate the user
app.post('/login', async (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
        return res.render('pages/login', {
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
            return res.render('pages/login', {
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

app.get('/dashboard', auth, (req, res) => {
    res.send('Welcome to Budget Range Dashboard!');
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
// const app = require('./app');

module.exports = app;