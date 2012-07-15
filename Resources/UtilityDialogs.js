/* 
 * file: UtilityDialogs.js
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
 * UtilityDialogs.js module that manages pop-up dialogs and alerts.
 * Eleven objects are exported:
 *   - toastUser, simply toast a transient message that automatically times out
 *   - toastAndWait, toast a message but the program decides when to remove it
 *   - checkbox, a checkbox object to include in user input views
 *   - hr, a horizontal rule for visual effect in views
 *   - createAlertDialog, the workhorse that most other functions are based on
 *   - alertUser, show a message that requires the user to press OK
 *   - askUser, post a question (or view) with multiple button choices
 *   - getUserEntry, a dialog that lets the user enter a string
 *   - selectOption, the user can select one option from a simple text list
 *   - selectSingle, a single-select list that can contain objects and graphics
 *   - multiSelect, the list may contain multiple options and sublists
 */

var Util = require( 'UtilityFunctions' ); 

var LABEL_OK				= 'OK';
var LABEL_CANCEL			= 'Cancel';
var EVENT_CLICK				= 'click';
var labelCheckMark			= ' \u2714 ';
var labelBallotX			= ' \u2718 ';

var pWidth  = Titanium.Platform.displayCaps.platformWidth;
var pHeight = Titanium.Platform.displayCaps.platformHeight;
var pMaxDim = Math.max( pWidth, pHeight );
var bShortDisplay = ( pMaxDim < 860 );

var smallSuffix      = bShortDisplay ? '-small.png' : '.png';
var radioOffIcon     = Util.imagePath + 'indicator-off' + smallSuffix;
var radioGreenIcon   = Util.imagePath + 'indicator-green' + smallSuffix;
var radioBlueIcon    = Util.imagePath + 'indicator-blue' + smallSuffix;
var radioRedIcon     = Util.imagePath + 'indicator-red' + smallSuffix;
var radioYellowIcon  = Util.imagePath + 'indicator-yellow' + smallSuffix;
var checkBlackIcon   = Util.imagePath + 'checkmark-gray' + smallSuffix;
var checkGreenIcon   = Util.imagePath + 'checkmark-green' + smallSuffix;
var crossBlackIcon   = Util.imagePath + 'ballotx-gray' + smallSuffix;
var crossRedIcon     = Util.imagePath + 'ballotx-red' + smallSuffix;

var tableItemFont  = { fontSize: '16dp' };  
var viewTitleFont  = { fontSize: '22dp' };  
var textPadding    = bShortDisplay ? 10 : 16; 
var buttonTextFont = { fontSize: '18dp' };
var buttonCorner   = bShortDisplay ? 6 : 10; 
var buttonEdge     = bShortDisplay ? 1 : 2;

var toastNotification = Ti.UI.createNotification({
    message: '', duration: Ti.UI.NOTIFICATION_DURATION_LONG
});

// toastUser will automatically remove its notification after a few seconds
exports.toastUser = function( strNotification )
{
	toastNotification.message = strNotification;
	toastNotification.show();
}

var activityIndicator = Ti.UI.createActivityIndicator({
    message: 'Loading...'
});	

/* use: 
 * var toast = Util.toastAndWait( 'wait for something' );
 * ...
 * toast.hide();
 */
exports.toastAndWait = function( message )
{
	activityIndicator.message = message;
	activityIndicator.show();
	return activityIndicator;
}

/* properties available for checkbox:
 * 	placeCheck = 'right' or 'left' (the default)
 * 	color, font, setLabel, unsetLabel, setColor, unsetColor
 * 	backgroundColor, borderWidth, borderRadius, borderWidth, height, width, left, top, bottom, right
 */

var checkboxViewTemplate = { width:Ti.UI.FILL, height:Ti.UI.SIZE };
var checkboxCheckTemplate = { font:tableItemFont, top:4, bottom:4, 
	    color:'#E00', borderWidth:1, borderColor:'#EEE', backgroundColor:'#000',
	    setLabel:labelCheckMark, unsetLabel:labelBallotX, setColor:'#0E0', unsetColor:'#E00' };
var checkboxLabelTemplate = { font:tableItemFont };

