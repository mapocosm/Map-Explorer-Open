/*
 * file: Googleness.js
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
 * YOU MUST CREATE NEW GOOGLE SERVICE API KEYS AND CUSTOM SEARCH ENGINE FOR THIS MODULE 
 * TO BE USEFUL! See: 
 *     http://code.google.com/apis/console
 *     https://developers.google.com/custom-search/
 * 
 * !! Change the variable 'googleApiKey' below to set your vendor-specific Google API key
 * !! Change the variable 'mapEngineCX' below to set your custom search engine (CSE)
 * 
 * !! Note that a separate key for using the Google Maps (MapView) object is set in the 
 * tiapp.xml file. It is only necessary to set the Google Maps API key when creating a 
 * signed app ready for distribution; do not set the Maps API key during development. See:
 *     http://docs.appcelerator.com/titanium/2.0/index.html#!/guide/Preparing_for_Distribution
 *     http://docs.appcelerator.com/titanium/2.0/index.html#!/guide/Native_Maps_and_Annotations
 * 
 * This module makes use of the well documented Google Maps and Places APIs, and
 * searching with a Custom Search Engine:
 *     https://developers.google.com/maps/documentation/webservices/
 *     https://developers.google.com/places/documentation/
 *     https://developers.google.com/custom-search/v1/overview
 *     
 * Googleness.js is a module for handling Google web service APIs. The general format is
 * to send an HTTP request that contains a vendor-specific API key, and receive a JSON
 * reply object. The Googleness objects know how to make API requests and format the
 * results for user presentation.
 * 
 * Four objects are exported:
 *   - FindMaps, search queries to a Custom Search Engine (CSE) to find a map
 *   - SearchNearby, perform a local search by <lat,lng>
 *   - getPlaceDetails, given a local search result, get details from Google Places
 *   - GetDirections, asking for directions
 *   
 * Also exports functions for calling external google objects in the mobile device:
 *   - openNavigation, open a <lat/lng> in Google Navigation
 *   - openStreetView, open a <lat/lng> in Google Street View 
 *   - openGoogleMap, open a <lat/lng> in Google Maps
 */

var googleApiKey   = '';  // YOU MUST SET THIS KEY TO YOUR PRIVATE GOOGLE API KEY
var mapEngineCX    = '';  // YOU MUST SET THE CX VALUE TO YOUR CUSTOM SEARCH ENGINE

var Util = require( 'UtilityFunctions' ); 
var Dialog = require( 'UtilityDialogs' ); 
var FileX = require( 'FileTransfer' );

var urlDirections  = 'https://maps.googleapis.com/maps/api/directions/json?';
var urlSearchBase  = 'https://maps.googleapis.com/maps/api/place/search/json?';
var urlPlaceDetail = 'https://maps.googleapis.com/maps/api/place/details/json?';
var urlSearchMaps  = 'https://www.googleapis.com/customsearch/v1?';

var urlNavigation  = 'google.navigation:q=';
var urlGoogleMaps  = 'geo:';
var urlStreetView  = 'google.streetview:cbll=';

var urlSearchAsk   = urlSearchBase  + 'key=' + googleApiKey;
var urlDetailAsk   = urlPlaceDetail + 'key=' + googleApiKey;
var urlFindMapAsk  = urlSearchMaps  + 'key=' + googleApiKey + '&cx=' + mapEngineCX;

var endPageSpaces  = '<p> </p><p> </p>';

function makeOnclick( attr, value )
{
	return 'onclick=\"Ti.App.fireEvent(\'fromWebView\',{' + attr + ':\'' + value + '\'});\" ';
}

function latlong( locationObject )
{
	if ( !!locationObject && !!locationObject.latitude && !!locationObject.longitude )
		return locationObject.latitude + ',' + locationObject.longitude; 
	return '';
}

