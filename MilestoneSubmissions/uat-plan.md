# User Acceptance Tests
 
## UAT 1: A user can create and login to an account
 
**Acceptance Criteria**
- The user can input the necessary account information and create that account on the register page.
- The user can login to the website using the username and password they registered with.
**Tests**
 
| Test ID | Feature / requirement | Acceptance criterion | Preconditions | Test data | User steps | Expected result | Tester ID | Actual result | Status | Issue / follow-up |
|---|---|---|---|---|---|---|---|---|---|---|
| UAT1-01 | Valid account registration | - The user inputs their account information and this creates that account.<br>- The user can login to the website using the username and password they registered with. | - The user is on the register page.<br>- No account exists with the test username | - A unique username.<br>- A valid email address.<br>- A valid password | - Open the register page.<br>- Enter name, username, valid email, and password.<br>- Submit the registration form<br>- Log out.<br>- Open the login page<br>- Enter the registered username and password<br>- Submit the login form | - Account is created and the home page opens<br>- User's details are saved to the database<br>- Login with the registered username and password succeeds and the home page opens | None | None | Not tested | None |
| UAT1-02 | Incomplete account registration validation | - When user inputs incomplete account information it notifies the user and lets them try again | - The user is on the register page<br>- An account with the test username already exists | - A username that is already registered<br>- A valid email address<br>- A valid password | - Open the register page.<br>- Enter username of the already-registered username, valid email, and password.<br>- Submit the registration form | - An error message states the username is already taken<br>- No new account is created and no duplicate record is saved to the database | None | None | Not tested | None |
 
## UAT 2: A user can input their expenses and they will be displayed on the financials page
 
**Acceptance Criteria**
- The user can input the name, cost, and frequency of an expense from the financials page.
- Expenses input are displayed as cards with the name, cost, and frequency of the expense shown.
**Tests**
 
| Test ID | Feature / requirement | Acceptance criterion | Preconditions | Test data | User steps | Expected result | Tester ID | Actual result | Status | Issue / follow-up |
|---|---|---|---|---|---|---|---|---|---|---|
| UAT2-01 | Site displays a correctly created expense | - The user inputs the name, cost, and frequency of an expense from the financials page.<br>- Expenses input are displayed as cards with the name, cost, and frequency of the expense shown. | - The user is logged in<br>- The user is on the financials page | - Name: Rent<br>- Cost: 1200<br>- Frequency: Monthly | - Open the financials page.<br>- Enter the expense name, cost, and frequency.<br>- Submit the expense | - The expense is accepted<br>- A card appears on the financials page showing the name (Rent), cost (1200), and frequency (Monthly) | None | None | Not tested | None |
| UAT2-02 | Incomplete expense input gives an error message | - If the user does not input the name, cost, or frequency of an expense from the financials page it sends an error and lets them retry. | - The user is logged in<br>- The user is on the financials page | - Name: Rent<br>- Cost: empty<br>- Frequency: Monthly | - Open the financials page.<br>- Enter the expense name, and frequency<br>- Submit the expense | - A validation error is shown stating the cost must be filled<br>- No expense card is created | None | None | Not tested | None |
 
## UAT 3: The user can view their saved financials when logging back into the application
 
**Acceptance Criteria**
- The user's expenses, savings, and income are saved in a database.
- When the user logs in, the financials page populates with their saved expenses, savings, and income.
**Tests**
 
| Test ID | Feature / requirement | Acceptance criterion | Preconditions | Test data | User steps | Expected result | Tester ID | Actual result | Status | Issue / follow-up |
|---|---|---|---|---|---|---|---|---|---|---|
| UAT3-01 | Saved financials load on login | - The user's expenses, savings, and income are saved in a database after logout.<br>- When the user logs in, the financials page populates with their saved expenses, savings, and income. | - The user is logged out<br>- The account has at least one saved expense, savings entry, and income entry | - The registered username and password<br>- Saved expense, savings, and income entries already entered | - Open the login page.<br>- Enter the registered username and password.<br>- Open the financials page | - Login succeeds<br>- The financials page shows all saved expenses, savings, and income<br>- Displayed values match the records stored in the database | None | None | Not tested | None |
| UAT3-02 | Financials don’t display if user is not logged in | - When the user logs out or launches the site without logging in they can’t access anyone's financials | - The user is logged out<br>- The account has saved financial data | - The direct URL of the financials page | - Without logging in, enter the financials page URL in the browse | - The user is redirected to the login page or shown an error that login is required<br>- No expenses, savings, or income are displayed | None | None | Not tested | None |