exports.checkbox = function( labelText, checked, setProps )
{
	var hasCheck = checked;
	var viewOver = null, viewCheck = null, viewLabel = null;
	var propView = checkboxViewTemplate;
	var propCheck = checkboxCheckTemplate;
	var propLabel = checkboxLabelTemplate;

	// children and remove are here so that Util.tiObjectCleanup can follow an TI object tree and delete all sub-objects
	this.children = function()
	{
		return (viewOver == null) ? [] : [ viewOver ];
	}
	
	this.remove = function( ob )
	{
		viewOver = null, viewCheck = null, viewLabel = null, propView = null, propCheck = null, propLabel = null;
	}
	
	function transfer( oTo, oFrom, pOkList )
	{
		var newO = {};
		for ( var n in oTo )
			newO[n] = oTo[n];
		if ( oFrom == null )
			return newO;
		for ( var i in oFrom ) {
			if ( pOkList.indexOf( i ) >= 0 )
				newO[i] = oFrom[i];
		}
		return newO;
	}
	
	function drawCheck()
	{
		viewCheck.text  = hasCheck ? propCheck.setLabel : propCheck.unsetLabel;
		viewCheck.color = hasCheck ? propCheck.setColor : propCheck.unsetColor;
	}
	
	this.getView = function()
	{
		return viewOver;
	}
	
	this.getCheck = function()
	{
		return hasCheck;
	}
	
	this.setCheck = function( toSet )
	{
		var oldCheck = hasCheck;
		hasCheck = toSet;
		return oldCheck;
	}
	
	propView =  transfer( propView, setProps, [ 'backgroundColor', 'borderWidth', 'borderRadius', 'borderWidth', 'height', 'width', 'left', 'top', 'bottom', 'right' ] );
	propCheck = transfer( propCheck, setProps, [ 'setLabel', 'unsetLabel', 'setColor', 'unsetColor' ] );
	propLabel = transfer( propLabel, setProps, [ 'color', 'font' ] );

	propLabel.text = labelText;
	if ( !!setProps && !!setProps.placeCheck && setProps.placeCheck == 'right' ) {
		viewOver = Ti.UI.createView( propView );
		propLabel.left = 0; 
		viewLabel = Ti.UI.createLabel( propLabel );
		viewOver.add( viewLabel );
		propCheck.right = 0;
		viewCheck = Ti.UI.createLabel( propCheck );
		viewOver.add( viewCheck );
	}
	else {
		propView.layout = 'horizontal'; 
		viewOver = Ti.UI.createView( propView );
		propCheck.left = 0;
		viewCheck = Ti.UI.createLabel( propCheck );
		viewOver.add( viewCheck );
		propLabel.left = 6; 
		viewLabel = Ti.UI.createLabel( propLabel );
		viewOver.add( viewLabel );
	}
	drawCheck();

	viewOver.addEventListener( 'click', function( eventResult ) {
		hasCheck = !hasCheck;
		drawCheck();
	});
}

exports.hr = function( setProps )
{
	return Ti.UI.createView( {
		backgroundColor: ( !!setProps && !!setProps.color )  ? setProps.color :  '#AAA', 
		borderRadius:    ( !!setProps && !!setProps.round )  ? setProps.round :  0, 
		height:          ( !!setProps && !!setProps.height ) ? setProps.height : 1, 
		width:           ( !!setProps && !!setProps.width )  ? setProps.width :  '100%'
	});
}

function getSymbol( description )
{
	if ( description == 'check'   )  return checkGreenIcon;
	if ( description == 'delete'  )  return crossRedIcon;
	if ( description == 'radioOn' )  return radioGreenIcon;
	if ( description == 'radio'   )  return radioOffIcon;
	return null;
}

