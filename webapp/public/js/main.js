
$(function(){

  var loadImgObj = $('#youtube-text img.ajax-loader');
  var idInputObj = $('input#youtube-id');
  var timerObj = $('#job-timer');

  idInputObj.focus();

  var getYoutubeId = function( url ){
    var matches = String( url ).match(/https?:\/\/(?:(?:(?:(?:www\.|m\.))?youtube\.com)|(?:youtu\.be))\/(?:(?:watch.*(?:\?|\&)v=([^&]+))|(?:(?:embed\/)?([a-z0-9\-_]+))|)/);
    if(!matches || !matches.length)
      return;

    // The ID can either be in the v= querystring paramter, or appended to the end, alone
    var youtubeId = matches.pop();
    if( youtubeId )
      return youtubeId;

    if( matches.length )
      return matches.pop();
  };

  var validYoutubeId = function( id ){
    return /[a-z0-9\-_]+/.test(id);
  };

  var logError = function( msg ) {
    $.post('/api/error',{ message: msg , youtubeId: idInputObj.val() } );
  }

  var setError = function( msg ) {
    if( msg )
      logError( msg );
    $('#error-message').html( msg );
  };
  var clearError = function() {
    setError('');
  };

  var loadVideo = function( youtubeId ) {

    var urlObj = $('#iframe-url');

    idInputObj.val('');
    urlObj.html('');

    var containerObj = $('#iframe-container');
    containerObj.empty();

    if(!youtubeId)
      return;

    var iframeUrl = 'https://www.youtube.com/embed/' + youtubeId;
    var iframeObj = $('<iframe id="video-loader" />');
    idInputObj.val( youtubeId );

    var linkHref = 'https://www.youtube.com/watch?v=' + youtubeId
    urlObj.html('<a href="'+linkHref+'" target="_blank">'+ linkHref +'</a>');

    iframeObj.attr({
      width: 280,
      height: 158,
      src: iframeUrl,
      frameborder: 0
    });

    containerObj.append( iframeObj );
  };

  var displayUpdatedJob = function( jobData ){

    var containerObj = $('#youtube-text');
    var jobStatus = Number( jobData.job_status );
    var statusText = '';
    var stopLoader = false;

    switch( jobStatus ){
      case 1:
        statusText = 'conversion job just started';
      break;
      case 2:
        statusText = 'pulling video down from Youtube';
      break;
      case 3:
        statusText = 'preparing audio files';
      break;
      case 4:
        statusText = 'converting audio to text';
      break;
      case 5:
        stopLoader = true;
        statusText = 'done!';
      break;  
      case 6:
        stopLoader = true;
        statusText = 'already converted';      
      break;              
      default:
        stopLoader = true;
        statusText = 'error';
        logError('Unknown job status | ' + JSON.stringify( jobData ));
      break;
    }

    if( stopLoader )
    {
      timerObj.timer('remove');
      loadImgObj.addClass('hidden');
    }

    if( jobData.text_parts )
    {
      var text = '';
      jobData.text_parts.map(function( text_part ){
        text += text_part.text;
      });
      $('.text' , containerObj).html( text );
    }

      
    $('#convert-status-message' , containerObj).html('<span class="bold">Job status:</span> '+ statusText );
  };

  var getJobUpdate = function( youtubeId ){

    $.get('/api/status/' + youtubeId , function( data ){

      displayUpdatedJob( data );

      // job not done and seemingly no problems
      if(jobInProgress( data ))
        setTimeout( function(){ 
          getJobUpdate( youtubeId );
        } , 5000 );
    });
  };

  var jobInProgress = function( jobData ) {
    return (typeof jobData == 'object' && jobData && jobData.job_status && Number(jobData.job_status) != 5);
  }

  var startConvert = function( youtubeId , youtubeTitle ){

    timerObj.timer('reset');

    $.post('/api/start/', { youtubeId: youtubeId , youtubeTitle: youtubeTitle } , function( data ){

      if( jobInProgress( data ) )
        getJobUpdate( youtubeId );
      else
        data.job_status = 6;

      displayUpdatedJob( data );


    });
  };

  var loadDoneJobs = function(){
    $.get('/api/list',function( data ){
      var listObj = $('#done-list .list');
      listObj.empty();
      $.each( data , function( index, doneJob ){
        listObj.append(''
          + '<div class="done-job">'
          + '  <span class="title clickable" data-id="'+ doneJob.youtube_id +'">' + doneJob.youtube_title + '</span>'
          + '</div>'
          );
      });

      $('.done-job .title' , listObj).each(function(){
        $(this).bind('click',function(){
          var youtubeId = $(this).data('id');
          var youtubeTitle = $(this).text();
          loadVideo( youtubeId );
          startConvert( youtubeId , youtubeTitle );
        });
      });
    });
  };

  $('input#generate-button').bind('click',function(){
    clearError();
    var youtubeId = idInputObj.val();
    if(!youtubeId)
      return;

    if( youtubeId.match(/^http/) )
      youtubeId = getYoutubeId( youtubeId );
     
    if(!youtubeId || !validYoutubeId( youtubeId ))
      return setError('Sorry but that doesn\'t seem like a valid Youtube URL or ID');

    $.get('https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=' + youtubeId + '&key=' + GOOGLE_API_KEY , function( data ){
      if(!data || !data.items || !data.items.length)
        return setError('Sorry but that video was not found');

      var snippet = data.items[0].snippet;
      var contentDetails = data.items[0].contentDetails;
      var timeParts = contentDetails.duration.match(/^PT([0-9]+)M([0-9]+)S/);
      var lengthSeconds = Number( timeParts.pop() );
      var lengthMins = Number( timeParts.pop() );

      if( (lengthMins * 60) + lengthSeconds > 600 )
        return setError('Sorry but right now this only works with videos that are 10 minutes or less, it seems like this one is ' + String(lengthMins) + ':' + String(lengthSeconds) + ' long');

      idInputObj.val( youtubeId );

      $(this).attr('disabled',true);

      loadImgObj.removeClass('hidden');

      loadVideo( youtubeId );
      startConvert( youtubeId , snippet.title );
    });
  });

  loadDoneJobs();
});
