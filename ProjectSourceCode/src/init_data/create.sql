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