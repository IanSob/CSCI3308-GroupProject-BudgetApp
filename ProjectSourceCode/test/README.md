# Contracts:
## Registration
#### Endpoint:
Post /register
#### Request:
JSON containing name, username, email, password, and confirmPassword
#### Valid name:
A non-empty string
#### Valid username:
A non-empty string
#### Valid password:
A non-empty string
#### Valid confirmPassword:
A non-empty string that matches the password input
#### Valid email:
A non-empty string
#### Success:
201 and redirect to home page '/'
#### Missing any items:
400 and render /register page with message
#### Persistence
One row in users, password is stored as bcrypt hash