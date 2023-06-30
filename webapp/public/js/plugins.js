

String.prototype.ucfirst = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

function parseQuerystring( str )
{
  var vals = {};

  if(!str)
    return vals;

  var str_parts = str.replace(/^#/,'').split('&');
  var val_parts,val;

  for( var x = 0; x < str_parts.length; x++ )
  {
    val_parts = str_parts[ x ].split('=');
    val = val_parts.length == 2 ? decodeURIComponent( val_parts[1] ) : '';
    vals[ val_parts[0] ] = val;
  }
  return vals;
}

function getLocationHashParams()
{ 
  if(!window.location.hash)
    return {};

  return parseQuerystring( window.location.hash.substr(1) );
}

function makeQuerystring( params )
{
  if(!params)
    params = getLocationHashParams();

  var querystring = [];

  for( var prop in params )
  {
    querystring.push( prop + '=' + encodeURIComponent( params[prop]) );
  }

  return querystring.join('&');  
}

function setLocationHash( params )
{
  window.location.hash = makeQuerystring( params );
}