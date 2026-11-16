// Use this file to create validation functions

// Regex
// For password validation
const hasSpecialChar = /[!"#$%&'()*+,\\\-.\/:;<=>?@[\]^_`{|}~]|[0-9]/;
const hasCapital = /[A-Z]/;
const hasLower = /[a-z]/;
const noInvalid8Chars = /^([!"#$%&'()*+,\\\-.\/:;<=>?@[\]^_`{|}~]|[0-9]|[A-z]){8,}$/;

// Checks for a properly inputted password
// Password must have 8 characters, an uppercase letter, a lowercase, and a digit or special character
function validatePassword(pass)
{
    // length = 1 so no newlines
    if(hasSpecialChar.test(pass) && hasCapital.test(pass) && hasLower.test(pass) && noInvalid8Chars.test(pass))
    {
        return "";
    }
    
    return "Invalid password."
}

// For username validation
usernameRegEx = /^[A-Za-z0-9\._]{3,50}$/

// Username must only contain capital or lowercase, periods, underscores, or numbers
function validateUsername(username)
{
    if(usernameRegEx.test(username))
    {
        return "";
    }

    return "Invalid username."
}

// Make sure all items are in the 
function validateRegistration (pass, passConfirm, usr, usrName, email)
{
    // One of the fields does not exist.
    if(!(pass && passConfirm && usr && usrName && email))
    {
        return "Missing some required fields.";
    }

    if(pass != passConfirm)
    {
        return "Passwords do not match.";
    }

    if((validPass = validatePassword(pass)))
    {
        return validPass;
    }

    if(validUser = validateUsername(usr))
    {
        return validUser;
    }

    return "";
}

module.exports.validateRegistration = validateRegistration;