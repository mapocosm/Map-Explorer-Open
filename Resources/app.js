/*
 * file: app.js
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
 * app.js is the main window and activity for Map Explorer Open
 * 
 * Map Explorer Open is built and tested on Android 2.2, 2.3, and 4.0. 
 * Most code is portable but some changes must be made to use on iPhone:
 *  - some tags such as <target> in tiapp.xml
 *  - the AppState object reduces power consumption, specific to Android
 *  - the event listener 'android:back' is specific to Android
 *  - onPrepareOptionsMenu is a specific behavior to Android
 *  
 * Associated files and modules:
 * app.js              main application javascript file
 * app.css             CSS style definitions used by poiBrowser and Googleness HTML rendering
 * catalog.json        JSON database of remote maps that may be of interest, to get the user started
 * AndroidManifest.xml in platform/android/, for android-specific features like intent filters
 * ProcessKML.js       module for downloading and parsing KML map files
 * poiBrowser.js       module for opening local or remote HTML and image files
 * Googleness.js       module for querying Google maps and places APIs and formatting results
 * FileTransfer.js     module for managing HTTP downloads
 * TitleBar.js         module for cross-platform title bar and pulldown menu user interface
 * UtilityDialogs.js   module for user interactions: dialogs, alerts, selections, text entry, etc.
 * UtilityFunctions.js every project needs a place to put all the common functions and definitions
 * 
 *  !! refer to Googleness.js comments for critical information about Google API keys !!
 *  
 * There are two primary namespace objects: MAP and APP. Some features are enabled by the value 
 * of the appid containing '.paid'. You can override this behavior by forcing the APP.isPaid 
 * property, which enables paid features for the Open version by default. Some modules are loaded 
 * at the start, and others are loaded 'just in time' in order to reduce memory footprint.
 * 
 * File structure: app.css and ProcessKML.js use the following local file structure, which can be 
 * located in Ti.Filesystem.applicationDataDirectory or Ti.Filesystem.externalStorageDirectory
 * depending on the setting 'Map Storage Location'
 * > catalog.json                     // catalog of stored maps in JSON text format
 * > maps                             // folder that contains all of the maps
 *   +---> UCMAy1                     // folder for a map, internal encoded map name
 *         +---> UCMAy1_map.json      // holds the JSON map description, parsed from KML
 *         +---> XF_Nb3.html          // *.html, a set of files that each describe an
 *         +--->      *.html          //         individual point of interest on the map
 *         +---> blue-dot.png         // icon image files
 *         +--->        *.jpg         // icon image files
 *         +---> 39205-v1.jpg         // downloaded image files
 *         +--->        *.jpg         //         if photo download is enabled
 * 
 */	

// external modules -------------------------------------------------------------------------------------

var Util      = require( 'UtilityFunctions' ); 
var Dialog    = require( 'UtilityDialogs' ); 
var Goog      = require( 'Googleness' );
var titleBar  = require( 'TitleBar' );

// these modules will use just-in-time loading:
var poiBrowser  = null; // require( 'poiBrowser' ); 

// define strings, menus, constants, etc. ----------------------------------------------------------------

var appInfoFile     = 'appinfo.html';
var myLocationIcon  = Util.imagePath + 'blue-sight.png';
var myTrackingIcon  = Util.imagePath + 'red-sight.png';
var defaultPinIcon  = Util.imagePath + 'pushpin_red.png';
var wayptRedIcon    = Util.imagePath + 'red-starmark.png';
var wayptWhiteIcon  = Util.imagePath + 'white-starmark.png';
var wayptBlueIcon   = Util.imagePath + 'blue-starmark.png';
var foundGreenIcon  = Util.imagePath + 'green-starmark.png';
var speckRedIcon    = Util.imagePath + 'red-speck.png';


var initialMapRegion = {
		latitude: 20.0000,        longitude: -40.0000,
		latitudeDelta: 120.0000,  longitudeDelta: 120.0000,
		animate: true
};


// Application objects and variables -------------------------------------------------------------------------------------

var APP = {
	// context menu types: 
	MENU_MAIN: 0, MENU_POI: 1,

	// application setting order in the pick list
	LOCATION: 0, TRACKING: 1, FEATURES: 2, MAPVIEWTYPE: 3, MAPSTORAGE: 4, TRAVELMODE: 5, 
	AVOIDANCE: 6, UPDATE: 7,  
	
	// string constants, properties, preferences
	CURRENTPOS:   'Current Position',
	USECOUNT:     'AppUseCount',
	APPTITLE:     'Map Explorer',
	MAPS_DIR:     'maps',
	CATALOG_FILE: 'catalog.json',

	// menu selection id's
	POINTS: 100, SEARCH: 101, MOREINFO: 102, SETTINGS: 103, 
	GETDIRECTIONS: 104, SHOWDIRECTIONS: 105, NAVIGATE: 106,
	STREETVIEW: 107, GOOGLEMAP: 108, GOBACK: 109, PREVIOUS: 110,
	WHEREAMI: 111, FINDAMAP: 112, 

	// parameters
	ZOOMDELTA: 0.003,

	// values to be set on condition
	isAndroid:  ( ( Ti.Platform.osname == 'android' ) ? true : false ),
	isiPhone:   ( ( Ti.Platform.osname == 'iphone' ) ? true : false ),
	isiPad:     ( ( Ti.Platform.osname == 'ipad' ) ? true : false ),
	isApple:    ( ( Ti.Platform.name ==   'iPhone OS' ) ? true : false ),
	isPaid:     false,
	isOpenSrc:  false,
	version:    '',
	useCount:   0,
	maxKeepMap: 8,
	dirMaps:    null,

	// objects
	window:     null,
	catalog:    null,
	
	// 
	END_MARKER:   0
};

var MAP = {
	// primary map information
	view: null,
	kmldata: null,
	mainTitle:	'',
	menuType: APP.MENU_MAIN,
	folder: null,
	annotations: null,
	lastSearchAnnotation: null,
	ptLocationShowing: null,
	positionMarker: null,
	bDownloadPics: false,
	bSortByDistance: true,
	descriptor: null,
	lastKnownRegion: {
		latitude: initialMapRegion.latitude,        
		longitude: initialMapRegion.longitude,
		latitudeDelta: initialMapRegion.latitudeDelta,
		longitudeDelta: initialMapRegion.longitudeDelta
	},
	
	// for showing a directions route
	DIR: {
		bShowing: false,
		routeTitle: null,
		priorRegion: null,
		routePoints: null
	},

	// constants for identifying points of interest by type
	ID: {
		PTINTEREST: 	0,
		DIRECTIONS:		2000,
		MYLOCATION:		4000,
		SEARCHRESULT:	6000
	}
}

var dirMapsInternal = Util.createDirectory( APP.MAPS_DIR, false );    // internal memory
var dirMapsExternal = Util.createDirectory( APP.MAPS_DIR, true );     // external, SD card memory


// menu definitions -------------------------------------------------------------------------------------

