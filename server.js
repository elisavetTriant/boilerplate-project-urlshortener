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
mongoose.connect(db, { useNewUrlParser: true, useUnifiedTopology: true });

//Create schema
const Schema = mongoose.Schema;
const urlSchema = new Schema({
  original_url: {
    type: String,
    index: true,
    unique: true
  },
  short_url: {
    type: String,
    unique: true,
    index: true, // TODO see why it's deprecated
    default: () => nanoid()
  }
});

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

//POST endpoint TODO rewrite with try-catch
app.post("/api/shorturl", function (req, res, next) {
  let t = setTimeout(() => {
    next({ message: "timeout" });
  }, TIMEOUT);
  
  testUrlAddress = req.body.url

  if (validate({website: testUrlAddress }, {website: {url: true}}) === undefined){
    
    const urlObject = new URL(testUrlAddress);
    
    dns.lookup(urlObject.hostname, (err, address, family) => {
    if (err) {
       res.status(200).json({ error: 'invalid url' });
    } else {
      if (mongoose && mongoose.connection.readyState) {     
      const testUrlDocument = new Url({'original_url': testUrlAddress});
      
      Url.exists({original_url:testUrlAddress}, function (err, docExists) {
          if (err) return console.log(err)
            
            if (!docExists) { //create new record
              testUrlDocument.save(function(err, data){
                if (err) return console.error(err);
                //no error here, continue with logic
                //get the id of the record we just created
                  const {original_url, short_url, ...rest} = data;
                  res.status(200).json({ original_url : original_url, short_url: short_url });
                })

            } else { //Fetch existing         
              Url.findOne({original_url : testUrlAddress}, function(err, urlRetreived){
                if(err) return console.log(err);
                const {original_url, short_url, ...rest} = urlRetreived;
                res.status(200).json({ original_url : original_url, short_url : short_url });
              })
            }
        })
      } else {
      res.status(200).json({ error: 'Could not connect to the database.' });
      }
    }
  })
  }else {
     res.status(200).json({ error: 'invalid url' });
  }
  
});

app.get('/api/shorturl/:url', (req, res, next) => {
  const url = req.params.url;
  Url.findOne({ short_url: url })
  .then((url) => {
    if (!url) { throw new Error('Url is not found on database'); }
    res.redirect(url.original_url);
   })
   .catch(err => res.status(200).json({ error: err.message }));
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
})
