// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars'); //to enable express to work with handlebars
const Handlebars = require('handlebars'); // to include the templating engine responsible for compiling templates
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// Include our javascript and stylesheet and images
app.use(express.static(__dirname + '/resources'));

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

const auth = (req, res, next) => {
  if (!req.session.user) {
    // Default to login page.
    return res.redirect('/login');
  }
  next();
};

// A function that checks if the user has a session and if they do, redirect them to default page
// This is useful for pages that expect you to be logged out to use like register or login
const no_auth = (req, res, next) => 
{
  if(req.session.user)
  {
    return res.redirect('/')
  }
  next();
};

app.get('/', (req, res) =>
{
    res.render('pages/home.hbs')
});

app.get('/financials', async (req, res) => {
  try {
    const username = 'bobLovesdogs4'; 

    const row = await db.one(
      'SELECT savings FROM usersavings WHERE username = $1',
      [username]
    );
    res.render('pages/financials', { savings: row.savings });
  } catch (err) {
    console.log('ERROR:', err.message || err);
    res.render('pages/financials', {
      savings: null,
      message: 'Could not load savings.',
      error: true,
    });
  }
});

app.get('/register', no_auth, (req, res) =>
{
  res.render('pages/register.hbs');
});

app.post('/register', no_auth, async (req, res) =>
{
  const pass = req.body.password;
  const passConfirm = req.body.password;
  const usr = req.body.username;
  const usrName = req.body.name;
  const email = req.body.email;

  // We have all the required data
  if(pass && passConfirm && usr && usrName && email)
  {
    // Passwords do not match
    if(pass != passConfirm)
    {
      req.status(400).redirect('/register');
    }
    // Passwords match
    else
    {
      // The hashed password
      const hash = await bcrypt.hash(pass, 10);

      try
      {
        const query = `INSERT INTO users (username, email, name, password)
        VALUES ('${usr}', '${email}', '${usrName}', '${hash}');`;

        await db.none(query);

        // Save the session after creating the account
        req.session.user = usr;
        req.session.save();

        // Redirect to the home page after account created
        res.status(201).redirect('/');
      }
      catch (err)
      {
        res.status(400).redirect('/register');
      }
    }
  }
});

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');