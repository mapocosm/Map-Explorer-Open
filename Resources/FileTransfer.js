/* 
 * file: FileTransfer.js
 * 
 * --------------------------------------------------------------------------------------
 * 
 * Copyright (c) 2012 by Mapocosm
 * http://www.mapocosm.com/
 * Map Explorer Open
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this 
 * software and associated documentation files (the "Software"), to deal in the Software 
 * without restriction, including without limitation the rights to use, copy, modify, 
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to 
 * permit persons to whom the Software is furnished to do so, subject to the following 
 * conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all copies or 
 * substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR 
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE 
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR 
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 * --------------------------------------------------------------------------------------
 * 
 * FileTransfer.js is a module for downloading files
 * 
 * Two objects are exported:
 *   - fetch, get a remote URL and return an object containing the contents
 *   - fetchToFile, get a remote URL and save to the local path specified
 */

var Util = require( 'UtilityFunctions' ); 

var fetcherPool = new Array();
var cleanPoolPending = false;

function cleanPool()
{
	if ( fetcherPool.length == 0 ) {
		cleanPoolPending = false;
		return;
	}
	var now = Date.now();
	for ( var i = fetcherPool.length - 1; i >= 0; i-- ) {
		if ( fetcherPool[i].age() > 0 && ( now - fetcherPool[i].age() ) > 5000 ) {
			fetcherPool[i].clean();
			fetcherPool.splice( i, 1 );
		}
	}
	cleanPoolPending = true;
	setTimeout( cleanPool, 6000 );
}

exports.fetch = function( urlSource, maxWait, bSendProgress, callForUpdate )
{
	var totalSize = 0, bStopProgress = false, bActive = true, bProgUpdates = false;
	var callback = null, url = null, xhr = null, mrustamp = 0;
	
	function xhr_onload( event )
	{
		bStopProgress = true;
		if ( bProgUpdates && !!callback ) callback( { progress: totalSize } );
		if ( !!event.source && !!callback ) {
       		callback( { headers: event.source.allResponseHeaders, xhr:event.source, 
        		data: event.source.responseData, size: totalSize, source: url } );
       	}
    	bActive = false;
       	mrustamp = Date.now();
       	if ( !cleanPoolPending ) cleanPool();
	}
	function xhr_onerror( event )
	{
		bStopProgress = true;
        Ti.API.debug( 'FileTransfer fetch: ERROR, ' + event.statusText );
        if ( !!callback ) callback( { error: event.error, source: url } );
    	bActive = false;
       	mrustamp = Date.now();
       	if ( !cleanPoolPending ) cleanPool();
	}
	function xhr_ondatastream( event )
	{
		totalSize = event.totalSize;
	}
	function xhr_onreadystatechange( event )
	{
		// used for debugging only
		switch(this.readyState) {
		case Ti.Network.HTTPClient.UNSENT:
			Ti.API.debug('>>	xhr_onreadystatechange: UNSENT' );
			break;
		case Ti.Network.HTTPClient.OPENED:
			Ti.API.debug('>>	xhr_onreadystatechange: OPENED' );
			Ti.API.debug('>>	location = ' + event.source.location );
			break;
		case Ti.Network.HTTPClient.HEADERS_RECEIVED:
			Ti.API.debug('>>	xhr_onreadystatechange: HEADERS_RECEIVED' );
			Ti.API.debug('>>	status = ' + event.source.status  + ' ' + event.source.statusText );
			Ti.API.debug('>>	headers = \n' + event.source.allResponseHeaders );
			break;
		case Ti.Network.HTTPClient.LOADING:
			Ti.API.debug('>>	xhr_onreadystatechange: LOADING' );
			break;
		case Ti.Network.HTTPClient.DONE:
			Ti.API.debug('>>	xhr_onreadystatechange: DONE' );
			break;
		}
	}
	function sendProgress()
	{
		if ( bStopProgress )
			return;
        if ( !!callback ) callback( { progress: totalSize } );
		setTimeout( sendProgress, 250 );
	}
	this.stop = function()
	{
		bStopProgress = true;
		if ( !!xhr ) xhr.abort();
	}
	this.progress = function()
	{
		return totalSize;
	}
	this.age = function()
	{
		return mrustamp;
	}
	this.clean = function()
	{
		callback = null; url = null; xhr = null;
	}
	function processRequest( pr_urlSource, pr_maxWait, pr_bSendProgress, pr_callForUpdate )
	{
		bActive = true; bStopProgress = false; bProgUpdates = pr_bSendProgress;
		mrustamp = 0; totalSize = 0; callback = pr_callForUpdate;
		url = pr_urlSource;
	    xhr.timeout = !!pr_maxWait ? pr_maxWait : 10000
		xhr.open( 'GET', url );
		xhr.send();
		if ( bProgUpdates ) setTimeout( sendProgress, 250 );
	}
	this.isActive = function()
	{
		return bActive;
	}
	this.request = processRequest;
	
	xhr = Ti.Network.createHTTPClient( {
	    onload: xhr_onload,
	    onerror: xhr_onerror,
	    ondatastream: xhr_ondatastream
	    // insert the following for debugging XHR
	    // , onreadystatechange: xhr_onreadystatechange
	} );
	
	if ( urlSource != null ) {
		processRequest( urlSource, maxWait, bSendProgress, callForUpdate );
	}
}