function prototypeAlertDialog( params )
{
	var eventCallback = null, dialogWindow = null, outerView = null;
	var titleView = null, messageView = null, innerTable = null, buttonHolder = null; 
	var searchView = null, searchBar = null;

	function clickButton( event )
	{
		var result = { index:event.source.index, button:true, type:'click' };
		if ( !!searchBar ) result.query = searchBar.value;
		if ( !!innerTable && !!innerTable.search ) result.filter = innerTable.search.value;
		hideThis();
		if ( !!eventCallback ) eventCallback( result ); 
	}

	function clickTableRow( event )
	{
		hideThis();
		if ( !!eventCallback ) {
			eventCallback( { index:event.index, button:false, type:'click' } ); 
		}
	}

	function hideThis()
	{
		if ( dialogWindow == null || outerView == null )
			return;
		outerView.animate( { top:(-1 * dialogWindow.size.height), duration: 350 }, function() 
		{
			if ( dialogWindow == null )
				return;
			dialogWindow.close();
			Util.tiObjectCleanup( dialogWindow );
			titleView = null, messageView = null; innerTable = null; buttonHolder = null; 
			dialogWindow = null; outerView = null; eventCallback = null; searchBar = null; 
		});
	}

	this.hide = function()
	{
		hideThis();
	}

	this.show = function()
	{
		if ( dialogWindow == null || outerView == null )
			return;
		outerView.top = -1 * pHeight; 
		dialogWindow.add( outerView );
		dialogWindow.open();
		outerView.animate({ top:0, duration: 350 }, function() 
		{
			if (!!innerTable && !!innerTable.search ) {
				innerTable.search.softKeyboardOnFocus = Titanium.UI.Android.SOFT_KEYBOARD_DEFAULT_ON_FOCUS;
			}
			outerView.top = 0;
		});
	}
	
	this.addEventListener = function( eventLabel, callbackFunction )
	{
		if ( dialogWindow == null || eventLabel != 'click' )
			return;
		eventCallback = callbackFunction;
	}
	
	outerView = Ti.UI.createView( { layout:'vertical', height:Ti.UI.SIZE, width:Ti.UI.FILL, top:0 } );
	// :^( outerView is here because titanium windows do not animate on android 

	if ( !!params.title ) {
		titleView = Ti.UI.createView( { 
			height:Ti.UI.SIZE, width:Ti.UI.FILL, backgroundColor:'#333' 
		} );
		titleView.add( Ti.UI.createLabel( { 
			text:params.title, font:viewTitleFont, color:'#EEE',
			top:textPadding, bottom:textPadding, textAlign:Ti.UI.TEXT_ALIGNMENT_CENTER
	 	} ) );
		outerView.add( titleView );
	}

	if ( !!params.message ) {
		messageView = Ti.UI.createView( { 
			height:Ti.UI.SIZE, width:Ti.UI.FILL, 
			layout:'horizontal', backgroundColor:'#111' 
		} );
		messageView.add( Ti.UI.createLabel( { 
			text:params.message, font:tableItemFont, color:'#CCC', 
			top:textPadding, bottom:textPadding, left:textPadding, right:textPadding
	 	} ) );
		outerView.add( messageView );
	}
	if ( !!params.askuser ) {
		searchView = Ti.UI.createView( { 
			height:Ti.UI.SIZE, width:Ti.UI.FILL, 
			backgroundColor:'#333'   
		} );
		searchBar = Ti.UI.createSearchBar( { 
			showCancel: false, width:'95%', height:'48dp', color:'#048', backgroundColor:'#333', 
		} );
		searchView.add( searchBar );
		outerView.add( searchView );
	}
	if ( !!params.buttonNames ) {
		buttonHolder = Ti.UI.createView( { 
			height:Ti.UI.SIZE, width:Ti.UI.FILL, 
			layout:'horizontal', backgroundColor:'#777' 
		} );   
		var pad = ( params.buttonNames.length < 3 ) ? '    ' : ' ';  
		for ( var i = 0, l = params.buttonNames.length; i < l; i++ ) {
			var button = Ti.UI.createButton( { index:i, height:'32dp', left:'8dp', top:'8dp', bottom:'8dp',   
				textAlign:Ti.UI.TEXT_ALIGNMENT_CENTER, font:buttonTextFont, color:'#000', backgroundColor:'#CCC', 
				borderRadius:buttonCorner, borderWidth:buttonEdge, borderColor:'#444', 
				title: pad + params.buttonNames[i] + pad
			});
			button.addEventListener( 'click', clickButton );
			buttonHolder.add( button );
		}
		outerView.add( buttonHolder ); 
	}
	if ( !!params.options && Array.isArray( params.options ) ) {
		var datalist = new Array();
		var symbol = !!params.prefix ? getSymbol( params.prefix ) : null; 
		for ( var i = 0, l = params.options.length; i < l; i++ ) {
			var textLabel = params.options[i];
			if ( typeof textLabel != 'string' && !!textLabel.title ) textLabel = textLabel.title;
			datalist.push( { 
				font:tableItemFont, color:'#CCC', backgroundColor:'#000', left:'6dp', title:textLabel
			} );
			if ( !!params.prefix ) {
				datalist[ datalist.length - 1 ].leftImage = 
					( params.prefix == 'radio' && params.selectedIndex == i ) ? getSymbol( 'radioOn' ) : symbol;
			}
		}
		innerTable = Ti.UI.createTableView( { 
			height:Ti.UI.SIZE, width:Ti.UI.FILL, 
			data:datalist, minRowHeight:'48dp',  
			footerView: Ti.UI.createView( { height:'96dp', width:Ti.UI.FILL } ) 
			// a large footer must be added otherwise the table won't scroll to the bottom rows
		} );

		if ( params.options.length > 8 ) {
			innerTable.search = Ti.UI.createSearchBar( { 
				showCancel: false, width:'95%', color:'#048', height:'36dp', 
				backgroundColor:'#777', hintText:'filter term:', font:{ fontSize: '14dp' }, 
				softKeyboardOnFocus:Titanium.UI.Android.SOFT_KEYBOARD_HIDE_ON_FOCUS
			} );
			innerTable.search.addEventListener( 'return', function( event ) 
			{
				Titanium.UI.Android.hideSoftKeyboard();
			});
		}

		innerTable.addEventListener( 'click', clickTableRow );
		outerView.add( innerTable ); 
	}
	else if ( !!params.androidView ) { 
		outerView.add( params.androidView ); 
	}
	else {
		outerView.add( Ti.UI.createView( { backgroundColor:'#DDD', height:'1dp', width:Ti.UI.FILL } ) );
	}

	dialogWindow = Ti.UI.createWindow( { 
		opacity:0.5, backgroundColor:'#FFF', navBarHidden:true, zIndex:30
	} );
	dialogWindow.addEventListener( 'android:back', function( ev ) {
		hideThis();
		if ( !!eventCallback ) eventCallback( { index:-1, button:false, type:'back' } ); 
	});
}

