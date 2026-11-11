// Use this file to create validation functions

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

    return "";
}

module.exports.validateRegistration = validateRegistration;