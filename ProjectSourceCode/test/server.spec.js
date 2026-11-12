const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../app');
const {db, pgp} = require('../src/db');
const bcrypt = require('bcryptjs');

chai.use(chaiHttp);
const {expect} = chai;

// Root hook: close the shared database pool after all tests in this process.
// Keep other suites in this file or reuse these imports in separate files.
after(() => {
  pgp.end();
});

describe('Welcome route', () => {
  it('returns the default welcome message', async () => {
    const res = await chai.request(app).get('/welcome');
    expect(res).to.have.status(200);
    expect(res.body).to.deep.equal({
      status: 'success',
      message: 'Welcome!',
    });
  });
});

// Add your registration tests below.
describe('POST /register', () => {
  const {randomUUID} = require('node:crypto');
  const testUser = {
    name: 'Tim',
    email: 'fakeemail@g.testdom',
    username: `lab10_${randomUUID()}`,
    passwordConfirm: 'TestPassword123!',
    password: 'TestPassword123!'
  };

  const noPassTestUser = {
    name: 'Tim',
    email: 'fakeemail@g.testdom',
    username: `lab10_${randomUUID()}`,
    passwordConfirm: 'TestPassword123!'
  };

  async function removeTestUser() {
    await db.none('DELETE FROM users WHERE username = $1', [testUser.username]);
  }

  beforeEach(removeTestUser);
  afterEach(removeTestUser);

  it('creates exactly one user for valid input', async () => {
    // Act: submit the request through the actual registration route.
    const res = await chai.request(app).post('/register').send(testUser).redirects(0);
    // Assert: verify both the response and the saved record.
    expect(res).to.have.status(303);
    expect(res).to.have.header('location', '/');

    const rows = await db.any(
      'SELECT username, password, email, name FROM users WHERE username = $1',
      [testUser.username]
    );
    expect(rows).to.have.lengthOf(1);
    expect(rows[0].username).to.equal(testUser.username);
    expect(rows[0].email).to.equal(testUser.email);
    expect(rows[0].name).to.equal(testUser.name);
    expect(rows[0].password).not.to.equal(testUser.password);
    expect(await bcrypt.compare(testUser.password, rows[0].password)).to.equal(
      true
    );
  });

  // TODO: Add an async test that submits this username without a password.
  // Assert the documented rejection response and zero matching database rows.
  it('does not insert without username or password and returns message', async () => {
    // Act: submit the request through the actual registration route.
    const res = await chai.request(app).post('/register').send(noPassTestUser);
    // Assert: verify nothing was added
    expect(res).to.have.status(400);
    // Make sure a message is sent back to the user
    expect(res.text).to.include('Missing some required fields.');
    
    const rows = await db.any(
      'SELECT username FROM users WHERE username = $1',
      [noPassTestUser.username]
    );

    // No user was added
    expect(rows).to.have.lengthOf(0);
  });
});

// Extra credit
describe('POST /login', () => {
  const {randomUUID} = require('node:crypto');
  uid = randomUUID()
  const testUser = {
    name: 'Tim',
    email: 'fakeemail@g.testdom',
    username: `lab10_login_${uid}`,
    password: 'TestPassword123!',
    passwordConfirm: 'TestPassword123!'
  };

  const noPassTestUser = {
    name: 'Tim',
    email: 'fakeemail@g.testdom',
    password: 'TestPassword123!',
    passwordConfirm: 'TestPassword123!'
  };

  async function removeTestUser() {
    await db.none('DELETE FROM users WHERE username = $1', [testUser.username]);
  }

  beforeEach(removeTestUser);
  afterEach(removeTestUser);

  // Positive test
  it('logs the user in, saves their session, and redirects to somewhere besides /login', async () => {
    // Create the user using register and log out
    await chai.request(app).post('/register').send(testUser);
    await chai.request(app).get('/logout');
    // Act: submit the request through the actual login route.
    const res = await chai.request(app).post('/login').send(testUser).redirects(0);
    // Assert: make sure thes status is 302 and the redirect is not still the login page
    expect(res).to.have.status(302);
    expect(res).not.to.have.header('location', '/login');

    // session was saved
    expect(res).to.have.cookie('connect.sid');
  });

  // Negative test
  it('does not login without username and returns message', async () => {
    // Act: submit the request through the actual login route.
    const res = await chai.request(app).post('/login').send(noPassTestUser);

    // Assert: right response
    expect(res).to.have.status(400);
    // Make sure a message is sent back to the user
    expect(res.text).to.include('Enter a username and password.');
    
    //No session created
    expect(res).not.to.have.cookie('connect.sid');
  });
});