exports.createAlertDialog = function( params )
{
	return new prototypeAlertDialog( params );
}

exports.alertUser = function( aTitle, aMessage, callAfterOK )
{
	var alertDialog = exports.createAlertDialog({
	    title: aTitle, message: aMessage, buttonNames: ['OK']
	});
	alertDialog.addEventListener( EVENT_CLICK, function( event ) 
	{
		alertDialog.hide();
		alertDialog = null;
		if ( !!callAfterOK ) 
			callAfterOK();
	} );
	alertDialog.show();
	return alertDialog;
}

exports.askUser = function( aTitle, aMessage, buttonList, onAnswer )
{
	var alertDialog = null;
	var nButtons = ( !!buttonList ) ? buttonList.length : 0;
	if ( typeof aMessage == 'string' ) {
		alertDialog = exports.createAlertDialog( { 
			title: aTitle, buttonNames: buttonList, message: aMessage } );
	}
	else {
		alertDialog = exports.createAlertDialog( { 
			title: aTitle, buttonNames: buttonList, androidView: aMessage } );
	}
	alertDialog.addEventListener( EVENT_CLICK, function( event )
	{
		if ( !event.button || event.index < 0 || event.index >= nButtons )
			return;
		if ( !!onAnswer ) onAnswer( event.index );
		alertDialog = null;
	} );
	alertDialog.show();
	return alertDialog;
}

exports.getUserEntry = function( aTitle, onAnswer )
{
	var optionDialog = exports.createAlertDialog({
	    title: aTitle, buttonNames: ['OK','Cancel'], askuser:true
	});
	optionDialog.addEventListener( 'click', function( event ) 
	{
		if ( event.index == 0 && !!onAnswer )
			onAnswer( event.query );
		Util.tiObjectCleanup( optionDialog );
		optionDialog = null;  
	} );
	optionDialog.show();
}

/* listOptions is an array of strings
 * initialSelect is the index within listOptions to show initially
 * callSelected is only called when an option is selected, not when the user cancels
 */
