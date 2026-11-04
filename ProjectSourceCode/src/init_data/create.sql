CREATE TABLE IF NOT EXISTS users
(
    username VARCHAR(50) PRIMARY KEY NOT NULL,
    email VARCHAR(300) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    password VARCHAR(60) NOT NULL
);

CREATE TABLE IF NOT EXISTS userSavings
(
    username VARCHAR(50) PRIMARY KEY NOT NULL,
    savings DECIMAL
);

CREATE TABLE IF NOT EXISTS expenses
(
    expense_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    expense_name VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    FOREIGN KEY (username) REFERENCES users(username)
);