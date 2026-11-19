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
// Check if the username is properly formatted
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
// Regex for validating name
const nameRegEx = /^[^!"#$%&'()*+,\\\-.\/:;<=>?@[\]^_`{|}~0-9]*$/;
// Make sure the name does not have special characters or numbers
function validName()
{
    usrName = document.getElementById("name");
    usrNameValue = usrName.value;

    if(usrNameValue.length > 50)
    {
        usrName.setCustomValidity("Name must be less than 50 characters.");
    }
    else if(nameRegEx.test(usrNameValue))
    {
        usrName.setCustomValidity("");
    }
    else
    {
        usrName.setCustomValidity("Name must not contain special characters of numbers.");
    }
}

// Set the form action and title for the modal
// Also hide and not require / show and require depending on 'showItems' which are IDs
function setModalForm(showItems, formAction, modalTitle)
{
    hideables = [
        {wrapper: document.getElementById("emailWrapper"), input: document.getElementById("email")},
        {wrapper: document.getElementById("nameWrapper"), input: document.getElementById("name")},
        {wrapper: document.getElementById("usernameWrapper"), input: document.getElementById("username")},
        {wrapper: document.getElementById("passwordWrapper"), input: document.getElementById("password")},
        {wrapper: document.getElementById("passwordConfirmWrapper"), input: document.getElementById("passwordConfirm")}
    ];

    // Set the title of the modal
    document.getElementById("modalTitle").innerText = modalTitle;
    // Set the action of the form
    document.getElementById("settingsForm").setAttribute("action", formAction);

    for(i in hideables)
    {
        item = hideables[i]
        // Show and require showItems
        if(showItems.includes(item.wrapper.id))
        {
            item.wrapper.removeAttribute('hidden');
            item.input.setAttribute('required', true);
        }
        // Hide and not require non showItems
        else
        {
            item.wrapper.setAttribute('hidden', '');
            item.input.removeAttribute('required');
        }
    }
}