var menuPrimary = [ 
       { id: APP.POINTS,           title: 'Points of Interest' },
       { id: APP.SHOWDIRECTIONS,   title: 'Show Directions'    },
       { id: APP.GETDIRECTIONS,    title: 'Get Directions'     },
       { id: APP.WHEREAMI,         title: 'Where Am I?'        },
       { id: APP.SEARCH,           title: 'Search Nearby'      },
       { id: APP.FINDAMAP,         title: 'Find A Map'         },
       { id: APP.MOREINFO,         title: 'More ...'           },
       { id: APP.SETTINGS,         title: 'App Settings'       },
       { id: APP.NAVIGATE,         title: 'Navigate to'        },
       { id: APP.STREETVIEW,       title: 'Street View'        },
       { id: APP.GOOGLEMAP,        title: 'Google Map'         },
       { id: APP.PREVIOUS,         title: 'Previous Page'      },
       { id: APP.GOBACK,           title: 'Back to Map'        }
];

var menu_MainMap     = [ APP.POINTS, APP.SEARCH, APP.FINDAMAP, APP.WHEREAMI, APP.SETTINGS, APP.MOREINFO ];
var menu_Directions  = [ APP.SHOWDIRECTIONS, APP.SEARCH, APP.NAVIGATE, APP.STREETVIEW, APP.WHEREAMI, APP.GOBACK ];
var menu_Browsing    = [ APP.GETDIRECTIONS, APP.SEARCH, APP.NAVIGATE, APP.STREETVIEW, APP.GOOGLEMAP, APP.GOBACK ];
var menu_Remote      = [ APP.PREVIOUS, APP.GOBACK ];

// The global objects that do things --------------------------------------------------------------------

var myLocation = {
    latitude: initialMapRegion.latitude, longitude: initialMapRegion.longitude,
    title: APP.CURRENTPOS, image: myLocationIcon, myid: MAP.ID.MYLOCATION, type: MAP.ID.MYLOCATION 
};

var mapViewProperties = {
    mapType: Ti.Map.STANDARD_TYPE, region: initialMapRegion, regionFit: true, animate: true
};

APP.window = Ti.UI.createWindow( {
	navBarHidden: true, title: MAP.mainTitle, exitOnClose: true, backgroundColor:'#000', opacity:0	
} );

var poiWindow = null; // JIT new poiBrowser.webPageViewer( titleMenu.height, processPoiWindowEvents );
var imageViewer = null; // new poiBrowser.popupImageViewer( titleMenu.height );  // JIT

var titleMenu = new titleBar( APP.window, menuPrimary, processTitleMenuEvents );
var getDirections = new Goog.GetDirections();
var searchNearby = new Goog.SearchNearby();
var findMaps = new Goog.FindMaps( postMapSearchResults, openFoundMap );

// user settings -------------------------------------------------------------------------------------

var mapTypeOptions      = [ 'Standard Map', 'Satellite Map' ];
var travelModeOptions   = [ 'Walking', 'Bicycling', 'Driving' ];
var travelAvoidOptions  = [ 'None', 'Avoid Tolls', 'Avoid Highways', 'Tolls and Highways' ];
var mapUpdateOptions    = [ 'Once/month', 'Once/week', 'Right now!' ];
var mapStorageOptions   = [ 'Internal', 'External - SD Card' ];

var mapTypeParameters     = [ Ti.Map.STANDARD_TYPE, Ti.Map.SATELLITE_TYPE ]; 
var travelModeParameters  = [ 'walking', 'bicycling', 'driving' ];
var travelAvoidParameters = [ '', 'tolls', 'highways', 'tolls,highways' ];
var mapUpdateParameters   = [ 28 * 7 * 24, 7 * 24, 0 ];

// these must stay in numerical order
var appSettingsList = [ 
	{ id: APP.LOCATION,    title: 'Show my location',        hasCheck: true,  leftImage: myLocationIcon },
	{ id: APP.TRACKING,    title: 'Track my location',       hasCheck: false, leftImage: myTrackingIcon },
	{ id: APP.FEATURES,    title: 'Select Map Features',     hasChild: true,  checklist: null }, 
	{ id: APP.MAPVIEWTYPE, title: 'Map View Type',           hasChild: true,  options: mapTypeOptions, selected: 0  },
	{ id: APP.MAPSTORAGE,  title: 'Map Storage Location',    hasChild: true,  options: mapStorageOptions, selected: 0  },
	{ id: APP.TRAVELMODE,  title: 'Directions Travel Mode',  hasChild: true,  options: travelModeOptions, selected: 0  },
	{ id: APP.AVOIDANCE,   title: 'Directions Avoidance',    hasChild: true,  options: travelAvoidOptions, selected: 3  },
	{ id: APP.UPDATE,      title: 'Check for map updates',   hasChild: true,  options: mapUpdateOptions, selected: 0 }
];

var optLocation    = appSettingsList[APP.LOCATION];
var optTracking    = appSettingsList[APP.TRACKING];
var optMapViewType = appSettingsList[APP.MAPVIEWTYPE];
var optMapStorage  = appSettingsList[APP.MAPSTORAGE];
var optTravelMode  = appSettingsList[APP.TRAVELMODE];
var optAvoidance   = appSettingsList[APP.AVOIDANCE];
var optExpiration  = appSettingsList[APP.UPDATE].selected;

var poiIconCategories = {}; // this feature will be used later with customization...


function paidUserWarning( featureTitle, callback )
{
	Dialog.alertUser( featureTitle, 'Paid version upgrade is required to use this feature.', callback );
}

function setMapDirectory()
{
	if ( APP.isPaid && Ti.Filesystem.isExternalStoragePresent() && optMapStorage.selected == 1 ) {
		APP.dirMaps = dirMapsExternal;
		optMapStorage.selected = 1;
	}
	else {
		APP.dirMaps = dirMapsInternal;
		optMapStorage.selected = 0;
	}
}

function saveAppSettings()
{
	var settingsList = new Array();
	for ( var i in appSettingsList ) {
		settingsList.push( Util.subsetObject( appSettingsList[i], [ 'id', 'hasCheck', 'selected' ] ) );
	}
	Ti.App.Properties.setString( 'appSettingsList', JSON.stringify( settingsList ) );
}

function restoreAppSettings()
{
	APP.isOpenSrc = ( Ti.App.id.match( /\.open/i ) != null );
	// override isPaid for Map Explorer Open version
	APP.isPaid = APP.isOpenSrc || ( Ti.App.id.match( /\.paid/i ) != null );
	
	APP.version = Ti.App.version;
	APP.APPTITLE = Ti.App.name;
	if ( APP.isPaid ) APP.maxKeepMap = Number.MAX_VALUE;
	setMapDirectory();
	APP.catalog = Util.readDataFromFile( APP.CATALOG_FILE, null );
	APP.useCount = Ti.App.Properties.getInt( APP.USECOUNT, 0 );
	Ti.App.Properties.setInt( APP.USECOUNT, APP.useCount + 1 );

	var settings = JSON.parse( Ti.App.Properties.getString( 'appSettingsList', null ) );
	if ( settings == null )
		return;

	for ( var i in settings ) {
		var found = Util.findObject( appSettingsList, 'id', settings[i].id );
		if ( found != null ) Util.updateObject( found, settings[i] );
	}
	optExpiration = appSettingsList[APP.UPDATE].selected;
	settings = null;
}

