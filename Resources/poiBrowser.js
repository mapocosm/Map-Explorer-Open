/*
 * file: poiBrowser.js
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
 * poiBrowser.js is a module that opens a web browser view or an image viewer.
 * Two objects are exported:
 *   - webPageViewer, opens a local file or external URL in a web view
 *   - popupImageViewer, opens a local or remote picture in an image viewer
 *   
 */

var Util = require( 'UtilityFunctions' ); 
var FileX = require( 'FileTransfer' );

var appCssFile = Ti.Filesystem.getFile( Ti.Filesystem.resourcesDirectory, 'app.css' );
var htmlPrefix = '<html><head><link rel="stylesheet" type="text/css" href="' + appCssFile.nativePath + '"/></head><body>';
var htmlSuffix = '</body></html>';

function wellFormatHtml( text, title )
{
	if ( !Util.isUsefulString( text ) )
		text = '';
	var bodytag = text.match( /<body[^>]*>/i );
	if ( bodytag != null ) {
		bodytag = null;
		return result;
	}
	var titleHeader = '';
	var prefix = htmlPrefix; 
	if ( Util.isUsefulString( title ) ) {
		prefix = prefix.replace( '<head>', '<head><title>' + title + '</title>' )
		titleHeader = '<div class="shaded"><div>' + title + '</div></div>';
	} 
	var result = prefix + titleHeader + text + htmlSuffix;
	titleHeader = null; prefix = null; bodytag = null;
	return result;
}

function writeTempFile( text, counter )
{
	var tempfile = Ti.Filesystem.getFile( Ti.Filesystem.tempDirectory, '_temp_webview_' + counter + '.html' );
	tempfile.write( text ); 
	var path = tempfile.nativePath;
	tempfile = null;
	return path;
}


