
var sortTextParts = function( a , b ){

  var a_num = Number( a.filename.match(/^[^\.]+\-([0-9]+)\.raw/)[1] );
  var b_num = Number( b.filename.match(/^[^\.]+\-([0-9]+)\.raw/)[1] );

  if( a_num == b_num )
    return 0;

  return a_num > b_num ? 1 : -1;
};


module.exports = function( app , config ){

  app.get('/', function (req, res) {
    res.render('index');
  });

  app.post('/api/error', function( req , res ){
    console.error('Youtube conversion error | id %s | message %s' , req.body.youtubeId , req.body.message );
    res.json();
    res.end();
  });

  app.get('/api/list' , function( req , res ){

    var MongoClient = require('mongodb').MongoClient;
    var convert = require('../converter');

    MongoClient.connect( config.mongodb_dsn , function(err, db) {

      db.collection('converts').find( { job_status: convert.JOB_STATUS_DONE } , { youtube_id: true, youtube_title: true } , { sort: [['created','desc']] , limit: 100 } , function( err , docs ){
        docs.toArray(function( err , docs ){
          res.json( docs );
          res.end();
        });
      });
    });

  });

  app.post('/api/start' , function( req , res ){

    var next = function( doc ){

      doc = ( doc ? doc : {} );

      if( doc.text_parts )
        doc.text_parts.sort( sortTextParts );

      res.json( doc );
      res.end();

    };

    require('../converter').start( { id: req.body.youtubeId , title: req.body.youtubeTitle }  , next , next );
  });

  app.get('/api/status/:youtubeId' , function( req , res ){

    var MongoClient = require('mongodb').MongoClient;

    MongoClient.connect( config.mongodb_dsn , function(err, db) {

      db.collection('converts').findOne( { youtube_id: req.params.youtubeId } , function( err , doc ){

        if( err ) {
          res.json({ error: 1 });
          res.end();
          return;
        }

        if( doc.text_parts )
          doc.text_parts.sort( sortTextParts );

        res.json( doc );
        res.end();
      });
    });

  });
};