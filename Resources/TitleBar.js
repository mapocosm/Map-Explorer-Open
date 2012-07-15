/*
 * file: TitleBar.js
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
 * TitleBar.js is a module that will render an application title bar with pulldown menus
 * and built-in icon buttons for context menu and go-back.
 * One object is exported:
 *   - TitleBar
 *   
 * When tapped, the context menu icon will ask the calling program for a menu, which TitleBar 
 * will render. This construct is transportable between Android and iOS. The calling program 
 * may want to tie the content and back buttons to the OS-specific feature (i.e. HW buttons).
 * TitleBar should automatically size itself for smaller and larger screens, i.e. phones 
 * versus high-def phones and tablets.
 * 
 */

var Util = require( 'UtilityFunctions' ); 

module.exports = TitleBar;

var pulldownImage = Util.imagePath + 'down-yellow-small.png';
var gobackImage   = Util.imagePath + 'left-blue-small.png';

var UNICODE_DIAMOND		= '\u25C6';
var UNICODE_LEFTTRI		= '\u25C0';
var UNICODE_BOXBLANK	= '\u2610';
var UNICODE_BOXCHECK	= '\u2611';
var UNICODE_BOXCROSS	= '\u2612';
var UNICODE_HAND		= '\u270B';

var menuIndicator = '  ' + UNICODE_DIAMOND + ' ';

var pWidth  = Titanium.Platform.displayCaps.platformWidth;
var pHeight = Titanium.Platform.displayCaps.platformHeight;
var pMaxDim = Math.max( pWidth, pHeight );
var bShortDisplay = ( pMaxDim < 860 );

var titleBarHeight = bShortDisplay ? 42 : 58;
var progressHeight = bShortDisplay ? 4 : 6;
var tableRowHeight = '36dp';
var titleIconWidth = Math.round( 1.1 * titleBarHeight );
var menuItemFont   = { fontSize: '18dp' };  
var titleBarFont   = { fontWeight:'bold', fontSize: '12dp' }; 

/*
 * menurows is an array of objects having properties: title, visible, id
 * callbackEvent will generate events with 'action' property as: 
 * 'open', 'goback', or 'select'
 */

function TitleBar( parentWindow, menuRows, callbackEvent )
{
	var menuTable = null, dataList = null; var menuView = null;
	
	var titleView = Ti.UI.createView({
	    backgroundColor:'#777', layout:'absolute', 
	    top:0, left:0, height:titleBarHeight, width:Ti.UI.FILL, zIndex:21
	});
	var titleGobackImage = Ti.UI.createImageView({
	    image: gobackImage, canScale:false, enableZoomControls:false, 
	    left:0, width:titleIconWidth, zIndex:22
	});
	var titleLabel = Ti.UI.createLabel({
	    text:'Title Bar', textAlign:Ti.UI.TEXT_ALIGNMENT_LEFT,
	    color:'#EEE', font:titleBarFont, wordWrap:false, ellipsize:true, 
		width:Ti.UI.FILL, height:Ti.UI.FILL, top:0, left:titleIconWidth, right:titleIconWidth, zIndex:22 
	});
	var titleSelectImage = Ti.UI.createImageView({
	    image: pulldownImage, canScale:false, enableZoomControls:false, backgroundColor:'#777', 
	    height:'90%', right:0, width:titleIconWidth, zIndex:23
	});
	var titleProgressIndicator = Ti.UI.createView({
		backgroundColor:'#00FF00', height: progressHeight, top: titleBarHeight - progressHeight, 
		width:0, left:0, zIndex:25
	});

	function clickTableRow( event ) 
	{
		if ( menuView != null )
			closeMenu();
		if ( !!callbackEvent ) callbackEvent( { 
			action: 'select', index: event.index, id: dataList[event.index].id, title: dataList[event.index].title 
		} );
	}

	function closeMenu()
	{
		if ( menuView == null ) 
			return;
		menuView.top = 0;
		menuView.animate( { top: -1 * pHeight, duration: 150 }, function()
		{
			menuTable.removeEventListener( 'click', clickTableRow );
			try {
				parentWindow.remove( menuView ); 
				Util.tiObjectCleanup( menuView );
			}
			finally {
				dataList = null; menuTable = null; menuView = null; 
			}
		} );
	}
	
	this.showMenu = function( toShowList )
	{
		var setOpacity = ( Ti.Platform.osname == 'android' && Ti.Platform.Android.API_LEVEL > 13 ) ? 0.9 : 0.7;
		if ( menuView != null ) {
			closeMenu();
			return;
		}  
		dataList = new Array();
		for ( var i in toShowList ) {
			var menuItem = Util.findObject( menuRows, 'id', toShowList[ i ] );
			dataList.push( { // table row properties
				backgroundColor:'#000', textAlign:'right', font:menuItemFont, color:'#FFF', opacity:1.0,
				title: menuItem.title + menuIndicator, id: menuItem.id
			} );
		}
		menuTable = Ti.UI.createTableView( { 
			data: dataList, minRowHeight:tableRowHeight
		} ); 
		menuTable.addEventListener( 'click', clickTableRow );
		menuView = Ti.UI.createView( { 
			layout:'vertical', top:titleBarHeight, backgroundColor:'#000', zIndex:19, opacity:setOpacity 
		} );
		menuView.add( menuTable );
		menuView.add( Ti.UI.createView( { backgroundColor:'#BBB', height:2, width:'100%' } ) );
		menuView.top = -1 * pHeight; 
		parentWindow.add( menuView );
		menuView.animate({ top: titleBarHeight, duration: 350 }, function() 
		{
			menuView.top = titleBarHeight;
		} );
	}
	
	this.height = titleBarHeight;

	this.isVisible = function()
	{
		return ( menuView != null );  
	}
	
	this.setTitle = function( newTitle )
	{
		titleLabel.setText( newTitle ); 
	}
	
	this.hide = function()
	{
		closeMenu();
	}

	this.progress = function( setWidth )
	{
		setWidth = Math.max( 0, Math.min( Number( setWidth ), 100 ) );
		if ( setWidth == 0 ) {
			titleProgressIndicator.hide();
			return;
		}
		titleProgressIndicator.width = setWidth + '%';
		if ( !titleProgressIndicator.visible )
			titleProgressIndicator.show();
	}
	
	this.close = function()
	{
		Util.tiObjectCleanup( titleView );
		menuTable = null; dataList = null; titleView = null; titleLabel = null; 
		titleGobackImage = null; titleSelectImage = null; titleProgressIndicator = null;
	}

	titleView.add( titleGobackImage );
	titleView.add( titleSelectImage );
	titleView.add( titleLabel );
	titleView.add( titleProgressIndicator );

	titleGobackImage.addEventListener( 'click', function( ev )
	{
		if ( menuView != null ) {
			closeMenu();
			return;
		} 
		if ( !!callbackEvent ) callbackEvent( { action: 'goback' } );
	} );
	
	titleSelectImage.addEventListener( 'click', function( ev ) 
	{
		if ( menuView != null ) { 
			closeMenu();
			return;
		} 
		if ( !!callbackEvent ) callbackEvent( { action: 'open' } );
	} );

	parentWindow.add( titleView );
}
