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
# Running:
Make sure you have mocha and chai npm dependencies installed. You can do this with either 'npm install --save-dev --save-exact mocha@10.8.2 chai@4.5.0 chai-http@4.4.0' or add 'npm install' to the package.json as a pre-start although some dependencies may be outdated. Before running the tests, you must install more dependencies to the local node_modules with 'docker compose -p lab10-tests -f docker-compose.test.yaml run --rm --no-deps tests npm ci'. You now may run the test with 'docker compose -p lab10-tests -f docker-compose.test.yaml up --abort-on-container-exit --exit-code-from tests'. After running tests, use 'docker compose -p lab10-tests -f docker-compose.test.yaml down' to stop the container and add '--volumes' to reset the volumes. If you run --volumes, be sure to run the local node_modules installation again before 