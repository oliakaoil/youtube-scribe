/**
 * Copyright 2016, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join( __dirname , '.env') });

const fs = require('fs');
const glob = require('glob');
const util = require('util');
const Speech = require('@google-cloud/speech');
require('shelljs/global');
const MongoClient = require('mongodb').MongoClient;

const youtube_dl = path.join( __dirname , 'youtube-dl' );
process.env['GOOGLE_APPLICATION_CREDENTIALS'] = path.join( __dirname , "service_account_file.json" );

// Instantiates a client
const speechClient = Speech({
  projectId: process.env.projectId,
  serverKey: process.env.serverKey
});

const JOB_STATUS_START = 1;
const JOB_STATUS_PULL = 2;
const JOB_STATUS_PREP = 3;
const JOB_STATUS_TRANS = 4;
const JOB_STATUS_DONE = 5;


module.exports = {

  JOB_STATUS_START: JOB_STATUS_START,
  JOB_STATUS_PULL: JOB_STATUS_PULL,
  JOB_STATUS_PREP: JOB_STATUS_PREP,
  JOB_STATUS_TRANS: JOB_STATUS_TRANS,
  JOB_STATUS_DONE: JOB_STATUS_DONE,

  extractText: function( filename , next ) 
  {
    console.log('extracting text from %s' , filename );

    // The audio file's encoding and sample rate
    var options = {
      encoding: 'LINEAR16',
      sampleRate: 16000
    };

    // Detects speech in the audio file
    speechClient.recognize( filename, options )
      .then(function(results){
        if( typeof next == 'function' )
          next( filename , results );
      });
  },

  downloadYoutubeAudio: function( youtube_id ) 
  {
    this.updateStatus( youtube_id , JOB_STATUS_PULL );

    var dlPath = util.format('%s/%s.wav' , process.env.tmp_path , youtube_id);

    if(fs.existsSync( dlPath ))
      return dlPath;

    var downloadCmd = util.format("%s -q -o '%s/%(id)s.%(ext)s' --extract-audio --audio-format wav https://www.youtube.com/watch?v=%s" , youtube_dl , process.env.tmp_path , youtube_id );
    
    console.log( downloadCmd );

    if( exec( downloadCmd ) )
      return dlPath;
    
    console.log('download and convert failed: %s' , downloadCmd);
    return false;
  },

  splitAudio: function( youtube_id , filepath ) 
  {
    this.updateStatus( JOB_STATUS_PREP );

    console.log(util.format('splitting %s' , filepath ));

    var self = this;
    var stats = exec(util.format('sox %s -n stat' , filepath )).stderr.split("\n");
    var length = Math.ceil( Number( stats[1].split(' ').pop() ) );

    var basepath = path.dirname( filepath );
    var filename = path.basename( filepath );
    var filenameParts = filename.split('.');
    var ext = filenameParts.pop();
    var filename = filenameParts.join('.');
    var counter = 0;
    var offset = 0;
    var splitFiles = [];

    do {

      var partFilename = filename + '-' + String( counter ) + '.' + ext;
      var partFilepath = path.join( basepath , partFilename );

      var offsetMinSec = self.makeMinSec( offset );
     
      var duration = 30;
      if( (offset + duration) > length )
        duration = length - offset;
      duration = self.makeMinSec( duration );

      var splitCmd = util.format('sox %s %s trim %s %s' , filepath , partFilepath , offsetMinSec , duration );
      console.log( splitCmd );
      exec( splitCmd );
      splitFiles.push( partFilepath );

      offset = offset + 30;
        if( !counter )
      offset += 1;
      counter += 1;

    } while( offset < length );


    return splitFiles;
  },

  convertToRaw: function( filepath )
  {
    var basepath = path.dirname( filepath );
    var filename = path.basename( filepath );
    var filenameParts = filename.split('.');
    var ext = filenameParts.pop();
    var filename = filenameParts.join('.');
    var output = path.join( basepath , filename + '.raw' );

    // http://stackoverflow.com/questions/4854513/can-ffmpeg-convert-audio-to-raw-pcm-if-so-how
    var cmd = util.format('sox %s -t raw --channels=1 --bits=16 --rate=16000 --encoding=signed-integer --endian=little %s' , filepath , output );
    console.log( cmd );
  
    if(fs.existsSync( output ))
      exec(util.format('rm %s' , output));

    exec( cmd );
    return output;
  },

  makeMinSec: function( sec )
  {
    var minutes = Math.floor( sec / 60 );
    var seconds = sec - ( minutes * 60 );
    return ("00" + String( minutes )  ).slice(-2) + ':' + ("00" + String( seconds )  ).slice(-2);
  },

  start: function( videoData , next, done )
  {
    var self = this;
    var youtube_id = videoData.id;

    self.get( youtube_id , function( doc ){

      if(doc)
      {
        if( typeof done == 'function' )
          done( doc );
        return doc; 
      }

      var jobData = {
        youtube_id: youtube_id,
        youtube_title: ( videoData.title || '' ),
        created: new Date(),
        text_parts: [],
        job_status: 1,
        convert_time: 0
      };

      if( typeof next == 'function' )
        next( jobData );


      MongoClient.connect( process.env.mongo_dsn , function(err, db) {
        
        db.collection('converts').insert( jobData , function(){

          var rawFilepath = self.downloadYoutubeAudio( youtube_id );
          var splitFiles = self.splitAudio( youtube_id , rawFilepath );

          if( splitFiles )
          {
            self.updateStatus( youtube_id , JOB_STATUS_TRANS );

            var counter = 0;

	       for( var index = 0; index < splitFiles.length; index++ ) 
	       {
	         var splitFile = splitFiles[ index ];
           var splitRawFile = self.convertToRaw( splitFile );

           self.extractText( splitRawFile , function( filename , results  ){

             MongoClient.connect( process.env.mongo_dsn , function(err, db) {

          		  self.get( youtube_id , function( doc ){

          		    doc.text_parts.push({ filename: filename , text: results[0] , created: new Date() });

                  // calculate total time to convert based on text part timestamps
                  var text_part_dates = [];
                  doc.text_parts.map(function( text_part ){
                    text_part_dates.push( text_part.created.getTime() );
                  });
                  text_part_dates.sort(function(a,b){
                    return a - b;
                  });

                  var convert_time = Number( text_part_dates.pop() ) - Number( doc.created.getTime() );

                  var updateData = { $set: { text_parts: doc.text_parts , convert_time: convert_time }  };


                  db.collection('converts').updateOne({ youtube_id: youtube_id  } , updateData , function(){
                    counter += 1;

                    if( counter == splitFiles.length )
                    {
                      self.updateStatus( youtube_id , JOB_STATUS_DONE , function(){
      	                console.log('done');
                        if( typeof done == 'function' )
                          done( doc );
                      });
                    }
                  });
  	            });
                });
              });
           };
          }  
        });
      });
    });
  },

  get: function( youtube_id , next )
  {
    MongoClient.connect( process.env.mongo_dsn , function(err, db) {
      db.collection('converts').findOne({ youtube_id: youtube_id }, function( err , doc ){
        next( doc );
      });
    });
  },

  updateStatus: function( youtube_id , job_status , next )
  {
    MongoClient.connect( process.env.mongo_dsn , function(err, db) {
      db.collection('converts').updateOne({ youtube_id: youtube_id }, { $set: { job_status: job_status  } } , function(){
	if( typeof next == 'function' )
          next();	
      });
    });
  },

  cleanup: function( youtube_id )
  { 
    glob( youtube_id + '*.raw' , { cwd: process.env.tmp_path } , function( err , files ){
      files.forEach( function( file ){
        console.log('rm -f ' + path.join( process.env.tmp_path , file ));
	exec('rm -f ' + path.join( process.env.tmp_path , file ) );
      });
    });
    
    glob( youtube_id + '*.wav' , { cwd: process.env.tmp_path } , function( err , files ){
      files.forEach( function( file ){
        console.log('rm -f ' + path.join( process.env.tmp_path , file ));
	exec('rm -f ' + path.join( process.env.tmp_path , file ) );
      });
    });
  }
}





