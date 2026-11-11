# Budget App - Flash Financial Savings

# Brief Application Description
Our Budget App, Flash Financial Savings, is a web application that helps users manage their personal finances 
by tracking income, savings, and expenses in one place.

# Contributors
- Saanvi Trivedi
- Ian Sobiech
- Akhil Sunkara
- Eesha Sivakumar
- David Pelphrey
- Abdul Hakeem

# Technology Stack Used

# Prerequisites to Run the Application
- Docker to run containers
- npm node modules (can use npm install on docker startup for first run)
- .env file with following: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, and SESSION_SECRET. You may set these how you wish but remember them for testing.
# How to Run the Application Locally
In the 'ProjectSourceCode' directory, run 'docker compose up -d' to run the application disconnected. You can then visit http://localhost:3000/ to see the website for the application.
# How to Run the Tests
Make sure you have mocha and chai npm dependencies installed. You can do this with either 'npm install --save-dev --save-exact mocha@10.8.2 chai@4.5.0 chai-http@4.4.0' or add 'npm install' to the package.json as a pre-start although some dependencies may be outdated. Before running the tests, you must install more dependencies to the local node_modules with 'docker compose -p lab10-tests -f docker-compose.test.yaml run --rm --no-deps tests npm ci'. You now may run the test with 'docker compose -p lab10-tests -f docker-compose.test.yaml up --abort-on-container-exit --exit-code-from tests'. After running tests, use 'docker compose -p lab10-tests -f docker-compose.test.yaml down' to stop the container and add '--volumes' to reset the volumes. If you run --volumes, be sure to run the local node_modules installation again before running the container.
# Link to the Deployed Application
Application still in development. Not currently deployed.