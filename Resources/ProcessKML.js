/*
 * file: ProcessKML.js
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
 * ProcessKML.js is a module that reads a local KML file or remote URL to a KML file
 * and returns a JSON object that describes the map.
 * 
 * Note that the KML standard is very flexible and complex. ProcessKML will support any
 * map created using Google Maps My Places, and many others. However, some websites and
 * tools may produce KML that will not parse correctly, so this module may need to be
 * updated to support a particular website or tool. Some uses of KML will not be 
 * appropriate for rendering in the mapView object in Map Explorer Open.
 * 
 * ProcessKML will break out each Placemark description into an independent HTML file so 
 * that it can be quickly loaded by a web viewer. All icon images will be downloaded. 
 * Any embedded pictures within a description will be reformatted to suit a small screen, 
 * and optionally downloaded for faster response or offline viewing. ProcessKML will 
 * create a folder that contains the JSON map file, and all HTML descriptions and 
 * downloaded pictures. ProcessKML will handle KML objects: Point, LineString, Polygon, 
 * and GroundOverlay.
 * 
 * ProcessKML does not export any objects, it should be called within a window 
 * as in this example:
 * 
 *  var remoteKml = 'https://maps.google.com/maps/ms?output=kml&......';
 * 	var kmlWindow = Ti.UI.createWindow({
 * 	    url:'ProcessKML.js', title:'KML downloader', navBarHidden:true, opacity: 0, 
 *		download:true, folder:'maps', name:'A New Map', kmlurl:remoteKml  
 * 	});
 * 	kmlWindow.addEventListener( 'complete', function( kmlResult )
 * 	{
 * 		// fireEvent process automatically inserts type and source fields, so remove them
 * 		kmlWindow.close();
 * 		// process kmlResult JSON object ...
 * 	} );
 * 	kmlWindow.addEventListener( 'error', function( kmlResult ) 
 * 	{
 * 		kmlWindow.close();
 * 	} );
 * 	kmlWindow.open();
 * 
 * FYI, The following KML headers are available from a Google Maps KML file:
 * ** Note that a last-modified time stamp is not supported by Google Maps!!
 * 
 * Content-Type:application/vnd.google-earth.kml+xml; charset=UTF-8
 * Date:Sat, 17 Mar 2012 20:27:54 GMT
 * Expires:Sat, 17 Mar 2012 20:27:54 GMT
 * Cache-Control:private, max-age=3600
 * Content-Disposition:attachment; filename="forTestinginBoston.kml"
 * Set-Cookie:PREF=ID=59980f04ead0a288:TM=1332016074:LM=1332016074:S=KbxV31sw-VCvCDcy; expires=Mon, 17-Mar-2014 20:27:54 GMT; path=/; domain=.google.com
 * X-Content-Type-Options:nosniff
 * Server:mfe
 * X-XSS-Protection:1; mode=block
 * X-Frame-Options:SAMEORIGIN
 * Transfer-Encoding:chunked
 */

var Util = require( 'UtilityFunctions' ); 
var FileX = require( 'FileTransfer' );
var Dialog = require( 'UtilityDialogs' ); 

var appCssFile = Ti.Filesystem.getFile( Ti.Filesystem.resourcesDirectory, 'app.css' );
var QUEUE_SIZE = 5;  // don't let the image download queue get larger than this

// this module should be opened with Ti.UI.createWindow({url:'ProcessKML.js'})
var kmlWindow = Ti.UI.currentWindow;
var kmlProc = new kmlProcessor();

kmlWindow.addEventListener( 'close', function( event )
{
	Util.tiObjectCleanup( kmlWindow );
	kmlWindow = null; kmlProc = null;
	Util = null; FileX = null; Dialog = null; 
} );

function getNode( thisNode, tagName ) 
{
	try {
		return thisNode.getElementsByTagName( tagName ).item(0); 
	}
	catch ( getError ) {
		Ti.API.debug( 'KML getNode (' + tagName + ') ERROR = ' + getError );
		return null;
	}
}

function getNodeData( thisNode, tagName ) 
{
	var node = getNode( thisNode, tagName );
	var result = ( !!node ) ? node.textContent : null;
	node = null;
	return result;
}

