CREATE TABLE IF NOT EXISTS users
(
    username VARCHAR(50) PRIMARY KEY NOT NULL,
    email VARCHAR(300) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    password VARCHAR(60) NOT NULL
);

-- Email verification fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS verification_token TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP;

-- User savings table
CREATE TABLE IF NOT EXISTS userSavings
(
    username VARCHAR(50) PRIMARY KEY NOT NULL,
    savings DECIMAL
);

-- User income table
CREATE TABLE IF NOT EXISTS userIncome
(
    incomeID SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    incomeName VARCHAR(50) NOT NULL,
    incomeType VARCHAR(50) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0
);

-- User expenses table
CREATE TABLE IF NOT EXISTS expenses
(
    expense_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    expense_name VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    FOREIGN KEY (username) REFERENCES users(username)
);

-- Recurring expenses schedules
CREATE TABLE IF NOT EXISTS recurring_expenses
(
    recurring_expense_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    expense_name VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    category VARCHAR(50) NOT NULL,
    frequency VARCHAR(20) NOT NULL
        CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'yearly')),
    start_date DATE NOT NULL,
    next_due_date DATE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Tracks generated recurring payments to prevent duplicates
CREATE TABLE IF NOT EXISTS recurring_expense_payments
(
    payment_id SERIAL PRIMARY KEY,
    recurring_expense_id INTEGER NOT NULL
        REFERENCES recurring_expenses(recurring_expense_id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    expense_id INTEGER NOT NULL
        REFERENCES expenses(expense_id) ON DELETE CASCADE,
    UNIQUE (recurring_expense_id, due_date)
);