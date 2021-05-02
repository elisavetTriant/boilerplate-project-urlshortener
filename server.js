require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
var dns = require('dns');
const { nanoid } = require('nanoid');
const url = require('url');
const validate = require('validate.js');

// global setting for safety timeouts to handle possible
// wrong callbacks that will never be called
const TIMEOUT = 10000;

/*------------- Database Related Configuration ---------------------*/

const db = process.env['MONGO_URI'];

//Require mongoose
let mongoose;
try {
  mongoose = require("mongoose");
} catch (e) {
  console.log(e);
}

//Connect to the db
mongoose.connect(db, { useNewUrlParser: true, useUnifiedTopology: true, autoIndex: false});

//Create schema
const Schema = mongoose.Schema;
const urlSchema = new Schema({
  original_url: {
    type: String,
    unique: true
  },
  short_url: {
    type: String,
    unique: true,
    default: () => nanoid()
  }
});

//Creating compound index - schema wide
urlSchema.index({ original_url: 1, short_url: 1 });

//Create model
const Url = mongoose.model("Url", urlSchema);

// Basic Configuration
const port = process.env.PORT || 3000;

//No need for body-parser in this version of express
//use this instead
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use('/public', express.static(`${process.cwd()}/public`));


//Endpoints

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.status(200).json({ greeting: 'hello API' });
});

//why not create an endpoint to check availability of DB sever?
app.get("/api/is-mongoose-ok", function (req, res) {
  if (mongoose) {
    res.status(200).json({ isMongooseOk: !!mongoose.connection.readyState });
  } else {
    res.status(200).json({ isMongooseOk: false });
  }
});

app.post("/api/shorturl", function (req, res, next) {
  let t = setTimeout(() => {
    next({ message: "timeout" });
  }, TIMEOUT);

  const urlToTest = req.body.url;

  try {
    //TODO evaluate other libraries for validation
    if (validate({website: urlToTest }, {website: {url: true}}) !== undefined)        throw new Error('Invalid URL');

    const urlObject = new URL(urlToTest);

    dns.lookup(urlObject.hostname, (err, address, family) => {
      if (err) throw err;
    
      if (mongoose && mongoose.connection.readyState) {
        Url.findOne({original_url: urlToTest})
        .then(urlFound => {
          if (urlFound) return urlFound; //is there one in the database? Return
          return Url.create({'original_url': urlToTest}); //continue with saving the record
        })
        .then(url => {
          const {original_url, short_url} = url;

          res.status(200).json({ original_url : original_url, short_url : short_url });
        })
        .catch(err => res.status(200).json({ error: err.message }));

      } else {
        throw new Error('Could not connect to the database.');
      }
    })
  }catch (error) {
    console.log(error);
    res.status(200).json({ error: error.message });
  }
  
});

app.get('/api/shorturl/:url', (req, res, next) => {
  const { url } = req.params;
  Url.findOne({ short_url: url })
  .then(url => {
    if (!url) { throw new Error('Url is not found in database'); }
    res.redirect(url.original_url);
   })
   .catch(err => res.status(200).json({ error: err.message }));
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
})