exports.webPageViewer = function( topOffset, callbackEvent )
{
	var poiWindow = null, webView = null, originalUrl = null, webTitle = null, activity = null;
	var lastProgressValue = 0, pageCounter = 0, bUrlIsRemote = false, bSTOPLOADING = false, bSendBack = false;

	function pauseWebView() 
	{
	    if ( webView != null) webView.pause();
	}

	function resumeWebView() 
	{
	    if ( webView != null) webView.resume();
	}
	
	this.isOpen = function() 
	{
		return ( poiWindow != null );
	}

	function closeThisWindow() 
	{
		if ( poiWindow == null )
			return false;
		if ( activity != null ) {
			activity.removeEventListener( "pause", pauseWebView );
			activity.removeEventListener( "resume", resumeWebView );
		}
		poiWindow.close();
		webView.release();
		if ( !!callbackEvent ) callbackEvent( { action: 'close' } );
		originalUrl = null; webView = null; poiWindow = null; webTitle = null; activity = null;
		return true;
	}

	this.close = closeThisWindow;

	this.goBack = function() 
	{
		if ( webView != null && webView.canGoBack() && webView.url != originalUrl ) {
			bSendBack = true;
			webView.goBack();
		}
		else
			closeThisWindow();
	}

	this.title = function() 
	{
		return webTitle;
	}
	
	this.eval = function( scriptToExecute ) 
	{
		try {
			webView.evalJS( scriptToExecute );
		}
		catch( err ) {
			Ti.API.debug( 'eval ERROR: ' + err );
		}
	}
	
	this.setElement = function( element, value ) 
	{
		try {
			webView.evalJS( 'document.getElementById("' + element + '").innerHTML="' + value + '";' );
		}
		catch( err ) {
			Ti.API.debug( 'setElement ERROR: ' + err );
		}
	}
	
	this.isRemote = function() 
	{
		return bUrlIsRemote;
	}
	
	this.href = function( url )
	{
		if ( webView == null )
			return;
		webView.setUrl( url );
	}
	
	this.setHTML = function( title, html )
	{
		if ( html == null )
			return;
		webView.setUrl( writeTempFile( wellFormatHtml( html, title ), pageCounter++ ) ); 
	}

	this.open = function( poiData, rootFolder ) 
	{
		var urlToOpen = null;
		webTitle = poiData.name;
		if ( !!poiData.remotefile ) {
			urlToOpen = poiData.remotefile; 
		}
		else if ( !!poiData.localfile ) {
			var file = 	Util.lookForFile( poiData.localfile, rootFolder );
			urlToOpen = file.nativePath; 
		}
		else if ( !!poiData.description ) {
			poiText = wellFormatHtml( poiData.description, webTitle ); 
			urlToOpen = writeTempFile( poiText, pageCounter++ );  
		}
		else {
			return false;		// ERROR empty description
		}
		if ( poiWindow != null ) {
			webView.setUrl( urlToOpen );
			return true;
		}
		originalUrl = urlToOpen;
		poiWindow = Ti.UI.createWindow( { 
			zIndex: 3, top: topOffset, backgroundColor:'#000'
		} );
		webView = Ti.UI.createWebView( { 
			enableZoomControls: true, scalesPageToFit: false, url: urlToOpen, opacity:1.0, 
			pluginState: Ti.UI.Android.WEBVIEW_PLUGINS_ON_DEMAND
		} );

		webView.addEventListener( 'load', function( ev ) 
		{
			bSendBack = false;
			bSTOPLOADING = true;
			if ( webView == null )
				return;
			try {
				webTitle = webView.evalJS( 'document.title' );
				//
				// Holy Hack Batman!! Do you always drop guano on your code like that??
				// No, Boy Wonder, it seems appcelerator hired The Joker and now the webview doesn't 
				// execute javascript OOMF! when a page is reloaded. So we broadcast this event, in 
				// case anyone might want to know that a page was loaded. And of course this gets called 
				// for every page loaded. The listener will probably call our setElement() function, 
				// which for remote pages should be harmless unless The Penguin wrote that page. 
				// Good Golly he put sardines in the HTML!! We'll fight back by putting the URL in 
				// the event so the listener can make a wise decision. POW!
				Ti.App.fireEvent('fromWebView',{sendappinfo:true,url:ev.url});
				//
				// And I suppose, Batman, that just because the WebView won't process a link with 
				// target set to _blank that you are blaming this load of guano on Mr. Freeze?
				// Boy Wonder, you have so much to learn about villains and APIs.
				webView.evalJS("document.body.innerHTML = document.body.innerHTML.replace(/target=\"_blank\"/gi,'');");
			}
			catch( err ) {
				Ti.API.debug( 'evalJS ERROR: ' + err );
			}
			if ( !!callbackEvent ) {
				callbackEvent( { action: 'loading', progress: 100 } );
				callbackEvent( { action: 'complete' } );
			}
		});
		
		webView.addEventListener( 'error', function( ev ) 
		{
			bSTOPLOADING = true;
			if ( !!callbackEvent ) callbackEvent( { action: 'stop' } );
		});

		webView.addEventListener( 'beforeload', function( ev ) 
		{
			if ( webView == null )
				return;
			// without this code that checks for the original page, when returning to that page
			// javascript won't start (i.e fireEvent calls will fail) unless we reload the page.
			if ( bSendBack && ev.url == originalUrl ) {
				bSendBack = false;
				webView.stopLoading();
				webView.setUrl( originalUrl );
			}
			bSTOPLOADING = false;
			bUrlIsRemote = ( null != ev.url.match( /https?\:\/\//i ) );
			if ( !!bUrlIsRemote ) {
				if ( !!callbackEvent )
					callbackEvent( { action: 'remote', isRemote: bUrlIsRemote, url: ev.url } );
			}
			else if ( !!callbackEvent )
				callbackEvent( { action: 'beforeload', url: ev.url } );
		}); 
		
		activity = Ti.Android.currentActivity;
		activity.addEventListener( "pause", pauseWebView );
		activity.addEventListener( "resume", resumeWebView );
		poiWindow.add( webView );
		poiWindow.open();
		return true;
	}
}

exports.popupImageViewer = function( topOffset, imageUrlToOpen )
{
	var popupWindow = null, popupImage = null;
	
	this.open = function( urlImage )
	{
		popupWindow = Ti.UI.createWindow( { 
			fullscreen:true, navBarHidden:true, backgroundColor:'#222', opacity:0.8
		} ); 
		popupImage = Ti.UI.createImageView( {
			image: urlImage, touchEnabled:true, canScale:true, enableZoomControls:true, 
			width:'100%',  height:Ti.UI.FILL
		} );
		popupImage.close = this.close;
		popupImage.addEventListener( 'doubletap', function( ev ) 
		{
			ev.source.close();
		} );
		popupWindow.add( popupImage );  
		popupWindow.open();
	}
	this.isOpen = function()
	{
		return (popupWindow != null);
	}
	this.close = function()
	{
		popupWindow.close();
		popupWindow = null; 
		popupImage = null;
	}
	
	if ( Util.isDefined( imageUrlToOpen ) ) {
		this.open( imageUrlToOpen );
	}
}