<!-- @format -->

## Overview

This project is a proof of concept to test the voracity of the new Google Cloud Speech API against Google content (i.e. Youtube videos). Scribe contains two separate Node.js apps. The first (./converter) is a command-line utility which extracts the audio from Youtube videos and transcribes it to text. This process is managed by a simple MongoDB-based queueing system. The second app (./webapp) is a Web front-end which interfaces with the command-line utility, shows job status information and a list of previously transcribed videos. Read on for installation and other details.

## Converter

The converter is a Node.js command-line utility which takes a Youtube ID as input, downloads the related video, extracts and converts the audio, sends it to the Google Cloud Speech API for processing, and stores the results in a MongoDB database. It has 4 dependencies which are not managed by npm and need to be installed separately:

- [Youtube-dl](https://rg3.github.io/youtube-dl/)
- [SoX](http://sox.sourceforge.net/)
- [FFMpeg](https://ffmpeg.org/)
- [MongoDB](https://www.mongodb.com/community)

The only above dependency which comes with this repository is Youtube-dl. There is a configuration option in ./converter/index.js to indicate the path to that executable. Both SoX and FFMpeg should be accessible from the path of the user executing the converter script. A MongoDB service is required and the connection can be configured in the environment file.

Please refer to the project pages for each of these for installation instructions, as they may vary significantly depending on your platform. They are required to download Youtube videos, exract the audio into separate file and convert that audio file into a specific RAW format, respectively.

After installing the above, do this:

    cd ./converter
    npm install
    cp .env.template .env

And then enter your credentials into the .env file. You will need a Google Cloud account with access to the Google Cloud Speech API turned on. Lastly, the app is expecting a service account file named service_account_file.json to be present in ./converter, per https://developers.google.com/identity/protocols/application-default-credentials.

Afterwards, it's strongly recommended that you test the converter on the commandline using a short Node.js script like this:

    // node ./test.js

    const converter = require('./converter');

    converter.start({ id: '52VYxUHjfQE' }, function( jobData ){

        console.log('next');
        console.log( jobData );

      }, function( jobData ){

        console.log('done');
        console.log( jobData );

      });

## Web front-end

The Web front-end is a simple ExpressJS web app with separate config and route files. To install this app:

    cd ./webapp
    npm install
    cp config.template.js config.js

And then add your keys and connection parameters to the config.js file. In particular you will need to generate a unique salt, session secret, and MongoDB connection credentials. Afterwards you can start the app by doing this:

    cd ./webapp
    npm start

This should get the app listening on a local port. Note that the app uses SASS for CSS, and runs under Nginx in production. To that end, there is an included PM2 (http://pm2.keymetrics.io/) start script which is handy for Grunt and other task runner integration in development, and for stability and monitoring in production.