exports.selectOption = function( dialogTitle, listOptions, initialSelect, leftSymbol, callSelected )
{
	var optionDialog = exports.createAlertDialog({
	    title: dialogTitle, options: listOptions, buttonNames: [ LABEL_CANCEL ], 
	    prefix: leftSymbol, selectedIndex: initialSelect
	});
	optionDialog.addEventListener( EVENT_CLICK, function( event )
	{
		if ( !event.button && !!callSelected )
			callSelected( event.index );
		Util.tiObjectCleanup( optionDialog );
		optionDialog = null;
	} );
	optionDialog.show();
}

/* listItems is an array of dictionaries
 * Each dictionary must have a "title:" property, which is shown on the 
 * selection dialog, and may have a "leftImage:" property which will be 
 * shown next to the title if it is present.
 * The selected dictionary is returned in callSelected(dict).
 */
exports.selectSingle = function( dialogTitle, listItems, callSelected )
{
	var optionDialog = exports.createAlertDialog({
	    title: dialogTitle, options: listItems, buttonNames: [ LABEL_CANCEL ]
	});
	optionDialog.addEventListener( EVENT_CLICK, function( event ) 
	{
		if ( !event.button && !!callSelected ) {
			optionDialog.hide();
			callSelected( listItems[ event.index ] );
		}
		Util.tiObjectCleanup( optionDialog );
		optionDialog = null;
	} );
	Util.setPropertyValue( listItems, 'changed', false ); 
	optionDialog.show();
}

/* listItems is an array of dictionaries
 * Each dictionary must have a "title:" property, which is shown on the 
 * selection dialog, and must have a "state:" property which is used to
 * show the selected state in the dialog, and will be modified upon
 * return when callSelected(listItems) is called.
 */
exports.multiSelect = function( dialogTitle, listItems, callSelected )
{
	function setOptionTitle( item ) 
	{
		if ( !item.hasOwnProperty( 'originaltitle' ) )
			item.originaltitle = item.title;
		item.title = item.originaltitle + ' (' + item.options[ item.selected ] + ')';  
	}
	var dataList = new Array();
	for ( var i in listItems ) {
		dataList.push( listItems[i] );
		var item = dataList[ dataList.length - 1 ]; 
		item.initial = item.options ? item.selected : item.hasCheck;
		item.changed = false;
		if ( !!item.options ) setOptionTitle( item );
		item.font = tableItemFont;
		item.color = '#CCC';
		item.backgroundColor = '#000';
		item.left = '6dp'
	}
	var tableView = Ti.UI.createTableView( { 
		data: dataList, minRowHeight: '40dp', width:Ti.UI.FILL, clicked: -1,
		footerView: Ti.UI.createView( { height:'80dp', width:Ti.UI.FILL } )
	} );
	var item = null, rowItem = null;
	tableView.addEventListener( EVENT_CLICK, function( event ) 
	{
		tableView.clicked = event.index;
		item = listItems[ tableView.clicked ];
		if ( !!item.options ) {
			exports.selectOption( item.originaltitle, item.options, item.selected, 'radio', function( itemSelected ) 
			{
				rowItem = listItems[ tableView.clicked ];
				rowItem.selected = itemSelected;
				rowItem.changed = true;
				setOptionTitle( rowItem ) ;
				tableView.updateRow( tableView.clicked, rowItem );
				item = null; rowItem = null;
			} );
		}
		else if ( !!item.checklist ) {
			exports.multiSelect( item.title, item.checklist, function( changedListItems ) 
			{
				item.changed = true;
				item = null;
			} );
		}
		else {
			item.changed = true;
			item.hasCheck = !item.hasCheck;
			event.row.hasCheck = item.hasCheck;
			item = null;
		}
	} );
	var selectDialog = exports.createAlertDialog({
	    title: dialogTitle, androidView: tableView, 
		buttonNames: [ LABEL_OK, LABEL_CANCEL ], cancel: 1
	});
	var i, item;
	selectDialog.addEventListener( EVENT_CLICK, function( event ) 
	{
		if ( event.button && event.index == 1 ) {
			for ( i in listItems ) {
				item = listItems[i]; 
				if ( item.options ) 
					item.selected = item.initial;
				else if ( item.hasOwnProperty( 'hasCheck' ) )
					item.hasCheck = item.initial;
				item.changed = false;
			}
		}
		else if ( !!callSelected )
			callSelected( listItems );
		Util.tiObjectCleanup( selectDialog );
		tableView = null; 
		selectDialog = null;
	} );
	selectDialog.show();
}