exports.FindMaps = function( callSearchResults, callSelectedItem )
{
	var lastQuery = null;
	var itemList = null;
	var startIndex = 0;
	
	function askForMaps( startIndex ) {
		var urlRequest = urlFindMapAsk + '&alt=json' + '&q=' + lastQuery;
		if ( startIndex > 0 )  urlRequest += '&start=' + startIndex; 
		FileX.fetch( urlRequest, 10000, false, function( response ) 
		{
			if ( !!response.error ) {
				Dialog.alertUser( 'Find Maps', 'Search response error: ' + response.error );
				return;
			}
			if ( !!response.xhr ) {
				if ( !!callSearchResults ) callSearchResults( JSON.parse( response.xhr.responseText ) );
			}
		});
		urlRequest = null;
	};

	this.formatResults = function( jResponse )
	{
		if ( itemList == null ) itemList = new Array();
		var responseHTML = new Array();
		var request = jResponse.queries.request[0];
		var nextPage = jResponse.queries.nextPage;
		if ( !!nextPage ) nextPage = nextPage[0];
		itemList = itemList.concat( jResponse.items );
		startIndex = ( !!request && !!request.startIndex ) ? ( Number( request.startIndex ) - 1 ) : 0;

		responseHTML.push( '<div class="title">' + request.searchTerms + '</div>' 
				+ '<div class="subtitle">results: ' + ( startIndex + 1 ) + ' - ' 
				+ ( startIndex + Number( request.count ) ) + '</div><hr>' ); 

		var nitems = ( !!jResponse && !!jResponse.items ) ? jResponse.items.length : 0; 
		if ( nitems == 0 ) {
			responseHTML.push( '<dl class="listing" >No Matches</dl><hr>' );
		}
		for ( var i = 0; i < nitems; i++ ) {
			var item = jResponse.items[i];
			item.id = i + startIndex; 
			item.title = item.title.replace( ' - Google Maps', '' ).replace( 'VirtualGlobetrotting: ', '' );
			responseHTML.push( '<dl class="listing" ' + makeOnclick( 'mapselect', item.id ) + '>'
						+ '<dt class="listing">' + Util.stripTags( item.title ) + '</dt>'  
						+ '<dd class="sublisting_minor">' + Util.stripTags( item.displayLink ) + '</dd>'  
						+ '<dd class="sublisting">' + Util.stripTags( item.snippet ) + '</dd>' 
						+ '</dl><hr>' );
		}
		responseHTML.push( '<span class="button" ' + makeOnclick( 'findmapagain', 0 ) + '>Search Again</span>' );
		if ( !!nextPage ) 
			responseHTML.push( '<span class="button" ' + makeOnclick( 'nextmap', nextPage.startIndex ) + '>More Results ...</span>' );
		var results = responseHTML.join( '' ) + endPageSpaces; 
		responseHTML = null; request = null; nextPage = null;
		return results; 
	}

	this.makeSummaryView = function( mapDescription, bDownloadPics )
	{
		var summaryView = Ti.UI.createView({ 
			backgroundColor:'#000', layout: 'vertical', width:Ti.UI.FILL, height:Ti.UI.SIZE 
		});
		var titleView = Ti.UI.createView({ 
			backgroundColor:'#DDD', borderRadius: 6, width:'90%', height:Ti.UI.SIZE, top:'10dp', bottom:'10dp'
		});
		titleView.add( Ti.UI.createLabel({
		    text: mapDescription.title, touchEnabled:false, width:'94%', top:'10dp', bottom:'10dp', 
		    font:{fontSize:'18dp',fontWeight:'bold'}, color:'#00A'
		}) );
		summaryView.add( titleView );

		var checkBox = new Dialog.checkbox( 'Download pictures with map', bDownloadPics, { width:'90%', top:'8dp', bottom:'8dp' } );
		summaryView.add( checkBox.getView() );
		summaryView.add( Dialog.hr({ width:'90%' }) );

		var detailsView = Ti.UI.createScrollView({ 
			width:Ti.UI.FILL, height:Ti.UI.SIZE,
			layout: 'vertical', scrollType:'vertical' 
		});
		detailsView.add( Ti.UI.createLabel({
			width:Ti.UI.FILL, height:Ti.UI.SIZE,
		    text: mapDescription.displayLink, 
		    textAlign: Ti.UI.TEXT_ALIGNMENT_CENTER
		}) );
		if ( !!mapDescription.pagemap ) {
			detailsView.add( Ti.UI.createImageView({ 
				image: mapDescription.pagemap.cse_image[0].src, height:'140dp'
			}) );
		}
		detailsView.add( Ti.UI.createLabel({
		    text: mapDescription.snippet, width:'90%', height:Ti.UI.SIZE
		}) );
		summaryView.add( detailsView );
		summaryView.doDownloadPics = checkBox.getCheck;
		return summaryView;
	}
	
	this.select = function( index )
	{
		if ( itemList == null || index < 0 || index >= itemList.length ) {
			Ti.API.debug( 'FindMaps:select ERROR, index = ' + index );
			return;
		}
		if ( !!callSelectedItem )
			callSelectedItem( itemList[ index ] );
	}

	this.ask = function( itemIndex ) 
	{
		if ( itemIndex > 0 ) {
			askForMaps( itemIndex );
			return;
		}
		lastQuery = null;
		itemList = null;
		startIndex = 0;
		Dialog.getUserEntry( 'Search for a map:', function( userInput ) 
		{
			if ( userInput.match( /https?\:\/\//i ) || userInput.match( /file\:\/\//i ) ) {
				if ( !!callSelectedItem )
					callSelectedItem( {
						link:userInput, title:Util.extractFilename(userInput), snippet:userInput, urlInput:true 
					} );
			}
			else {
				lastQuery = userInput;
				askForMaps( 0 );
			}
		});
	}
}


exports.getPlaceDetails = function( googleReference, callPlaceDetails )
{
	var urlSend = urlDetailAsk + '&sensor=true' + '&reference=' + googleReference;

	FileX.fetch( urlSend, 10000, false, function( response ) 
	{
		if ( !!response.error ) {
			Dialog.alertUser( 'Search', 'Error: ' + response.error );
			return;
		}
		if ( !!response.xhr ) {
			var jResponse = JSON.parse( response.xhr.responseText );
			if ( !!callPlaceDetails ) callPlaceDetails( jResponse.result.url );
		}
	} );
	urlSend = null;
}

exports.SearchNearby = function( )
{
	var searchResults = null;
	var searchQuery = null;

	function adjustDistance( inMeters )
	{
		var imperial = 3.2808 * inMeters;
		if ( imperial > 999 )
			imperial = ( Math.round( imperial / 528 ) / 10 ) + ' mi';
		else
			imperial = Math.round( imperial ) + ' ft';
		if ( inMeters > 500 )
			return imperial + ' / ' + ( Math.round( inMeters / 100 ) / 10 ) + ' km';
		else
			return imperial + ' / ' + Math.round( inMeters ) + ' m';
	}

	function sortByDistance( a, b )
	{
		return Number( a.distance ) - Number( b.distance );
	}

	function sortByRating( a, b )
	{
		if ( !Util.isDefined( b.rating ) ) return -1;
		if ( !Util.isDefined( a.rating ) ) return 1;
		return Number( b.rating ) - Number( a.rating );
	}

	this.askUser = function( searchRegion, callSearchResults )
	{
		var urlSend = null;
		var jResponse = null;
		var userQueryInput = null;
		var searchRadiusMeters = Math.round( 1.5 * Util.regionSpan( searchRegion ) );	
		
		function getQueryResponse( searchResponse ) 
		{
			if ( !!searchResponse.error ) {
				Dialog.alertUser( 'Search', 'Error getting search response' );
				Ti.API.debug( 'askSearchNearby: ERROR = ' + searchResponse.error );
			}
			else if ( !!searchResponse.xhr ) {
				jResponse = JSON.parse( searchResponse.xhr.responseText )
				jResponse.queryTerm = userQueryInput;
				searchQuery = userQueryInput;
				searchResults = jResponse.results; 
				if ( !!callSearchResults ) callSearchResults( jResponse );
			}
			userQueryInput = null; searchRadiusMeters = null; jResponse = null;
		}

		Dialog.getUserEntry( 'Search Term:', function( responseText ) 
		{
			userQueryInput = responseText;
			urlSend = urlSearchAsk + '&sensor=true' + '&location=' + latlong( searchRegion )
									   + '&radius=' + searchRadiusMeters + '&keyword=' + userQueryInput;
			FileX.fetch( urlSend, 10000, false, getQueryResponse );
			urlSend = null;
		});
	}
	
	this.findResult = function( findId )
	{
		return Util.findObject( searchResults, 'id', findId ); 
	}
	
	this.formatResults = function( bSortByDistance, fromLocation )
	{
		var responseHTML = new Array();
		var sortbyCommand = bSortByDistance ? 'ratings' : 'distance';
		var sortbyLabel =   bSortByDistance ? 'Ratings' : 'Distance';

		if ( !!fromLocation ) {
			for ( var i in searchResults ) {
				var item = searchResults[i];
				item.distance = Util.geoSeparation( fromLocation, { 
					latitude:  item.geometry.location.lat, 
					longitude: item.geometry.location.lng } ); 
				item.id = i;
				item = null;
			}
		}
		searchResults.sort( bSortByDistance ? sortByDistance : sortByRating );

		responseHTML.push( '<div class="title">' + searchQuery + '</div><div>'
			+ '<span class="button" ' + makeOnclick( 'searchagain', true ) + '>Search Again</span>'
			+ '<span class="button" ' + makeOnclick( 'searchsort', sortbyCommand ) + '>Sort by ' + sortbyLabel + '</span>'
			+ '</div><hr>' );
		
		for ( var i in searchResults ) {
			var item = searchResults[i];
			var distance = !!item.distance ? 'Distance: ' + adjustDistance( item.distance ) + '&nbsp;&nbsp;' : '';
			var rating = !!item.rating ? 'Rating: ' + item.rating : ''; 
			responseHTML.push( '<dl class="listing" ' + makeOnclick( 'searchselect', item.id ) + '>'
					+ '<dt class="listing">' + item.name  
					+ '</dt><dd class="sublisting">' + item.vicinity 
					+ '</dd><dd class="sublisting">' + distance + rating + '</dd></dl><hr>' );
			item = null; distance = null; rating = null;
		}
		var results = responseHTML.join( '' ) + endPageSpaces;
		responseHTML = null; sortbyCommand = null; sortbyLabel = null;
		return results;
	}
}

function openMapByUrl( baseUrl, location )
{
	if ( location == null ) {
		Dialog.alertUser( 'Location Service', 'Error: a location must be selected' );
		return;
	}
	Ti.Platform.openURL( baseUrl + latlong( location ) );
}

exports.openNavigation = function( atThisLocation )
{
	openMapByUrl( urlNavigation, atThisLocation );
}

exports.openStreetView = function( atThisLocation )
{
	openMapByUrl( urlStreetView, atThisLocation );
}

exports.openGoogleMap = function( atThisLocation )
{
	openMapByUrl( urlGoogleMaps, atThisLocation );
}

exports.GetDirections = function(  )
{
	var directionsResponse = null;
	
	this.formatResults = function()
	{
		var responseHTML = new Array();
		var route = directionsResponse.routes[0];
		var leg = route.legs[0];

		responseHTML.push( '<div style="font-size:smaller;">' 
				+ leg.steps[0].travel_mode + ' directions to: </div>' 
				+ '<div class="shaded"><span>' + leg.end_address + '</span></div>'
				+ '<div class="subtitle">' + leg.distance.text + ', ' + leg.duration.text 
				+ '</div><ol class="results">' );
		
		for ( var i in leg.steps ) {
			responseHTML.push( '<li class="toshow">' + leg.steps[i].html_instructions
							+ '<div class="comment">' 
							+ leg.steps[i].distance.text + ', ' + leg.steps[i].duration.text 
							+ '</div></li>' );
		}
		responseHTML.push( '</ol><div class="minor">' + route.warnings.toString() 
					+ '<br>' + route.copyrights + '</div>' );
		var results = responseHTML.join( '' ) + endPageSpaces;
		responseHTML = null; route = null; leg = null;
		return results; 
	}
	
	this.request = function( params, callWithDirections )
	{
		var mode = !!params.travelMode ? '&mode=' + params.travelMode : '';
		var avoid = !!params.travelAvoid ? '&avoid=' + params.travelAvoid : '';
		var urlParams = 'origin=' + latlong( params.origin ) 
				+ '&destination=' + latlong( params.destination ) 
				+ mode + avoid + '&sensor=true'; 
		FileX.fetch( urlDirections + urlParams, 10000, false, function( response ) 
		{
			if ( !!response.error ) {
				Dialog.alertUser( 'Ask Directions', 'Error getting directions response' );
				Ti.API.debug( 'getDirections: ERROR = ' + response.error );
			}
			else if ( !!response.xhr ) {
				directionsResponse = JSON.parse( response.xhr.responseText );
				if ( !!callWithDirections )
					callWithDirections( directionsResponse );
			}
			mode = null; avoid = null; urlParams = null;
		} );
	}
}