function makePoint( pointString ) 
{
	if ( typeof pointString != 'string' )
		return null;
	var parts = pointString.split( ',' );
	if ( parts.length < 2 )
		return null;
	var point = { latitude: Number( parts[1] ), longitude: Number( parts[0] ) };
	if ( parts[2] != '0.000000' ) point.altitude = Number( parts[2] );
	parts = null;
	return point;
}

function makeLine( lineString ) 
{
	var lineList = new Array();
	if ( typeof lineString != 'string' )
		return lineList;
	var lines = lineString.split( '\n' );
	for ( var i in lines ) {
		var pt = makePoint( lines[i] );
		if ( pt != null ) lineList.push( pt );
	}
	lines = null;
	return lineList;
}

function makeColor( colorString ) 
{
	if ( typeof colorString != 'string' )
		return null;
	var opnum = Math.round( 100 * Number( '0x' + colorString.substr( 0, 2 ) ) / 255 );
	var RR = colorString.substr( 6, 2 );
	var GG = colorString.substr( 4, 2 );
	var BB = colorString.substr( 2, 2 );
	result = {
		color: '#' + RR + GG + BB,
		opacity: opnum + '%%'
	}
	opnum = null; RR = null; GG = null; BB = null;
	return result;
}

var imageOnclickAttr = ' onclick=\"Ti.App.fireEvent(\'fromWebView\',{imageSrc:this.src,imageUrl:this.url,imageTitle:document.title});\"';
var htmlPrefix = '<html><head><link rel="stylesheet" type="text/css" href="' + appCssFile.nativePath + '"/></head><body>';
var htmlSuffix = '</body></html>';