function processSettingChanges()
{
	if ( appSettingsList[APP.FEATURES].changed ) {
		displayAnnotations( null );
	}
	if ( appSettingsList[APP.LOCATION].changed || appSettingsList[APP.TRACKING].changed ) {
		if ( appSettingsList[APP.TRACKING].changed && appSettingsList[APP.TRACKING].hasCheck )
			appSettingsList[APP.LOCATION].hasCheck = true;
		Geolocation.monitor( function( err ) {
			Dialog.alertUser( 'Location Error: ', err );
		} );
	}
	if ( appSettingsList[APP.MAPVIEWTYPE].changed ) {
		MAP.view.mapType = mapTypeParameters[ appSettingsList[APP.MAPVIEWTYPE].selected ];
		setTimeout( function() { MAP.view.setLocation( getMapRegion() ); }, 200 );
	}
	if ( appSettingsList[APP.MAPSTORAGE].changed ) {
		if ( APP.isPaid )
			setMapDirectory();
		else
			paidUserWarning( 'External Storage' );
	}
	if ( appSettingsList[APP.UPDATE].changed ) {
		if ( appSettingsList[APP.UPDATE].selected == 2 ) {
			appSettingsList[APP.UPDATE].selected = ( optExpiration >= 0 && optExpiration < 2 ) ? optExpiration : 0;
			var url = MAP.kmldata.kml.url;
			var name = MAP.kmldata.kml.name;
			closeMapViewer();
			openMapByUrl( url, name );
		}
		else {
			optExpiration = appSettingsList[APP.UPDATE].selected;
			if ( !APP.isPaid )
				paidUserWarning( 'Check for updates' );
		}
	}
	saveAppSettings();
}

// main window and activity event processing -----------------------------------------------------------------------

function processMenuSelection( menuItemSelected ) 
{
	switch( menuItemSelected ) {
	case APP.GOBACK:
		if ( !!poiWindow && poiWindow.isOpen() )
			closeBrowser();
		else if ( MAP.DIR.bShowing )
			exitMapDirections();
		break;
	case APP.SETTINGS:
		Dialog.multiSelect( "Settings", appSettingsList, function( settings ) {
			processSettingChanges();
		})
		break;
	case APP.POINTS:
		if ( MAP.annotations == null ) {
			Dialog.toastUser( 'This map has no points of interest' );
			break;
		}
		Dialog.selectSingle( "Points of Interest", MAP.annotations, function( annotation ) {  
			zoomToLocation( annotation );
			MAP.view.selectAnnotation( annotation );
		});
		break;
	case APP.SEARCH:			requestSearch();									break;
	case APP.MOREINFO:			openBrowserFile( appInfoFile, Util.dataFolder );	break;
	case APP.GETDIRECTIONS:		askDirections( MAP.ptLocationShowing );				break;
	case APP.SHOWDIRECTIONS:	showDirections();									break;
	case APP.NAVIGATE:			Goog.openNavigation( MAP.ptLocationShowing );		break;
	case APP.STREETVIEW:		Goog.openStreetView( MAP.ptLocationShowing );		break;
	case APP.GOOGLEMAP:			Goog.openGoogleMap( MAP.ptLocationShowing );		break;
	case APP.PREVIOUS:			!!poiWindow && poiWindow.goBack();					break;
	case APP.WHEREAMI:			showMyLocation();									break;
	case APP.FINDAMAP:			askUserFindMap();									break;
	}
}

function processWindowGoback()
{
	if ( titleMenu.isVisible() ) {
		titleMenu.hide(); 
		return;
	}
	if ( !!imageViewer && imageViewer.isOpen( ) ) {
		imageViewer.close();
		imageViewer = null;
		// return;  // don't return, allow the poiWindow to back up once
	}
	if ( !!poiWindow && poiWindow.isOpen() ) {
		poiWindow.goBack();
		return;
	}
	if ( MAP.DIR.bShowing ) {
		exitMapDirections();
		return;
	}
	Dialog.askUser( null, '\nExit this application?\n', [ 'Exit', 'Cancel' ], function( index ) {
		if ( index == 0 ) {
			APP.window.close();
		}
	});
}

function openMenu()
{
	var toOpenMenu = menu_MainMap;
	if ( !!imageViewer && imageViewer.isOpen( ) ) {
		toOpenMenu = menu_Remote;
	}
	else if ( !!poiWindow && poiWindow.isOpen() ) {
		toOpenMenu = menu_Browsing;
		if ( poiWindow.isRemote() || MAP.ptLocationShowing == null ) 
			toOpenMenu = menu_Remote;
	}
	else if ( MAP.DIR.bShowing ) {
		toOpenMenu = menu_Directions;
	}
	titleMenu.showMenu( toOpenMenu );
}

function processTitleMenuEvents( event )
{
	if ( event.action == 'open' ) {
		openMenu();
		return;
	}
	if ( event.action == 'goback' ) {
		processWindowGoback();
		return;
	}
	if ( event.action == 'select' ) {
		processMenuSelection( event.id );
		return;
	}
}

//context menus for main activity

function setMainTitle( newTitle )
{
	titleMenu.setTitle( Util.isUsefulString( newTitle ) ? newTitle : 
		( MAP.DIR.bShowing ? MAP.DIR.routeTitle : MAP.mainTitle ) ); 
}

function getMapRegion()
{
	return {
		latitude: MAP.lastKnownRegion.latitude,
		longitude: MAP.lastKnownRegion.longitude,
		latitudeDelta: MAP.lastKnownRegion.latitudeDelta,
		longitudeDelta: MAP.lastKnownRegion.longitudeDelta
	}
}

function zoomToLocation( point )
{
	if ( !Util.isDefined( point ) )
		return;
	MAP.view.setLocation({ 
		latitude: point.latitude, longitude: point.longitude, 
	    latitudeDelta: APP.ZOOMDELTA, longitudeDelta: APP.ZOOMDELTA,
		animate:true, regionFit:false });
}

function processPoiWindowEvents( windowEvent ) 
{
	if ( windowEvent.action == 'close' ) {
		MAP.menuType = MAP.DIR.bShowing ? APP.MENU_POI : APP.MENU_MAIN;
		titleMenu.progress( 0 );
		setMainTitle();
		return;
	}
	if ( windowEvent.action == 'remote' ) {
		// properties are isRemote and url
		titleMenu.progress( 0 );
		return;
	}
	if ( windowEvent.action == 'loading' ) {
		titleMenu.progress( windowEvent.progress );
		return;
	}
	if ( windowEvent.action == 'complete' || windowEvent.action == 'stop' ) {
		titleMenu.progress( 0 );
		if ( !!poiWindow && poiWindow.isRemote() ) 
			titleMenu.setTitle( poiWindow.title() );
		else
			setMainTitle();
		return;
	}
}

