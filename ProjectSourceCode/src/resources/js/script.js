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