function wellFormatHtml( mainText, title )
{
	if ( !Util.isUsefulString( mainText ) )
		mainText = '';
	// this is because the webView will not generate an event when target=_build
	mainText = mainText.replace( /target=\"[^\"]*\"/g, '' );
	var bodytag = mainText.match( /<body[^>]*>/i );
	if ( bodytag != null )
		return mainText;
	var titleHeader = '';
	var prefix = htmlPrefix; 
	if ( Util.isUsefulString( title ) ) {
		prefix = prefix.replace( '<head>', '<head><title>' + title + '</title>' )
		titleHeader = '<div class="shaded"><div>' + title + '</div></div>';
	} 
	var result = prefix + titleHeader + mainText + htmlSuffix; 
	bodytag = null; titleHeader = null; prefix = null;
	return result;
}

function mergeExtendedData( extData )
{
	var dataNodes = extData.getElementsByTagName( 'Data' );
	var l = dataNodes.length;
	if ( l < 1 ) {
		dataNodes = null;
		return null;
	}
	var dataSet = new Array();
	dataSet.push( '<dl>' );
	for ( var i = 0; i < l; i++ ) {
		var dataNode = dataNodes.item(i);
		var display = getNodeData( dataNode, 'displayName' );
		var value   = getNodeData( dataNode, 'value' );
		dataSet.push( '<dt>' + display + '</dt><dd>' + value + '</dd>' );
	}
	dataSet.push( '</dl>' );
	var result = dataSet.join( '\n' );
	dataSet = null;
	return result;
}

function extractTagValue( tag )
{
	var parts = tag.match( /[^<]*<[^>]+>([^<]*)<[^>]*>/ );
	var result = ( !!parts && !!parts[1] ) ? parts[1] : tag;
	parts = null;
	return result;
}

function kmlProcessor( )
{
	var bLocalImages = false, ABORT_NOW = false, bSentCompletion = false;
	var minBounds = null, maxBounds = null;
	var kmlInfo = null, kmlFetcher = null;
	var resourceFolder = null, imageUrlList = {}, imageNameList = new Array();
	var itemTotal = -1, itemProgress = 0, mapSize = 0;
	var imageCount = 0, imageTotal = 0, imageMass = 0, imagePending = 0;
	var jsonFile = null, xmlDoc = null, jsonData = null, kmlDoc = null;
	var styleList = null, placeList = null, routeList = null, shapeList = null, overlayList = null;
	var styleNodes = null, placeNodes = null, docItems = null;
	var docName = '', docDescription = '';

	function outerBounds( points ) 
	{
		if ( !Array.isArray( points ) )
			points = [ points ];
		for ( var i in points ) {
			minBounds = Util.minGeoPoint( minBounds, points[i] );
			maxBounds = Util.maxGeoPoint( maxBounds, points[i] );
		}
	}
	
	function checkCompletion()
	{
		if ( ABORT_NOW || bSentCompletion || itemProgress != itemTotal )
			return; 
		if ( imageCount == imageTotal && imagePending == 0 )  {
			bSentCompletion = true;
			kmlInfo.storage = mapSize + imageMass;
			kmlWindow.fireEvent( 'kml_update', { complete:true } );
			kmlFetcher = null; resourceFolder = null; imageUrlList = null; imageNameList = null;
		}
	}

	function callerImageCount( imageSize )
	{
		imageCount++;
		imageMass += imageSize;
		kmlWindow.fireEvent( 'kml_update', { imageTotal:imageTotal, imageCount:imageCount } );
	}

	function fetchImage( imageHref )
	{
		var imageName = Util.extractFilename( imageHref );
		if ( !imageUrlList.hasOwnProperty( imageName ) ) {
			imageUrlList[ imageName ] = { 
					href: imageHref, 
					path: resourceFolder.nativePath + Ti.Filesystem.separator + imageName };
		}
		return imageName;
	}
	
	function downloadImages()
	{
		if ( ABORT_NOW )
			return;
		if ( imageTotal == 0 ) {
			imageNameList = Object.keys( imageUrlList );
			imageTotal = imageNameList.length;
		}
		if ( imageNameList == null ) {
			checkCompletion();
			return;
		}
		var nImages = Math.min( imageNameList.length, ( QUEUE_SIZE - imagePending ) );
		if ( nImages == 0 ) {
			checkCompletion();
			return;
		}
		for ( var i = 0; i < nImages; i++ ) {
			var imageName = imageNameList.pop();
			var imageFile = Ti.Filesystem.getFile( imageUrlList[ imageName ].path );
			if ( imageFile.exists() ) { 
				callerImageCount( imageFile.size );
				continue;
			}
			imagePending++;
			FileX.fetchToFile( imageUrlList[ imageName ].href, imageFile, function( fileInfo ) {
				imagePending--;
				callerImageCount( fileInfo.size );
				setTimeout( downloadImages, 20 );
			} );
		}
		if ( imagePending == 0 )
			setTimeout( downloadImages, 5 );
	}
	
	function transformImageTags( mainText )
	{
		if ( !Util.isUsefulString( mainText ) ) 
			return mainText;
		var transformText = mainText.replace( /<[\/]?center[^>]*>/ig, '' );
		var arrayTags = mainText.match( /(<a\s[^>]*>[^<]*)?<img [^>]*>([^<]*<\/a>)?/gi );
		for ( var i in arrayTags ) {
			var imageTag = arrayTags[i];
			var imgSrc = imageTag.match( / src=[\"\']?([^\"\' >]+)[\"\' >]?/i );
			// var aHref = imageTag.match( / href=[\"\']?([^\"\' >]+)[\"\' >]?/i );
			if ( imgSrc == null || imgSrc.length < 2 )
				continue;
			var imageHref = '';
			var imageURL = imgSrc[1]; 
			if ( bLocalImages ) {
				imageHref = ' url=\"' + imageURL + '\"';
				imageURL = fetchImage( imageURL );
			}
			var newImageTag = '<img class="smallpic" src=\"' + imageURL + '\"' + imageHref + imageOnclickAttr + '><div>'; 
			transformText = transformText.replace( imageTag, newImageTag );
		}
		arrayTags = null;
		return transformText;
	}

	this.stop = function()
	{
		if ( !!kmlFetcher ) {
			kmlFetcher.stop();
		}
		ABORT_NOW = true;
	}
	
	this.setLocalImages = function( bSet )
	{
		bLocalImages = bSet;
	}
	
	this.getKmlInfo = function()
	{
		return kmlInfo;
	}

	this.fetch = function( kmlUrl, localPath )  
	{
		var kmlChecksum, kmlInfo;

		function launchProcessor( kmlText, kmlUrl, localPath, textSize, headers )
		{
			processKmlText( kmlText, kmlUrl, localPath, headers, function( kmlInfoResult ) {
				if ( !!kmlInfoResult.error ) {
					kmlWindow.fireEvent( 'error', kmlInfoResult );
					return;
				}
				kmlWindow.fireEvent( 'kml_update', kmlInfoResult );
				if ( !!kmlInfoResult.filename ) {
					kmlInfoResult.size = textSize;
					kmlInfoResult.checksum = Util.checksum( kmlText );
					downloadImages();
					checkCompletion();
				}
			} );
		}

		if ( !!kmlUrl.match( /file\:\/\//i ) ) {
			kmlWindow.fireEvent( 'kml_update', { progress:0 } );
			var kmlFile = Ti.Filesystem.getFile( kmlUrl );
			var isNow = new Date();
			var fakeHeaders = 'Content-Disposition:attachment; filename="' 
							 + Util.extractFilename(kmlUrl) + '"\n'
							 + 'Date:' + isNow.toGMTString() + '\n';
			kmlWindow.fireEvent( 'kml_update', { progress:kmlFile.size } );
			launchProcessor( kmlFile.read(), kmlUrl, localPath, kmlFile.size, fakeHeaders );
			return;
		}

		kmlFetcher = new FileX.fetch( kmlUrl, 20000, true, function( response ) 
		{
			if ( !!response.error ) {
				kmlWindow.fireEvent( 'kml_update', response );
				kmlFetcher = null;
				return;
			}
			if ( !!response.progress ) {
				kmlWindow.fireEvent( 'kml_update', response );
				return;
			}
			if ( !!response.xhr ) {
				launchProcessor( response.xhr.responseText, kmlUrl, localPath, response.size, response.headers );
				return;
			}
		});
	}

	function processKmlText( kmlText, kmlUrl, localPath, headers, callWhenProcessed )
	{
		var googleName = Util.extractAttribute( headers, 'filename' );
		if ( !Util.isUsefulString( googleName ) )
			googleName = Util.extractFilename( kmlUrl );
		var folderName = Util.checkstring( kmlUrl, null );
		resourceFolder = Ti.Filesystem.getFile( localPath, folderName );
		if ( !resourceFolder.exists() && !resourceFolder.createDirectory() ) 
			return ( { error: 'Cannot create folder ' + folderName } );
		var fileName = folderName + '_map.json';
		jsonFile = Ti.Filesystem.getFile( resourceFolder.nativePath, fileName );
		try {
			xmlDoc = Ti.XML.parseString( kmlText );
		}
		catch ( xmlError ) {
			callWhenProcessed( { error: xmlError } );
			return;
		}
		parseKmlDoc( xmlDoc.documentElement, function( jsonData ) 
		{
			if ( !!jsonData.error ) {
				var result = jsonData.error;
				jsonData = null; xmlDoc = null;
				callWhenProcessed( { error: result } );
				return;
			}
			kmlInfo = jsonData.kml; 
			kmlInfo.filename = fileName;
			kmlInfo.googlename = googleName;
			kmlInfo.foldername = folderName;
			kmlInfo.url = kmlUrl;
			kmlInfo.date = Util.extractProperty( headers, 'Date' );
			try {
				jsonFile.write( JSON.stringify( jsonData ) );
			}
			catch ( writeError ) {
				Ti.API.debug( 'processKmlText WRITE ERROR: ' + writeError );
				kmlInfo = { error: writeError };
			}
			mapSize += jsonFile.size;
			callWhenProcessed( kmlInfo );
			googleName = null; folderName = null; fileName = null;
			jsonFile = null; xmlDoc = null; jsonData = null;  
		} );
	}
	
	var parseKmlDoc = function( xmlDoc, callWhenParsed )
	{
		styleList = {};
		placeList = new Array(); routeList = new Array(); shapeList = new Array(); overlayList = new Array();

		function parseStyleItem( item )
		{
			var styleProperties = {};
			styleProperties.id = item.getAttribute( 'id' );
			var iconNode = getNode( item, 'Icon' );
			if ( !!iconNode ) {
				var iconHref = getNodeData( iconNode, 'href' );
				styleProperties.iconHref = iconHref;
				styleProperties.icon = fetchImage( iconHref );
			}
			var lineNode = getNode( item, 'LineStyle' );
			if ( !!lineNode ) {
				var itemColor = makeColor( getNodeData( lineNode, 'color' ) );
				styleProperties.line = { 
					color:   itemColor.color, 
					opacity: itemColor.opacity, 
					width:   Number( getNodeData( lineNode, 'width' ) )
				};
			}
			var polyNode = getNode( item, 'PolyStyle' );
			if ( !!polyNode ) {
				var fillColor = makeColor( getNodeData( polyNode, 'color' ) );
				styleProperties.polygon = { 
					color:   fillColor.color, 
					opacity: fillColor.opacity 
				};
			}
			iconNode = null; lineNode = null; polyNode = null;
			return styleProperties;
		}

		function parsePlaceDescription( item )
		{
			var itemName = extractTagValue( getNodeData( item, 'name' ) );
			var itemDescription = getNodeData( item, 'description' );
			var itemChecksum = Util.checkstring( itemName + itemDescription, null );
			var itemFile = Ti.Filesystem.getFile( resourceFolder.nativePath, itemChecksum + '.html' ); 
			itemName = Util.htmlDecode( itemName ).replace( '"', '' );
			var result = { 
				name: itemName, localfile: Util.extractFilename( itemFile.nativePath ),
				kmlchecksum: itemChecksum
			};
			if ( !itemFile.exists() ) {
				var itemContent = transformImageTags( itemDescription );
				var extData = getNode( item, 'ExtendedData' );
				if ( !!extData ) itemContent += '<hr>' + mergeExtendedData( extData ); 
				try {
					itemFile.write( wellFormatHtml( itemContent, itemName ) );
				}
				catch ( writeError ) {
					Ti.API.debug( 'parseKmlDoc WRITE ERROR: ' + writeError );
					ABORT_NOW = true;
					result = { error: writeError };
				}
				itemContent = null; extData = null;
			}
			result.size = itemFile.size;
			itemName = null; itemDescription = null; itemChecksum = null; itemFile = null; 
			return result;
		}

		function parsePlaceItem( item, placeProperties )
		{
			var itemIcon = '', iconHref = '', itemStyle = {};
			var styleTag = getNodeData( item, 'styleUrl' );
			if ( !!styleTag && styleTag.charAt(0) == '#' ) {
				styleTag = styleTag.substring(1);
				if ( !styleList.hasOwnProperty( styleTag ) )
					styleTag += '_off';
				if ( !!styleList[ styleTag ] ) {
					itemStyle = styleList[ styleTag ];
					itemIcon = itemStyle.icon;
					iconHref = itemStyle.iconHref;
				}
			}
			var iconNode = getNode( item, 'Icon' );
			if ( !!iconNode ) {
				iconHref = getNodeData( iconNode, 'href' );
				itemIcon = fetchImage( iconHref );
			}
			styleTag = null; iconNode = null;
			var pointNode = getNode( item, 'Point' );
			if ( !!pointNode ) {
				placeProperties.type = 'point';
				placeProperties.icon = itemIcon;
				placeProperties.iconHref = iconHref;
				placeProperties.point = makePoint( getNodeData( pointNode, 'coordinates' ) );
				outerBounds( placeProperties.point );
				placeList.push( placeProperties );
				pointNode = null;
				return;
			}
			var lineNode = getNode( item, 'LineString' );
			if ( !!lineNode ) {
				placeProperties.type = 'route';
				placeProperties.lineStyle = itemStyle.line;
				// placeProperties.tessellate = getNodeData( lineNode, 'tessellate' );
				placeProperties.line = makeLine( getNodeData( lineNode, 'coordinates' ) );
				outerBounds( placeProperties.line );
				routeList.push( placeProperties );
				lineNode = null;
				return;
			}
			var polyNode = getNode( item, 'Polygon' );
			if ( !!polyNode ) {
				placeProperties.type = 'shape';
				placeProperties.lineStyle = itemStyle.line;
				placeProperties.fillStyle = itemStyle.polygon;
				// placeProperties.tessellate = getNodeData( polyNode, 'tessellate' );
				placeProperties.line = makeLine( getNodeData( polyNode, 'coordinates' ) );
				outerBounds( placeProperties.line );
				shapeList.push( placeProperties );
				polyNode = null;
				return;
			}
			var overlayNode = getNode( item, 'GroundOverlay' );
			if ( !!overlayNode ) {
				placeProperties.type = 'overlay';
				placeProperties.icon = getNodeData( item, 'href' );
				placeProperties.box = {
					north:  getNodeData( overlayNode, 'north' ),
					east:   getNodeData( overlayNode, 'east' ),
					south:  getNodeData( overlayNode, 'south' ),
					west:   getNodeData( overlayNode, 'west' )
				};
				placeProperties.color = getNodeData( overlayNode, 'color' );
				overlayList.push( placeProperties );
				overlayNode = null;
				return;
			}
		}

		var indexStyle = 0, indexPlace = 0;
		
		function processStyleNode()
		{
			if ( ABORT_NOW ) {
				kmlWindow.fireEvent( 'kml_update', { error: 'KML parsing aborted' } );
				return;
			}
			var item = styleNodes.item( indexStyle++ );
			if ( item == null ) {
				processPlaceNode();
				return;
			}
			itemProgress++;
			kmlWindow.fireEvent( 'kml_update', { itemTotal:itemTotal, itemCount:itemProgress } );
			var styleItem = parseStyleItem( item );
			styleList[ styleItem.id ] = styleItem;
			item = null; styleItem = null;
			setTimeout( processStyleNode, 10 );
		}
		
		function processPlaceNode()
		{
			if ( ABORT_NOW ) {
				kmlWindow.fireEvent( 'kml_update', { error: 'KML parsing aborted' } );
				return;
			}
			var item = placeNodes.item( indexPlace++ );
			if ( item == null ) {
				processKMLDocFinish();
				return;
			}
			itemProgress++;
			kmlWindow.fireEvent( 'kml_update', { itemTotal:itemTotal, itemCount:itemProgress } );
			var itemDescription = parsePlaceDescription( item );
			if ( !!itemDescription.error ) {
				kmlWindow.fireEvent( 'kml_update', { error: itemDescription.error } );
				return;
			}
			mapSize += itemDescription.size;
			parsePlaceItem( item, itemDescription );
			item = null; itemDescription = null;
			setTimeout( processPlaceNode, 10 );
		}

		function processKMLDocFinish()
		{
			var latD = 0.01, lngD = 0.01, latCenter = 0, lngCenter = 0;
			if ( maxBounds != null ) {
				latD = Util.decimal( 1.2 * ( maxBounds.latitude - minBounds.latitude ), 6 );
				latD = Math.max( 0.004, Math.min( 120.0, latD ) );
				lngD = Util.decimal( 1.2 * ( maxBounds.longitude - minBounds.longitude ), 6 );
				lngD = Math.max( 0.004, Math.min( 180.0, lngD ) );
				latCenter = Util.decimal( ( maxBounds.latitude + minBounds.latitude ) / 2, 6 );
				lngCenter = Util.decimal( ( maxBounds.longitude + minBounds.longitude ) / 2, 6 );
			}
			var result = {
				kml: {
					name: docName, namespace: kmlNS, description: docDescription,
				},
				region: {
					latitude: latCenter, longitude: lngCenter, latitudeDelta: latD, longitudeDelta: lngD
				},
				places: placeList, 
				routes: routeList, 
				shapes: shapeList, 
				overlays: overlayList
			};
			callWhenParsed( result );
			placeNodes = null; styleList = null; docItems = null; kmlNS = null; kmlDoc = null;
			placeList = null; routeList = null; shapeList = null; overlayList = null;
			styleNodes = null; item = null; itemDescription = null;
		}

		var kmlNS = xmlDoc.getNamespaceURI();
		kmlDoc = getNode( xmlDoc, 'Document' );
		if ( kmlNS == null || kmlDoc == null ) {
			callWhenParsed( { error: 'Not a valid KML document' } );
			kmlNS = null; kmlDoc = null;
			return;
		}

		docItems = kmlDoc.getChildNodes();
		styleNodes = new Array();
		placeNodes = new Array();
		for ( var i = 0; i < docItems.length; i++ ) {
			var item = docItems.item(i);
			if ( item.tagName == 'name' ) {
				docName = item.textContent;
				docName = docName.replace( ' - Google Maps', '' );
				docName = docName.replace( 'VirtualGlobetrotting: ', '' );
				continue;
			}
			if ( item.tagName == 'description' ) {
				docDescription = item.textContent;
				continue;
			}
			if ( docName.length > 0 && docDescription.length > 0 )
				break;
		}
		styleNodes = kmlDoc.getElementsByTagName( 'Style' ); 
		placeNodes = kmlDoc.getElementsByTagName( 'Placemark' );
		itemTotal = styleNodes.length + placeNodes.length;

		// kick-off serialized asyncronous processing of each element
		processStyleNode();
	}
}

function downloadMap( kmlUrl, bDownloadImages, mapFolder, displayName )
{
	var viewBackground = Ti.UI.createView( {
		width:Ti.UI.FILL, height:Ti.UI.FILL,
		backgroundColor: '#000', opacity: 0.2, touchEnabled: false, top:0, left:0
	} );
	kmlWindow.add( viewBackground );

	var viewOver = Ti.UI.createView( { backgroundColor:'#000', width:Ti.UI.FILL, height:Ti.UI.SIZE } );

	var labelBytesTitle = Ti.UI.createLabel( { left: '16dp', top:'8dp',  text: 'Downloading:' } );
	var labelBytesParam = Ti.UI.createLabel( { right:'16dp', top:'8dp',  text: '0 B' } );
	var labelItemsTitle = Ti.UI.createLabel( { left: '16dp', top:'40dp', text: 'Items:' } );
	var labelItemsParam = Ti.UI.createLabel( { right:'16dp', top:'40dp', text: '-' } );
	var labelImageTitle = Ti.UI.createLabel( { left: '16dp', top:'72dp', bottom:10, text: 'Images:' } );
	var labelImageParam = Ti.UI.createLabel( { right:'16dp', top:'72dp', bottom:10, text: '-' } );

	viewOver.add( labelBytesTitle ); viewOver.add( labelBytesParam );
	viewOver.add( labelItemsTitle ); viewOver.add( labelItemsParam );
	viewOver.add( labelImageTitle ); viewOver.add( labelImageParam );

	kmlProc.setLocalImages( bDownloadImages );

	var alertDialog = Dialog.askUser( displayName, viewOver, [ 'STOP' ], function( index ) {
		if ( index == 0 && !!kmlProc ) kmlProc.stop();
	} )
	
	kmlWindow.addEventListener( 'kml_update', function(kmlUpdate) 
	{
		if ( !!kmlUpdate.itemCount ) {
			labelItemsParam.text = kmlUpdate.itemCount + '/' + kmlUpdate.itemTotal;
			return;
		}
		if ( !!kmlUpdate.imageCount ) {
			labelImageParam.text = kmlUpdate.imageCount + '/' + kmlUpdate.imageTotal;
			return;
		}
		if ( !!kmlUpdate.progress ) {
			labelBytesParam.text = Math.round(kmlUpdate.progress).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + ' B';
			return;
		}
		if ( !!kmlUpdate.complete ) {
			alertDialog.hide();
			alertDialog = null
			processKML = null;
			kmlWindow.fireEvent( 'complete', kmlProc.getKmlInfo() );
			kmlProc = null;
			return;
		}
		if ( !!kmlUpdate.error ) {
			alertDialog.hide();
			alertDialog = null
			processKML = null;
			kmlProc = null;
			kmlWindow.fireEvent( 'error', kmlUpdate );
			return;
		}
	} );
	kmlProc.fetch( kmlUrl, mapFolder ); 
}

downloadMap( kmlWindow.kmlurl, kmlWindow.download, kmlWindow.folder, kmlWindow.name );