function mapWindowOpenEvent( event ) 
{
	var intent = Ti.Android.currentActivity.getIntent();

	if ( !Util.isUsefulString( intent.data ) ) {
		loadFirstMap();
		return;
	}
	if ( !APP.isPaid ) {
		paidUserWarning( 'Open Map by URL', function() 
		{
			askUserFindMap();
		} );
		return;
	}
	if ( !intent.data.match( /(https?:\/\/|file:\/\/|\=kml|\.kml)/i ) ) {
		askUserFindMap();
		Dialog.alertUser( 'Open Map by URL', 'Error: not a valid URL or KML file' );
		return;
	}
	openMapByUrl( intent.data, Util.extractFilename( intent.data ) );
}

function processWebViewEvents( data )
{
	if ( !!data.imageSrc ) {
		var url = data.imageSrc; // a relative url from src attribute seems to come back fully qualified
		if ( null == url.match( /https?\:\/\//i ) ) {
			var imageFile = Ti.Filesystem.getFile( url );
			if ( !imageFile.exists() ) url = data.imageUrl;
		} 
		imageViewer = new poiBrowser.popupImageViewer( titleMenu.height, url );
		return;
	}
	if ( !!data.searchselect ) {
		closeBrowser();
		popupSearchResult( searchNearby.findResult( data.searchselect ) );
		return;
	}
	if ( !!data.searchsort ) {
		MAP.bSortByDistance = ( data.searchsort == 'distance' );
		showSearchResults( null );
		return;
	}
	if ( !!data.searchagain ) {
		requestSearch();
		return;
	}
	if ( !!data.mapselect ) {
		findMaps.select( data.mapselect );
		return;
	}
	if ( !!data.findmapagain ) {
		findMaps.ask( 0 );
		return;
	}
	if ( !!data.nextmap ) {
		findMaps.ask( data.nextmap ); 
		return;
	}
	if ( !!data.sendappinfo ) {
		if ( !data.url || data.url.indexOf( 'appinfo.html' ) < 0 )
			return;
		poiWindow.setElement( 'pagetitle', APP.APPTITLE );
		poiWindow.setElement( 'pageversion', 
				APP.version + ( APP.isOpenSrc ? ' (open)' : APP.isPaid ? ' (paid)' : ' (free)' ) );
		return;
	}
	if ( !!data.externalhref ) {
		Ti.Platform.openURL( data.externalhref );
		return;
	}
}

function createBrowser()
{
	if ( poiWindow != null )
		return;
	poiBrowser = require( 'poiBrowser' ); 
	poiWindow = new poiBrowser.webPageViewer( titleMenu.height || 42, processPoiWindowEvents );
}

function openPOI( poiObject )
{
	createBrowser();
	var didOpenOkay = poiWindow.open( poiObject, MAP.folder ); 
	if ( didOpenOkay ) {
		MAP.menuType = APP.MENU_POI;
		MAP.ptLocationShowing = poiObject.point;
	}
	return didOpenOkay;
}

function closeBrowser()
{
	if ( !!imageViewer && imageViewer.isOpen( ) ) {
		imageViewer.close();
		imageViewer = null;
	}
	MAP.ptLocationShowing = null;
	if ( poiWindow == null )
		return false;
	var result = poiWindow.close();
	poiWindow = null; poiBrowser = null; 
	return result;
}

function openBrowser( title, textContent )
{
	createBrowser();
	poiWindow.open( { name: title, description: textContent }, MAP.folder );
}

function openBrowserFile( filename, folder )
{
	createBrowser();
	poiWindow.open( { localfile: filename }, folder );
}

function openBrowserRemote( urlToOpen )
{
	createBrowser();
	poiWindow.open( { remotefile: urlToOpen }, MAP.folder );
}

function latlong( locationObject )
{
	if ( !Util.isDefined( locationObject ) )
		return '';
	return locationObject.latitude + ',' + locationObject.longitude; 
}

//
// map view, POI annotations, and routes
//

function openMapViewer()
{
	if ( MAP.view != null || !MAP.kmldata )
		return;
	if ( !!MAP.kmldata.region ) Util.insertObject( mapViewProperties.region, MAP.kmldata.region );
	MAP.view = Ti.Map.createView( mapViewProperties );
	MAP.view.addEventListener( 'click', mapViewClickEvent );
	MAP.view.addEventListener( 'regionChanged', mapViewCaptureRegion );
	// note: click is the only event listener that works on android
	MAP.view.setMapType( mapTypeParameters[ appSettingsList[APP.MAPVIEWTYPE].selected ] );
	APP.window.add( MAP.view );
}

function closeMapViewer()
{
	if ( MAP.view == null )
		return;
	MAP.view.removeEventListener( 'click', mapViewClickEvent );
	MAP.view.removeAllAnnotations();
	APP.window.remove( MAP.view );
	Util.tiObjectCleanup( MAP.view );
	MAP.view = null;
	MAP.kmldata = null;
	MAP.mainTitle = '';
	MAP.menuType = APP.MENU_MAIN;
	MAP.folder = null;
	MAP.annotations = null;
	MAP.lastSearchAnnotation = null;
	MAP.ptLocationShowing = null;
	MAP.positionMarker = null;
	MAP.bDownloadPics = false;
	MAP.bSortByDistance = true;
	MAP.descriptor = null;
	MAP.DIR.bShowing = false;
	MAP.DIR.routeTitle = null;
	MAP.DIR.priorRegion = null;
}

var mapViewCaptureRegion = function( ev )
{
	MAP.lastKnownRegion.latitude = ev.latitude;
	MAP.lastKnownRegion.longitude = ev.longitude;
	MAP.lastKnownRegion.latitudeDelta = ev.latitudeDelta;
	MAP.lastKnownRegion.longitudeDelta = ev.longitudeDelta;
}

var mapViewClickEvent = function( ev ) 
{
	switch ( ev.annotation.type ) {
	case MAP.ID.PTINTEREST:
		if ( openPOI( MAP.kmldata.places[ev.annotation.myid] ) )
			MAP.view.deselectAnnotation( ev.annotation );
		break;
	case MAP.ID.DIRECTIONS:
		// do nothing, allow annotation to show
		break;
	case MAP.ID.MYLOCATION:
		MAP.view.deselectAnnotation( ev.annotation );
		popupLocation( MAP.positionMarker );
		break;
	case MAP.ID.SEARCHRESULT:
		MAP.view.deselectAnnotation( ev.annotation );
		searchResultsAction( searchNearby.findResult( ev.annotation.searchid ) );
		break;
	}
}

function makePOIList()
{
	MAP.annotations = null;
	MAP.annotations = new Array();
	appSettingsList[APP.FEATURES].checklist = null;
	appSettingsList[APP.FEATURES].checklist = new Array();
	var namedIcons = appSettingsList[APP.FEATURES].checklist;
	var iconFolder = MAP.folder + Ti.Filesystem.separator;
	
	for ( var i = 0, l = MAP.kmldata.places.length; i < l; i++ ) {
		var placemark = MAP.kmldata.places[i];
		var iconHref = !!placemark.icon ? ( iconFolder + placemark.icon ) : defaultPinIcon; 
		var iconName = Util.extractFilename( iconHref );
		MAP.annotations.push( Ti.Map.createAnnotation( {
		    latitude: placemark.point.latitude, longitude: placemark.point.longitude,
		    title: placemark.name, animate: false, iconname: iconName,
		    image: iconHref, visibleImage: iconHref, 
		    myid: (i + MAP.ID.PTINTEREST), type: MAP.ID.PTINTEREST
			} ) );

		if ( Util.findObject( namedIcons, 'name', iconName ) )
			continue;
		var hasIcon = poiIconCategories[ iconName ];
		if ( !!placemark.icon ) {
			namedIcons.push( {
				name: iconName, href: iconHref, visibleImage: iconHref, hasCheck: true,
				title: hasIcon ? hasIcon : iconName.replace( /\.[^\.]*$/, '' ).replace( /[-_]/g, ' ' )
			} );
		}
	}
	namedIcons = null;
	return MAP.annotations;
}

function displayAnnotations( annotationList )
{
	MAP.view.removeAllAnnotations();
	if ( annotationList == null ) annotationList = MAP.annotations; 
	var namedIcons = appSettingsList[APP.FEATURES].checklist;
	for ( var j = 0, m = namedIcons.length; j < m; j++ ) {
		if ( namedIcons[j].hasCheck && !namedIcons[j].changed ) 
			continue;
		for ( var i = 0, l = annotationList.length; i < l; i++ ) {
			if ( namedIcons[j].name == annotationList[i].iconname )
				annotationList[i].image = namedIcons[j].hasCheck ? annotationList[i].visibleImage : speckRedIcon;
		}
	}
	MAP.view.addAnnotations( annotationList );
	if ( MAP.positionMarker != null )
		MAP.view.addAnnotation( MAP.positionMarker );
	if ( MAP.lastSearchAnnotation != null )
		MAP.view.addAnnotation( MAP.lastSearchAnnotation ); 
	namedIcons = null; 
}

function validate( entryValue, defaultValue )
{
	return ( typeof entryValue == 'undefined' || entryValue == null ) ? defaultValue : entryValue;
}

function displayMapDataRoutes() 
{
	for ( var i in MAP.kmldata.routes ) {
		var gmroute = MAP.kmldata.routes[i];
		var stline = !!gmroute.lineStyle ? gmroute.lineStyle : {};
		MAP.view.addRoute( { 
			name:     validate( gmroute.name, 'unnamed' ),
			color:    validate( stline.color, '#0000DD' ),
			width:    validate( stline.width, 6 ),
			opacity:  validate( stline.opacity, 50 ),
			points:   gmroute.line
		} );
	}
	for ( var i in MAP.kmldata.shapes ) {
		var gmshape = MAP.kmldata.shapes[i];
		var stline = !!gmshape.lineStyle ? gmshape.lineStyle : {};
		var stfill = !!gmshape.fillStyle ? gmshape.fillStyle : {};
		MAP.view.addRoute( { 
			name:        validate( gmshape.name, 'unnamed' ),
			color:       validate( stline.color, '#008800' ),
			opacity:     validate( stline.opacity, 100 ),
			width:       validate( stline.width, 2 ),
			fillcolor:   validate( stfill.color, '#00EE00' ),
			fillopacity: validate( stfill.opacity, 50 ),
			points:      gmshape.line
		} );
	}
}

// Geolocation -------------------------------------------------------------------------------------

function toastForLocation() 
{
	Dialog.toastUser( "Waiting for Location" );
}

function _ClassGeolocation()
{
	var isGeoEnabled = false;
	var headingAdded = false;
	var locationAdded = false;

	var headingCallback = function(e)
	{
	    Ti.API.info("Received heading callback");
	}

	var locationCallback = function(e)
	{
		if ( e.success != true ) {
			Ti.API.debug( 'locationCallback: ERROR = ' + e.error.message );
			return;
	    }
		if ( MAP.positionMarker != null && !!MAP.view )
			MAP.view.removeAnnotation( MAP.positionMarker ); 
		MAP.positionMarker = null;
		myLocation.latitude = e.coords.latitude;
		myLocation.longitude = e.coords.longitude;
		MAP.positionMarker = Ti.Map.createAnnotation( myLocation );
		if ( !!MAP.view ) {
			MAP.view.addAnnotation( MAP.positionMarker );
			if ( optTracking.hasCheck ) {
				var reg = getMapRegion();
				reg.latitude = e.coords.latitude;
				reg.longitude = e.coords.longitude;
				MAP.view.setLocation( reg );
			}
		}
	}

	this.enable = function() 
	{
		if ( isGeoEnabled )
			return;
		Ti.Geolocation.purpose = 'Get Current Location';
		Ti.Geolocation.accuracy = Ti.Geolocation.ACCURACY_BEST;
		Ti.Geolocation.preferredProvider = Ti.Geolocation.PROVIDER_GPS;
		Ti.Geolocation.distanceFilter = 10;  // change for walking vs. biking vs. driving

		// use 'heading' for showing a compass
		//	Ti.Geolocation.addEventListener( 'heading', headingCallback);
		//	headingAdded = true;
		
		Ti.Geolocation.addEventListener( 'location', locationCallback);
		locationAdded = true;
		isGeoEnabled = true;
	}

	this.disable = function()
	{
		if ( !isGeoEnabled )
			return;
	    if (headingAdded) {
	        Ti.Geolocation.removeEventListener( 'heading', headingCallback);
	        headingAdded = false;
	    }
	    if (locationAdded) {
	        Ti.Geolocation.removeEventListener( 'location', locationCallback);
	        locationAdded = false;
	    }
		if ( MAP.view != null && MAP.positionMarker != null )
			MAP.view.removeAnnotation( MAP.positionMarker );
		MAP.positionMarker = null;
		isGeoEnabled = false;
	}
	
	this.monitor = function( callLocationError )
	{
		myLocation.image = appSettingsList[APP.TRACKING].hasCheck ? myTrackingIcon : myLocationIcon;
		if ( !optLocation.hasCheck ) {
	        Ti.API.info( 'monitorLocation: disable location' );
			this.disable();
			return;
		}
		if ( !Ti.Geolocation.locationServicesEnabled ) {
	        Ti.API.info( 'monitorLocation: Location services are NOT enabled' );
			if ( callLocationError ) 
				callLocationError( 'Location services are NOT enabled' );
			return;
		}
	    Ti.API.info( 'monitorLocation: enable location services' );
		Ti.Geolocation.getCurrentPosition( locationCallback );
		this.enable();
	}
}

var Geolocation = new _ClassGeolocation();

function popupLocation( geoPoint )
{
	/* reverseGeocoder example response:
	 * {"places":[
	 * 	 {"street1":"Congress St","postalCode":"02114","address":"Congress St, Boston, MA  02114, , United States",
	 * 		 "displayAddress":"Congress St, Boston, MA  02114, , United States","street":"Congress St","countryCode":"US",
	 * 		 "region2":"","longitude":"-71.058000",
	 * 		 "region1":"","latitude":"42.362000","country_code":"US","country":"United States","city":"Boston"}],
	 *  "source": {"locationServicesEnabled":true,"hasCompass":true,"preferredProvider":"gps","accuracy":0,
	 * 		"_events":{"location":{}},"purpose":"Get Current Location","distanceFilter":5},
	 *  "success":true}	
	 */	
	Ti.Geolocation.reverseGeocoder( geoPoint.latitude, geoPoint.longitude, function( ev ) {
		if ( ev.success != true ) {
			Dialog.alertUser( 'My Location', 'Error: unable to discover location' );
			return;
		}
		Dialog.alertUser( 'My Location', ev.places[0].displayAddress );
	});
}

function showMyLocation()
{
	function showLoc( e )
	{
		MAP.view.selectAnnotation( MAP.positionMarker );
		zoomToLocation( myLocation );
	}

	if ( !Ti.Geolocation.locationServicesEnabled ) {
		Dialog.alertUser( 'Show My Location', 'Error: location services are NOT enabled.' );
		return;
	}
	if ( !optLocation.hasCheck ) {
		Dialog.askUser( 'Show My Location', 'OK to enable my location?', [ 'Enable', 'Cancel' ], function(index) {
			if ( index != 0 )
				return;
			toastForLocation();
			Geolocation.enable();
			Ti.Geolocation.getCurrentPosition( showLoc );
		} );
		return;
	}
	Ti.Geolocation.getCurrentPosition( showLoc );
}

// Application State (power savings) ---------------------------------------------------------------------------

function _ClassAppState()
{
	var appActiveState = true; // of course, it never starts out inactive
	var timeoutEvent = null;
	var isDestroying = false;

	function checkToDisable()
	{
		if ( isDestroying )
			return;
		if ( MAP.view != null ) {
			return;
		}
	    Ti.API.debug( 'AppState.checkToDisable: DISABLING Geolocation' );
		appActiveState = false;
		Geolocation.disable();
	}
	
	function checkToEnable()
	{
		if ( isDestroying )
			return;
		if ( MAP.view == null || MAP.view.visible ) {
			return;
		}
	    Ti.API.debug( 'AppState.checkToEnable: ENABLING Geolocation' );
		appActiveState = true;
		Geolocation.enable();
	}

	function checkAppState()
	{
		if ( isDestroying )
			return;
		if ( appActiveState && MAP.view != null ) {
			setTimeout( checkToDisable, 15000 );
		}
		else if ( !appActiveState && MAP.view != null ) {
			setTimeout( checkToEnable, 2000 );
		}
	}

	this.manage = function( appEvent )
	{
		if ( appEvent.type == 'destroy' ) {
			closeMapViewer();
			isDestroying = true;
			return;
	    }
		if ( appEvent.type == 'blur' || appEvent.type == 'focus' )
			timeoutEvent = setTimeout( checkAppState, 3000 );
	}
}

var AppState = new _ClassAppState();

// Get Directions -------------------------------------------------------------------------------------

function getRegionFromBounds( bounds )
{
	if ( !Util.isDefined( bounds ) )
		return null;
	var nelat = Number( bounds.northeast.lat );
	var nelng = Number( bounds.northeast.lng );
	var swlat = Number( bounds.southwest.lat );
	var swlng = Number( bounds.southwest.lng );
	var region = {
		latitude: ( nelat + swlat ) / 2, longitude: ( nelng + swlng ) / 2,
		latitudeDelta: nelat - swlat, longitudeDelta: nelng - swlng
	}
	nelat = null; nelng = null; swlat = null; swlng = null;
	return region;
}

function exitMapDirections()
{
	MAP.DIR.bShowing = false;
	MAP.menuType = APP.MENU_MAIN;
	closeBrowser();
	MAP.view.removeRoute( MAP.DIR.routePoints );
	displayAnnotations( null );
	MAP.view.setLocation( MAP.DIR.priorRegion );
	setMainTitle();
	MAP.DIR.routePoints = null;
}

function showDirections()
{
	openBrowser( null, getDirections.formatResults() );
}

function askDirections( whereToGo )
{
	var directionPts = new Array(), routePts = new Array();

	function processDirections( directionsResponse )
	{
		var leg = directionsResponse.routes[0].legs[0];
		var step = null, id = MAP.ID.DIRECTIONS;
		var nsteps = ( !!leg && !!leg.steps && !!leg.steps.length ) ? leg.steps.length : 0;
		MAP.DIR.routeTitle = leg.end_address;

		// prepare map for new perspective
		MAP.view.setLocation( getRegionFromBounds( directionsResponse.routes[0].bounds ) );
		MAP.view.removeAllAnnotations();
		
		for ( var i = 0; i < nsteps; i++ ) {
			step = leg.steps[i];
			routePts.push( { 
				latitude: step.start_location.lat, longitude: step.start_location.lng,
			    title: 'Step ' + (i + 1) + ': ' + step.distance.text + ', ' + step.duration.text, 
			    subtitle: Util.stripTags( step.html_instructions ), animate: false, 
			    myid: id++, type: MAP.ID.DIRECTIONS, image: ( i == 0 ) ? wayptWhiteIcon : wayptRedIcon 
			} ); 
			directionPts.push( Ti.Map.createAnnotation( routePts[ i ] ) );
		}
		if ( step != null ) {
			routePts.push( { 
				latitude: step.end_location.lat, longitude: step.end_location.lng,
			    title: 'Destination: ' + leg.distance.text + ', ' + leg.duration.text, 
			    subtitle: MAP.DIR.routeTitle, animate: false, 
			    myid: id, type: MAP.ID.DIRECTIONS, image: wayptBlueIcon 
			} );
			directionPts.push( Ti.Map.createAnnotation( routePts[ nsteps ] ) );
		}
		MAP.DIR.routePoints = { 
			color:'blue', width:8, opacity:'75%', name:MAP.DIR.routeTitle, points:routePts
		}; 
		MAP.view.addRoute( MAP.DIR.routePoints ); 
		displayAnnotations( directionPts );
		routePoints = null; directionPts = null; leg = null; step = null; id = null;
	}
	
	var requestParams = {
		origin: myLocation,
		destination: whereToGo,
		travelMode: travelModeParameters[ optTravelMode.selected ],
		travelAvoid: travelAvoidParameters[ optAvoidance.selected ]
	};

	getDirections.request( requestParams, function( response ) {
		if ( response.status != 'OK' ) {
	        Dialog.alertUser( 'Ask directions', 'Error: failed response from Google Maps' );
		}
		else {
			closeBrowser();
			MAP.menuType = APP.MENU_POI;
			MAP.DIR.priorRegion = getMapRegion();
			processDirections( response );
			MAP.DIR.bShowing = true;
			setMainTitle();
		}
		requestParams = null;
	} );
}

// Search Nearby -------------------------------------------------------------------------------------

function popupSearchResult( foundItem )
{
	this.annotationNumber = !!this.annotationNumber ? this.annotationNumber + 1 : MAP.ID.SEARCHRESULT;
	if ( MAP.lastSearchAnnotation != null ) {
		MAP.view.removeAnnotation( MAP.lastSearchAnnotation );
		MAP.lastSearchAnnotation = null;
	}
	MAP.lastSearchAnnotation = Ti.Map.createAnnotation( {
	    latitude: Number( foundItem.geometry.location.lat ), 
	    longitude: Number( foundItem.geometry.location.lng ),
	    title: foundItem.name, subtitle: foundItem.vicinity,
	    animate: false, image: foundGreenIcon,
	    myid: this.annotationNumber, type: MAP.ID.SEARCHRESULT,
	    searchid: foundItem.id
	} );
	MAP.view.addAnnotation( MAP.lastSearchAnnotation );
	zoomToLocation( MAP.lastSearchAnnotation );
	MAP.view.selectAnnotation( MAP.lastSearchAnnotation );
}

var searchActionList = [ 'Get directions', 'Show details', 'Navigate To', 'Street View', 'Google Maps' ];

function searchResultsAction( foundItem )
{
	/* foundItem (example):
	 * geometry = [object Object]
	 * icon = http://maps.gstatic.com/mapfiles/place_api/icons/generic_business-71.png
	 * id = 19
	 * name = Haymarket Pizza
	 * reference = CnRmAAAAzspMyliTnM3iDA5gLoF_w0i4QKgHtEL4uS6rpi1K6ax4p6OCjzw-4zKYQNHcizHxrXjMaXHebcfv2dkhJnsg2SgCbnlRf_H8tCtyMFP3jU-0qEa8M9s6_0GaMUSfx9QOEMrK7d_5XeFI_w1vv2IGThIQCpFrglapQLHtg6NL_PgXxBoUJF8aUAY0IEE_2YfK8r5TcmrZ7eA
	 * types = food,establishment
	 * vicinity = 106 Blackstone Street, Boston
	 * distance = 345.96384049248286	
	 */
	Dialog.selectOption( foundItem.name, searchActionList, null, null, function( index ) {
		var foundPt = { latitude: foundItem.geometry.location.lat, longitude: foundItem.geometry.location.lng }; 
		switch ( index ) {
		case 0: // get directions
			closeBrowser();
			askDirections( foundPt );
			break;
		case 1: // show details
			Goog.getPlaceDetails( foundItem.reference, function( urlDetails ) {
				// the place details web page from Google Plus is huge (~250k) and is 
				// extremely unstable when rendered by the WebView object. So it's better 
				// to call up a real browser even though it will hog more memory this way.
				Ti.Platform.openURL( urlDetails );
			} );
			break;
		case 2: // navigate to
			closeBrowser();
			Goog.openNavigation( foundPt );
			break;
		case 3: // street view
			closeBrowser();
			Goog.openStreetView( foundPt );
			break;
		case 4: // google maps
			closeBrowser();
			Goog.openGoogleMap( foundPt );
			break;
		}
		foundPt = null;
	});
}

function showSearchResults( fromThisLocation )
{
	openBrowser( 'Search Results for:', searchNearby.formatResults( MAP.bSortByDistance, fromThisLocation ) );
}

function requestSearch()
{
	searchNearby.askUser( getMapRegion(), function( response ) {
		if ( response.status == 'ZERO_RESULTS' ) {
			Dialog.alertUser( 'Search Nearby', 'No results found' );
			return;
		}
		if ( response.status != 'OK' ) {
	        Ti.API.info('processSearchResults, status = ' + response.status );
	        Dialog.alertUser( 'Search Nearby', 'Error: failed response from Google Maps' );
			return;
		}
		showSearchResults( MAP.ptLocationShowing == null ? myLocation : MAP.ptLocationShowing );
	});
}


// Find Maps -------------------------------------------------------------------------------------

function saveCatalog()
{
	Util.writeDataToFile( APP.CATALOG_FILE, APP.catalog );
}

function getSortedMapList()
{
	var listMaps = new Array();
	for ( var i in APP.catalog ) {
		listMaps.push( { title: APP.catalog[i].name, source: APP.catalog[i], time:APP.catalog[i].lastviewed } );
	}
	listMaps.sort( function( a, b ) { return b.time - a.time; } );
	return listMaps;
}

function openFoundMap( mapDescription )
{
	var summaryView = findMaps.makeSummaryView( mapDescription, MAP.bDownloadPics );
	
	if ( !!mapDescription.urlInput && !APP.isPaid ) {
		paidUserWarning( 'Open Map by URL' );
		return;
	}
	
	Dialog.askUser( 'Open this map?', summaryView, [ 'Open', 'Cancel' ], function( index ) 
	{
		if ( index != 0 )
			return;
		// 
		closeBrowser();
		closeMapViewer();
		MAP.bDownloadPics = summaryView.doDownloadPics(); 
		var link = mapDescription.link;
		if ( mapDescription.displayLink == 'maps.google.com' && ( mapDescription.fileFormat != 'KML Document' ) ) {   
			link += '&output=kml';
		}
		MAP.mainTitle = APP.APPTITLE;
		MAP.menuType = APP.MENU_MAIN;
		setMainTitle();
		if ( !MAP.bDownloadPics || APP.isPaid ) {
			openMapByUrl( link, mapDescription.title );
		}
		else {
			MAP.bDownloadPics = false;
			paidUserWarning( 'Download Map Images', function() 
			{
				openMapByUrl( link, mapDescription.title );
			} );
		}
		Util.tiObjectCleanup( summaryView );
		summaryView = null;
	});
}

function postMapSearchResults( searchResults )
{
	openBrowser( 'Select a map:', findMaps.formatResults( searchResults ) );
}

function whereIsThisMap( foldername )
{
	var dirFolder = Ti.Filesystem.getFile( dirMapsExternal, foldername );
	if ( !dirFolder.exists() ) {
		dirFolder = Ti.Filesystem.getFile( dirMapsInternal, foldername );
	}
	return dirFolder;
}

function deleteMap( foldername )
{
	var dirFolder = whereIsThisMap( foldername );
	Util.deleteFolder( dirFolder.nativePath );
	if ( APP.catalog.hasOwnProperty( foldername ) ) {
		APP.catalog[ foldername ] = null;
		delete APP.catalog[ foldername ];
	}
}

function deleteOldMaps( sortedMapList )
{
	if ( !sortedMapList || sortedMapList.length <= APP.maxKeepMap )
		return;
	for ( var i = 0, l = sortedMapList.length; i < l; i++ ) {
		if ( i < APP.maxKeepMap )
			continue;
		deleteMap( sortedMapList[i].source.foldername );
	}
	saveCatalog();
}

function askUserDeleteMap()
{
	var listMaps = new Array();
	var catItem = null, catItemID = null;
	for ( var i in APP.catalog ) {
		listMaps.push( { title:APP.catalog[i].name, id:i } );
	}
	Dialog.selectOption( 'Select a map to delete', listMaps, null, 'delete', function( index ) 
	{
		if ( index < 0 || index >= listMaps.length )
			return;
		catItemID = listMaps[ index ].id;
		catItem = APP.catalog[ catItemID ]; 
		Dialog.askUser( 'Delete this map?', catItem.name, [ 'Delete', 'Cancel' ], function( index ) 
		{
			if ( index != 0 )
				return;
			deleteMap( catItem.foldername );
			saveCatalog();
			if ( !!MAP.descriptor && !!MAP.descriptor.foldername && MAP.descriptor.foldername == catItem.foldername ) {
				closeMapViewer();
				askUserFindMap();
			}
		} );
	} );
}

function askUserFindMap() 
{
	var selection = null;
	var listMaps = getSortedMapList();

	var alertDialog = Dialog.createAlertDialog( { 
		title:'Select a map', options:listMaps, buttonNames:[ 'Cancel', 'Delete...', 'Search...' ] 
	} );
	alertDialog.addEventListener( 'click', function( event ) 
	{
		if ( event.button ) {
			switch ( event.index ) {
			case 0: 							break;		// Cancel
			case 1: 	askUserDeleteMap();		break;		// Delete...
			case 2:		findMaps.ask( 0 );		break;		// Search...
			}
		}
		else if ( event.index >= 0 ) {
			selection = listMaps[ event.index ].source;
			Dialog.askUser( 'Open this map?', selection.name, [ 'Open', 'Cancel' ], function( index ) 
			{
				if ( index != 0 )
					return;
				alertDialog.hide();
				closeBrowser();
				closeMapViewer();
				openMap( selection );
			} );
		}
	});
	alertDialog.show();
}

// opening a map -------------------------------------------------------------------------------------

/* openMap, mapDescriptor example:
 *  name = Freedom Trail Map & Historic Boston Guide
 *  namespace = http://earth.google.com/kml/2.2
 *  description = Map of The Freedom Trail and Historic Boston ....
 *  filename = UCMAy1_map.json
 *  googlename = Freedom Trail Map  Historic Boston Guide.kml
 *  foldername = UCMAy1
 *  url = http://maps.google.com/maps/ms?ie=UTF8&oe=UTF8&msa=0&msid=206031866060712988797.0004af929d103d768096e&output=kml
 *  date = Thu, 24 May 2012 03:18:41 GMT
 *  size = 75646
 *  checksum = 1629402141
 *  storage = 92441
 *  dateChecked = 1340727405367
 *  lastviewed = 1340727405415
 */
function openMap( mapDescriptor )
{
	function failToOpen( message )
	{
		Dialog.alertUser( 'Open map', 'Error: ' + message );
	}
	
	function checkForMapUpdate( mapDescriptor )
	{
		if ( !mapDescriptor.date || !APP.isPaid )
			return false;
		var mapDate = mapDescriptor.dateChecked || new Date( mapDescriptor.date );
		var mapAge = Math.round( ( Date.now() - mapDate ) / ( 1000 * 60 * 60 * 24 ) ); 
		mapDescriptor.dateChecked = Date.now();
		if ( mapAge <= ( mapUpdateParameters[ optExpiration ] ) )
			return false;
		Dialog.askUser( mapDescriptor.name, 'OK to check for a map update now?', [ 'Check for Update', 'Cancel' ], function( index ) 
		{
			if ( index == 0 ) 
				openMapByUrl( mapDescriptor.url, mapDescriptor.name );
			else
				openMap( mapDescriptor );
		} );
		return true;
	}
	if ( !mapDescriptor || !!mapDescriptor.error ) {
		failToOpen( mapDescriptor.error || 'Undefined map' );
		return;
	}
	var mapFolder = whereIsThisMap( mapDescriptor.foldername );
	if ( !mapFolder.exists() ) {
		openMapByUrl( mapDescriptor.url, mapDescriptor.name );
		return;
	}
	if ( checkForMapUpdate( mapDescriptor ) ) {
		return;
	}
	var mapFile = Ti.Filesystem.getFile( mapFolder.nativePath, mapDescriptor.filename );
	if ( !mapFile.exists() ) {
		failToOpen( 'map file does not exist' );
		return;
	}
	var toast = Dialog.toastAndWait( 'Opening map...' );
	try {
		MAP.kmldata = JSON.parse( mapFile.read() );
	}
	catch ( parseError ) {
		toast.hide();
		toast = null;
		failToOpen( parseError );
		return;
	}
	MAP.folder = mapFolder.nativePath; 
	mapDescriptor.lastviewed = Date.now();
	MAP.descriptor = mapDescriptor; 
	APP.catalog[ mapDescriptor.foldername ] = mapDescriptor;
	saveCatalog();
	MAP.mainTitle = MAP.kmldata.kml.name; 
	openMapViewer();
	setMainTitle();
	toast.hide();
	toast = null;
	displayMapDataRoutes();
	displayAnnotations( makePOIList() );
	Util.saveSetting( 'lastGoodMap', mapDescriptor.foldername );
}

function openMapByUrl( kmlUrl, mapName )
{
	if ( !Util.isUsefulString( mapName ) ) mapName = 'Remote Map';
	getRemoteMap( { name: mapName, url: kmlUrl }, function( mapDescriptor )
	{
		openMap( mapDescriptor );
		deleteOldMaps( getSortedMapList() );
	} );   
}

function getRemoteMap( mapDescriptor, callWhenMapIsLoaded )
{
	var mapFolder = APP.dirMaps;
	if ( !!mapDescriptor.foldername ) {
		// a map folder is sticky - keep writing updates in the same location
		var dir = whereIsThisMap( mapDescriptor.foldername );
		if ( dir.exists() )
			mapFolder = APP.isApple ? dir.getParent() : dir.getParent().nativePath;
	}
	var kmlWindow = Ti.UI.createWindow({
	    url:'ProcessKML.js', title: 'KML downloader',
	    navBarHidden: true, opacity: 0, download: MAP.bDownloadPics, folder: mapFolder,
	    kmlurl: mapDescriptor.url, name: mapDescriptor.name 
	});
	kmlWindow.addEventListener( 'complete', function( kmlResult )
	{
		// fireEvent process automatically inserts type and source fields, so remove them
		if ( !!kmlResult.type ) delete kmlResult.type; 
		if ( !!kmlResult.source ) delete kmlResult.source; 
		kmlWindow.close();
		kmlWindow = null;
		if ( !!callWhenMapIsLoaded ) callWhenMapIsLoaded( kmlResult );
	} );
	kmlWindow.addEventListener( 'error', function( kmlResult ) 
	{
		Dialog.alertUser( 'Map download', 'Error: ' + kmlResult.error );
		kmlWindow.close();
		kmlWindow = null;
	} );

	kmlWindow.open();
}

function loadFirstMap()
{
	var mapID = Util.restoreSetting( 'lastGoodMap', null );
	if ( !!APP.catalog && !!APP.catalog[ mapID ] ) {
		openMap( APP.catalog[ mapID ] );
	}
	else {
		askUserFindMap();
	}
}

// application startup code...

Ti.Android.currentActivity.addEventListener( 'create',  AppState.manage );
Ti.Android.currentActivity.addEventListener( 'destroy', AppState.manage );
APP.window.addEventListener( 'blur',   AppState.manage );
APP.window.addEventListener( 'focus',  AppState.manage );

APP.window.addEventListener( 'android:back', processWindowGoback ); 
APP.window.addEventListener( 'open', mapWindowOpenEvent ); 
APP.window.getActivity().onPrepareOptionsMenu = openMenu;
Ti.App.addEventListener( 'fromWebView', processWebViewEvents ); 

restoreAppSettings();
Geolocation.monitor();

APP.window.open();

// end