// Check if the passwords match before submitting
function passwordMatch()
{
    // Our passwords
    pass = document.getElementById('password').value
    passConfirm = document.getElementById('passwordConfirm')

    // Make sure they match
    if(pass == passConfirm.value)
    {
        passConfirm.setCustomValidity("");
    }
    else
    {
        // Custom message for mismatch
        passConfirm.setCustomValidity("Passwords must match!");
    }
}


// Regex for validPassword()
const hasSpecialChar = /[!"#$%&'()*+,\\\-.\/:;<=>?@[\]^_`{|}~]|[0-9]/;
const hasCapital = /[A-Z]/;
const hasLower = /[a-z]/;
const noInvalidChars = /^([!"#$%&'()*+,\\\-.\/:;<=>?@[\]^_`{|}~]|[0-9]|[A-z])*$/;
// Displays info on invalid passwords
function validPassword()
{
    passElement = document.getElementById('password');
    pass = passElement.value;

    // Password must be length 8 or more
    if(pass.length < 8)
    {
        passElement.setCustomValidity("Password must be at least 8 characters long.");
    }
    // Password must have a special character or number
    else if(!hasSpecialChar.test(pass))
    {
        passElement.setCustomValidity("Password must have a special character or number.");
    }
    // Password must have an uppercase
    else if(!hasCapital.test(pass))
    {
        passElement.setCustomValidity("Password must have an uppercase letter.");
    }
    // Password lacks a lowercase letter
    else if(!hasLower.test(pass))
    {
        passElement.setCustomValidity("Password must have a lowercase letter.");
    }
    // Password is valid
    else if(noInvalidChars.test(pass))
    {
        passElement.setCustomValidity("");
    }
    else
    {
        passElement.setCustomValidity("Password contains an invalid character.");
    }
}

// RegEx for valid username
const userRegEx = /^[A-Za-z0-9\._]{3,50}$/

function validUsername()
{
    usr = document.getElementById('username');
    usrValue = usr.value;

    if(usrValue.length < 3)
    {
        usr.setCustomValidity("Username is too short.");
    }
    else if(usrValue.length > 50)
    {
        usr.setCustomValidity("Username is too long.");
    }
    else if(userRegEx.test(usrValue))
    {
        usr.setCustomValidity("");
    }
    else
    {
        usr.setCustomValidity("Username contains an invalid character.");
    }
}