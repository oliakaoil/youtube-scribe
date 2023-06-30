
global.__app_path = __dirname;
global.__public_path = __dirname + '/public';
global.__app_module_path = __dirname + '/app_modules';

var config = require('./config');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');

var app = express();

global.__environment = config.environment || 'development';
app.set('env',global.__environment);

process.title = config.processTitle;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// for development (favicon and other static paths are delivered via nginx in production)
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(logger('dev'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

if( __environment == 'development' && !config.memcached.force )
{
  app.use(session({
    secret: config.salt,
    proxy: true,
    resave: false,
    saveUninitialized: false
   }));
}
else
{
  var memcachedStore = require('connect-memcached')(session);

  app.use(session({
    secret: config.memcached.secret,
    key: config.memcached.key,
    proxy: true,
    resave: false,
    saveUninitialized: false,
    store: new memcachedStore({
      hosts: config.memcached.hosts
    })
  }));
};

app.use(function( req , res , next ){

  if(!req.session.csrfToken)
  {
    var md5 = require('md5');
    var uniqid = require('uniqid');
    req.session.csrfToken = md5( config.salt + uniqid() );
  }

  next();
});

app.use(function(req,res,next){
  console.log('adding config to res locals');
  res.locals.config = config;
  next();
});

require('./routes')( app , config );


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});
  
// extras for easier development 
if (app.get('env') === 'development') 
{
  app.locals.pretty = true;

  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      labels: config.labels,
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    labels: config.labels,
    message: err.message,
    error: {}
  });
});


module.exports = app;