exports.fetchToFile = function( urlSource, localFile, callWhenLoaded )
{
	function fetchResponse( response ) 
	{
		var fetched = null;
		if ( !!response.data  || !!response.error ) {
			for ( var i = 0, l = fetcherPool.length; i < l; i++ ) {
				if ( fetcherPool[i].source == response.source ) {
					fetched = fetcherPool[i];
					break;
				}
			}
			if ( fetched == null ) {
				Ti.API.debug( 'fetchToFile ERROR: null result from fetchResponse' );
		        return;
			}
		}
		if ( !!response.error ) {
	        if ( !!fetched.callback ) fetched.callback( { error: response.error } );
	        return;
		}
		if ( !!response.data ) {
			try {
				fetched.file.write( response.data );
				if ( !!fetched.callback ) fetched.callback( { 
					path: fetched.file.nativePath, size: response.size } ); 
			}
			catch ( writeError ) {
				if ( !!fetched.callback ) fetched.callback( { error: writeError } );
			}
			fetched.file = null; response.data = null; response.text = null; response.headers = null;
			return;
		}
	}
	
	var fetcher = null;
	for ( var i = 0, l = fetcherPool.length; i < l; i++ ) {
		if ( !fetcherPool[i].isActive() ) {
			fetcher = fetcherPool[i];
			break;
		}
	}
	if ( fetcher == null ) {
		fetcher = new exports.fetch( null, 0, false, null );
		fetcherPool.push( fetcher );  
	}
	fetcher.source = urlSource;
	fetcher.file = localFile;
	fetcher.callback = callWhenLoaded; 
	fetcher.request( urlSource, 10000, false, fetchResponse );
}

var CACHE_FOLDER = 'cache';
var cacheIndexName = 'cacheIndex.json';
var cacheWritePending = false;
var cacheWriteBackPeriod = 5000; // ms

var cacheIndexFile = Ti.Filesystem.getFile( Ti.Filesystem.applicationDataDirectory, CACHE_FOLDER, cacheIndexName );
var cacheIndex = cacheIndexFile.exists() ? JSON.parse( cacheIndexFile.read() ) : {};

/* cacheIndex properties:
 * remoteURL (string, primary key)
 * localPath (string)
 * lastModified (number)
 * timeStamp (number)
 */

function cacheWriteBack()
{
	if ( cacheWritePending )
		return;
	cacheWritePending = true;
	setTimeout( function() {
		try {
			cacheIndexFile.write( JSON.stringify( cacheIndex ) );
			cacheWritePending = false;
		}
		catch( writeError ) {
			Ti.API.debug( 'cacheWriteBack WRITE ERROR: ' + writeError );
		}
	}, cacheWriteBackPeriod );
}

exports.getCachedFile = function( urlSource )
{
	var cacheEntry = cacheIndex[ urlSource ];
	if ( !cacheEntry )
		return null;
	var localFile = cacheEntry.localPath;
	if ( !localFile )
		return null;
	var cachedFile = Ti.Filesystem.getFile( localFile );
	return cachedFile.exists() ? cachedFile : null;
}

function indexCacheFile( urlSource, cachedLocalPath, header )
{
	var modified = new Date( Util.extractProperty( header, 'Last-Modified' ) );
	cacheIndex[ urlSource ] = {
		timeStamp:    Date.now(),
		lastModified: modified.getTime(),
		localPath:    cachedLocalPath
	}
}

function makeFilenameCode( localPath )
{
	var pathParts = localPath.split( '.' );
	extension = pathParts.length > 1 ? ( '.' + pathParts[ pathParts.length - 1 ] ) : ''; 
	return Util.shortTimeCode() + extension; 
}

//cacheFile returns a local file when cached, or returns the original url if not yet cached.
//the callback function callWhenLoaded is called when the remote file has been loaded.
//callWhenLoaded returns null if there was an error
exports.cacheFile = function( urlSource, callWhenLoaded )
{
	// do we have a cache record?
	var localFile = exports.getCachedFile( urlSource );
	if ( !!localFile ) {
		return localFile.nativePath; // need to do timestamp check?
	}

	var filename = makeFilenameCode( urlSource ); 
	var cachedFile = Ti.Filesystem.getFile( Ti.Filesystem.applicationDataDirectory, CACHE_FOLDER, filename );

	// the file is not cached...
	exports.fetch( urlSource, 20000, false, function( response ) {
		if ( !!response.error ) {
			Ti.API.debug( 'cacheFile: failed to download ' + urlSource );
	        // put in try-again code??
			return;
		}
		if ( !!response.data ) {
			try {
				cachedFile.write( response.data );
			}
			catch ( writeError ) {
				Ti.API.debug( 'cacheFile WRITE ERROR: ' + writeError )
			}
			// cachedFile.setRemoteBackup( false );
			indexCacheFile( urlSource, cachedFile.nativePath, response.headers );
	        if ( !!callWhenLoaded ) {
	    		callWhenLoaded( cachedFile.nativePath, response.size );
	        }
	        cacheWriteBack();
		}
	} );
	return cachedFile.nativePath;
}
