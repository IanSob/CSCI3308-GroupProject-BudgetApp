const {expect} = require('chai');
const validation = require('../src/validation');

describe('Registration validation', () => {
  it('rejects a missing password', () => {
    expect(validation.validateRegistration(
        '', 
        'superSecretPass$58', 
        'bobiscool1', 
        'Bob', 
        'coolBobMail@fakedom.co'
        )).to.equal("Missing some required fields.");
  });
  it('rejects a password mismatch between password and confirm password', () => {
    expect(validation.validateRegistration(
        'superSecretPass$5', 
        'superSecretPass$58', 
        'bobiscool1', 
        'Bob', 
        'coolBobMail@fakedom.co'
        )).to.equal("Passwords do not match.");
  });
});