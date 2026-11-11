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
    const res = await chai.request(app).post('/register').send(testUser);
    // Assert: verify both the response and the saved record.
    expect(res).to.have.status(201);
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
  it('submits without username or password', async () => {
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