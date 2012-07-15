/* 
 * file: UtilityFunctions.js
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
 * UtilityFunctions.js is a library of various support functions:
 *   - object copying and handling
 *   - string processing
 *   - geographic points
 *   - debug printing
 *   - read/write persistent properties
 *   - file and folder operations
 *   - checksum
 *   - HTML string decoder
 *   
 * A global namespace 'Util' is also a convenient place for other modules to reference
 * common file locations:
 *   - imageFolder, imagePath
 *   - dataFolder, dataPath
 */

var earthRadius = 6371009; // Earth radius, m
var million = 1000000;

exports.imageFolder = 'images'; 
exports.dataFolder  = 'data'; 
exports.imagePath   = exports.imageFolder + Ti.Filesystem.separator; 
exports.dataPath    = exports.dataFolder  + Ti.Filesystem.separator; 

// To help memory management, tiObjectCleanup with walk through Titanium objects, 
// nulling amd removing sub-objects to free memory
exports.tiObjectCleanup = function( tiObject )
{
	if ( !tiObject || !tiObject.children || tiObject.children.length == 0 ) {
		return;
	}
	exports.tiObjectCleanup( tiObject.children[ 0 ] );
	if ( !!tiObject.remove ) {
		tiObject.remove( tiObject.children[ 0 ] );
	}
	tiObject.children[ 0 ] = null;
	exports.tiObjectCleanup( tiObject );
}

exports.isDefined = function( obj ) 
{
	return (typeof obj !== 'undefined' && obj != null);
}

exports.isUsefulString = function( str )
{
	return (typeof str == 'string' && str.length > 0);
}

exports.isStringInArray = function( text, strArray )
{
	for ( var j in strArray ) {
		if ( text == strArray[j] ) {
			return true;
		}
	}
	return false;
}

exports.stringContains = function( mainText, testString )
{
	if ( !exports.isDefined( mainText ) )
		return false;
	return ( mainText.indexOf( testString ) >= 0 );
}

exports.stripTags = function( str )
{
	return str.replace(/(<([^>]+)>)/ig,'');
}

exports.extractAttribute = function( str, attribute )
{
	var parts = str.match( RegExp( attribute + '\=\"([^\"]*)\"', 'im' ) );
	if ( !!parts && parts.length > 0 ) {
		return parts[1];
	}
	parts = str.match( RegExp( attribute + '\=([^;$]*)', 'im' ) );
	var results = ( !!parts && parts.length > 0 ) ? parts[1] : '';
	parts = null;
	return results;
}

exports.extractProperty = function( str, property )
{
	var parts = str.match( RegExp( '(?:^|\s)' + property + ':(.*)$', 'im' ) );
	var results = ( !!parts && parts.length > 0 ) ? parts[1] : '';
	parts = null;
	return results;
}

exports.decimal = function( num, nDigits ) {
	var scale = Math.pow( 10, nDigits );
	return Math.round( Number(num) * scale ) / scale; 
}

exports.mergeObjects = function( baseObject, copyOver )
{
    var merged = {};
    if ( exports.isDefined( baseObject ) ) {
    	for ( var propname in baseObject ) { 
    		merged[propname] = baseObject[propname]; 
    	}
    }
    if ( exports.isDefined( copyOver ) ) {
    	for ( var propname in copyOver ) { 
    		merged[propname] = copyOver[propname]; 
    	}
    }
    return merged;
}

exports.insertObject = function( baseObject, insertInto )
{
    if ( !exports.isDefined( insertInto ) )
        return baseObject;
	for ( var propname in insertInto ) { 
		baseObject[propname] = insertInto[propname]; 
	}
    return baseObject;
}

exports.updateObject = function( baseObject, updateObject )
{
    if ( !exports.isDefined( updateObject ) )
        return baseObject;
	for ( var propname in updateObject ) { 
		if ( exports.isDefined( baseObject[propname] ) )
			baseObject[propname] = updateObject[propname]; 
	}
    return baseObject;
}

exports.subsetObject = function( baseObject, listProperties )
{
	var newObject = {};
	for ( var i in listProperties ) {
		var prop = listProperties[i];
		if ( exports.isDefined( baseObject[prop]) )
			newObject[prop] = baseObject[prop];
	}
	return newObject;
}

exports.findObject = function( objectArray, property, matchValue )
{
	var isFunction = ( typeof matchValue == 'function' );
	for ( var i in objectArray ) {
		var objectItem = objectArray[i]; 
		if ( isFunction && matchValue( objectItem[property] ) 
			 || !isFunction && ( objectItem[property] == matchValue ) ) 
		{
			return objectItem; 
		}
	}
	return null;
}

exports.findAllObjects = function( objectArray, property, matchValue )
{
	var isFunction = ( typeof matchValue == 'function' );
	var foundList = new Array();
	for ( var i in objectArray ) {
		var objectItem = objectArray[i]; 
		if ( isFunction && matchValue( objectItem[property] ) 
			 || !isFunction && ( objectItem[property] == matchValue ) ) 
		{
			foundList.push( objectItem ); 
		}
	}
	return foundList;
}

exports.setArrayToObject = function( array, object )
{
	for ( var i in array ) {
		exports.insertObject( array[i], object );
	}
}

exports.minGeoPoint = function( pt1, pt2 ) {
	if ( !exports.isDefined( pt1 ) ) return pt2;
	if ( !exports.isDefined( pt2 ) ) return pt1;
	return { 
		latitude: Math.min( pt1.latitude, pt2.latitude ), 
		longitude: Math.min( pt1.longitude, pt2.longitude )
	};
}

exports.maxGeoPoint = function( pt1, pt2 ) {
	if ( !exports.isDefined( pt1 ) ) return pt2;
	if ( !exports.isDefined( pt2 ) ) return pt1;
	return { 
		latitude: Math.max( pt1.latitude, pt2.latitude ), 
		longitude: Math.max( pt1.longitude, pt2.longitude )
	};
}

exports.radians = function( degrees )
{
	return Math.PI * degrees / 180;
}

exports.regionSpan = function( region )
{
	var latScale = Math.cos( exports.radians( region.latitude ) );
	var x = exports.radians( region.longitudeDelta ) * latScale;
	var y = exports.radians( region.latitudeDelta );
	var results = Math.round( earthRadius * Math.sqrt( x * x + y * y ) * million ) / million; 
	latScale = null; x = null; y = null;
	return results;
}

exports.geoSeparation = function( pt1, pt2 )
{
	var latScale = Math.cos( exports.radians( pt1.latitude + pt2.latitude ) / 2 );
	var x = exports.radians( pt2.longitude - pt1.longitude ) * latScale; 
	var y = exports.radians( pt2.latitude - pt1.latitude );
	var results = Math.round( earthRadius * Math.sqrt( x * x + y * y ) * million ) / million; 
	latScale = null; x = null; y = null;
	return results;
}

exports.showProperties = function( obj )
{
	for ( var name in obj ) {
		Ti.API.debug( name + ' = ' + obj[name] );
	}
}

exports.showPropertyTree = function( obj, level )
{
	if ( typeof level == 'undefined' ) level = '.';
	for ( var name in obj ) {
		if ( typeof obj[name] == 'object' ) {
			Ti.API.debug( level + name + ' = {' );
			exports.showPropertyTree( obj[name], level + '    ' );
			Ti.API.debug( level + '}' );
		}
		else {
			Ti.API.debug( level + name + ' = ' + obj[name] );
		}
	}
}

exports.showTextLines = function( str )
{
	var lines = str.split( '\n' );
	for ( var i = 0, l = lines.length; i < l; i++ ) {
		Ti.API.debug( lines[i] );
	}
}

// Do not use writePropertyTree on Titanium objects like Windows and UI things.
// Ti objects have circular pointer structures that will put any recursive
// routine into an infinite loop, which also includes JSON.stringify()
exports.writePropertyTree = function( obj, level, file )
{
	for ( var name in obj ) {
		if ( typeof obj[name] == 'object' ) {
			file.write( level + name + ' = {\n', true );
			writePropertyTree( obj[name], level + '  ', file );
			file.write( level + '}\n', true );
		}
		else {
			if ( isNaN( obj[name] ) ) 
				file.write( level + name + ' = \"' + obj[name] + '\"\n', true );
			else
				file.write( level + name + ' = ' + obj[name] + '\n', true );
		}
	}
}

exports.setPropertyValue = function( list, property, value )
{
	for ( var i in list ) {
		var item = list[i];
		item[property] = value;
	}
}

exports.callIfProperty = function( list, property, callBackIf )
{
	for ( var i in list ) {
		var item = list[i];
		if ( item[property] ) {
			callBackIf( item );
		}
	}
}

exports.saveSetting = function( settingName, value )
{
	try {
		Ti.App.Properties.setString( settingName, JSON.stringify( value ) );
	}
	catch ( setError ) {
		Ti.API.debug( 'saveSetting ERROR: ' + setError );
	}
}

exports.restoreSetting = function( settingName, defaultValue )
{
	var newVal = defaultValue;
	try {
		newVal = JSON.parse( Ti.App.Properties.getString( settingName, defaultValue ) );
	}
	catch ( getError ) {
		Ti.API.debug( 'restoreSetting ERROR: ' + getError );
	}
	return newVal; 
}

exports.writeDataToFile = function( filePath, saveData )
{
	if ( filePath.indexOf( 'file:' ) != 0 && filePath.indexOf( 'FILE:' ) != 0 )
		filePath = Ti.Filesystem.applicationDataDirectory + Ti.Filesystem.separator + filePath;
	var fileObj = Ti.Filesystem.getFile( filePath );
	try {
		fileObj.write( JSON.stringify( saveData ) );
	}
	catch ( writeError ) {
		Ti.API.debug( 'writeDataToFile FILE ERROR: ' + writeError );
	}
}

exports.readDataFromFile = function( filePath, defaultData )
{
	var fileObj = null;
	if ( filePath.indexOf( 'file:' ) == 0 || filePath.indexOf( 'FILE:' ) == 0 ) {
		fileObj = Ti.Filesystem.getFile( filePath );
	}
	else {
		fileObj = Ti.Filesystem.getFile( Ti.Filesystem.applicationDataDirectory, filePath );
		if ( !fileObj.exists() ) 
			fileObj = Ti.Filesystem.getFile( Ti.Filesystem.resourcesDirectory, filePath );
	}
	if ( !fileObj.exists() ) return defaultData;
	var newVal = defaultData;
	try {
		newVal = JSON.parse( fileObj.read() );
	}
	catch ( readError ) {
		Ti.API.debug( 'readDataFromFile ERROR: ' + readError );
	}
	return newVal;
}

// does NOT perform a recursive tree copy!
exports.copyFolderContents = function( fromFolder, toFolder )
{
	var fromDir = Ti.Filesystem.getFile( fromFolder ); 
	if ( !fromDir.exists() ) {
		Ti.API.debug( 'copyFolder: cannot open folder ' + fromFolder );
		fromDir = null;
		return;
	}
	var toDir = Ti.Filesystem.getFile( toFolder ); 
	if ( !toDir.exists() && !toDir.createDirectory() ) {
		Ti.API.debug( 'copyFolder: cannot create folder ' + toFolder );
		fromDir = null; toDir = null;
		return;
	}
	var listing = fromDir.getDirectoryListing();
	fromDir = null; toDir = null;
	
	function copyOneFile()
	{
		if ( listing.length == 0 ) {
			listing = null;
			return;
		}
		exports.copyFile( listing.pop(), fromFolder, toFolder );
		setTimeout( copyOneFile, 20 );
	}
	setTimeout( copyOneFile, 20 );
}

//does NOT perform a recursive tree delete!
exports.deleteFolder = function( folderToDelete )
{
	var folderFile = Ti.Filesystem.getFile( folderToDelete ); 
	if ( !folderFile.exists() ) {
		Ti.API.debug( 'copyFolder: cannot open folder ' + folderToDelete );
		folderFile = null;
		return;
	}
	var listing = folderFile.getDirectoryListing();
	function deleteOneFile()
	{
		if ( listing.length == 0 ) {
			folderFile.deleteFile();
			folderFile = null; listing = null;
			return;
		}
		var toDeleteFile = Ti.Filesystem.getFile( folderFile.nativePath, listing.pop() );
		toDeleteFile.deleteFile();
		setTimeout( deleteOneFile, 10 );
		toDeleteFile = null;
	}
	setTimeout( deleteOneFile, 10 );
}

var checkDirList = [ 
    Ti.Filesystem.applicationDataDirectory, 
    Ti.Filesystem.resourcesDirectory, 
    Ti.Filesystem.externalStorageDirectory,
    Ti.Filesystem.tempDirectory
];

exports.lookForFile = function( fileName, localPath )
{
	if ( !!fileName && fileName.match( /file\:\/\//i ) != null ) {
		return Ti.Filesystem.getFile( fileName );
	}
	if ( !!localPath && localPath.match( /file\:\/\//i ) != null ) {
		return Ti.Filesystem.getFile( localPath, fileName );
	}
	var fileObj = null;
	for ( var i = 0, l = checkDirList.length; i < l; i++ ) {
		if ( !!localPath )
			fileObj = Ti.Filesystem.getFile( checkDirList[i], localPath, fileName );
		else
			fileObj = Ti.Filesystem.getFile( checkDirList[i], fileName );
		if ( fileObj.exists() )
			break;
	}
	return fileObj;
}

exports.getFile = function( fileName )
{
	if ( !exports.isUsefulString( fileName ) ) {
		return { exists: false, filename: fileName };
	}
	var fileObj = exports.lookForFile( fileName, null );
	if ( !fileObj.exists() ) {
		return { exists: false, filename: fileName };
	}
	var tstamp = fileObj.modificationTimestamp(); 	
	var tsDate = new Date( tstamp );
	var results = {
		exists: true, 
		filename: fileName,
		modified: { date: tsDate.toDateString(), time: tsDate.toTimeString(), stamp: tstamp },
		age: Math.ceil( ( Date.now() - tstamp ) / ( 1000 * 60 * 60 ) ),
		path: fileObj.nativePath,
		file: fileObj, 
	}
	fileObj = null; tstamp = null; tsDate = null;
	return results;
}


exports.copyFile = function( fileName, oldPath, newPath ) 
{
	var valid_oldPath = exports.isUsefulString( oldPath ) ? oldPath : Ti.Filesystem.applicationDataDirectory;
	var valid_newPath = exports.isUsefulString( newPath ) ? newPath : Ti.Filesystem.tempDirectory;
	var oldfile = Ti.Filesystem.getFile( valid_oldPath, fileName );
	var newfile = Ti.Filesystem.getFile( valid_newPath, fileName );
	var result = false;
	try {
		newfile.write( oldfile.read() ); 
		result = true;
	}
	catch ( writeError ) {
		Ti.API.debug( 'copyFile WRITE ERROR: ' + writeError );
	}
	valid_oldPath = null; valid_newPath = null; oldfile = null; newfile = null;
	return result;
}

exports.createDirectory = function( dirName, bPreferExternal )
{
	var appDir = Ti.Filesystem.applicationDataDirectory;
	if ( bPreferExternal && Ti.Filesystem.isExternalStoragePresent() ) {
		appDir = Ti.Filesystem.externalStorageDirectory; 
	} 
	var directory = Ti.Filesystem.getFile( appDir, dirName );
	if ( !directory.exists() ) { 
		directory.createDirectory(); 
	}
	var result = directory.nativePath;
	appDir = null; directory = null;
	return result; 
}

exports.extractFilename = function( path )
{
	if ( !exports.isUsefulString( path ) )
		return null;
	var parts;
	if ( path.match( /(https?|ftp|file):\/\//i ) ) {
		parts = path.replace( /\?.*/, '' ).split( '/' );
	}
	else {
		parts = path.split( Ti.Filesystem.separator );
	}
	var result = ( !!parts && parts.length > 0 ) ? parts[ parts.length - 1 ] : null;
	parts = null;
	return result;
}

var crc32table = [
	0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA, 0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3, 
	0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988, 0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91, 
	0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE, 0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7, 
	0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC, 0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5, 
	0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172, 0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B, 
	0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940, 0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59, 
	0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116, 0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F, 
	0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924, 0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D, 
	0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A, 0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433, 
	0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818, 0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01, 
	0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E, 0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457, 
	0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C, 0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65, 
	0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2, 0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB, 
	0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0, 0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9, 
	0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086, 0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F, 
	0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4, 0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD, 
	0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A, 0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683, 
	0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8, 0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1, 
	0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE, 0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7, 
	0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC, 0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5, 
	0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252, 0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B, 
	0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60, 0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79, 
	0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236, 0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F, 
	0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04, 0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D, 
	0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A, 0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713, 
	0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38, 0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21, 
	0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E, 0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777, 
	0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C, 0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45, 
	0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2, 0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB, 
	0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0, 0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9, 
	0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6, 0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF, 
	0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94, 0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D
];

exports.checksum = function( str )
{
    var crc = 17, n = 0; 
    if ( str == null ) str = '';
    if ( typeof str != 'string' ) str = str.toString();
    for ( var i = 0, iTop = str.length; i < iTop; i++ ) { 
        n = ( crc ^ str.charCodeAt( i ) ) & 0xFF; 
        crc = ( crc >>> 8 ) ^ crc32table[n]; 
    } 
    return crc ^ (-1); 
}

var numberMap = '0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
var dateOffset = new Date( 2012, 1, 1);
var numberMapLength = numberMap.length;
var paddingString = '0000000000000000000000';

exports.alphaEncode = function( num )
{
	var code = '';
	while ( num != 0 ) {
		code += numberMap.charAt( num & 0x003F );
		num >>>= 6;
	}
	return code;
}

exports.checkstring = function( str, charSize )
{
	var chk = exports.alphaEncode( exports.checksum( str ) );
	if ( !isNaN( charSize ) )
		return chk;
	if ( charSize < chk.length )
		return chk.substr( 0, charSize );
	if ( charSize > chk.length )
		return paddingString.substr( 0, charSize - chk.length ) + chk;
}

exports.shortTimeCode = function()
{
	var ts = ( Date.now() - dateOffset );
	ts = ( ts << 12 ) | Math.round( 0x00FFF * Math.random() ); 
	ts = exports.alphaEncode( ts );
	return ts;
}

var entityReferenceTable = {
	nbsp: 160, 		copy: 169,		reg: 174,		sup2: 178,		sup3: 179,		quot: 34,	
	amp: 38,		lt: 60,			gt: 62, 		ndash: 8211,	mdash: 8212,	lsquo: 8216,	
	rsquo: 8217,	ldquo: 8220, 	rdquo: 8221,	bull: 8226,		dagger: 8224,	Dagger: 8225, 
	prime: 8242, 	Prime: 8243,	lsaquo: 8249,	rsaquo: 8250,	euro: 8364,		trade: 8482, 
	tilde: 732, 	circ: 710,		spades: 9824,	clubs: 9827,	hearts: 9829,	diams: 9830, 
	loz: 9674,		larr: 8592,		rarr: 8594,		uarr: 8593,		darr: 8595,		harr: 8596, 
	not: 172, 		iexcl: 161,		cent: 162,		pound: 163,		curren: 164,	yen: 165, 
	brvbar: 166, 	sect: 167,		uml: 168,						ordf: 170,		laquo: 171, 
					shy: 173,						macr: 175,		deg: 176,		plusmn: 177, 
									acute: 180,		micro: 181,		para: 182,		middot: 183, 
	cedil: 184,		sup1: 185,		ordm: 186,		raquo: 187,		frac14: 188,	frac12: 189, 
	frac34: 190, 	iquest: 191,	Agrave: 192,	Aacute: 193,	Acirc: 194,		Atilde: 195, 
	Auml: 196, 		Aring: 197,		AElig: 198,		Ccedil: 199,	Egrave: 200,	Eacute: 201, 
	Ecirc: 202, 	Euml: 203,		Igrave: 204,	Iacute: 205,	Icirc: 206,		Iuml: 207, 
	ETH: 208, 		Ntilde: 209,	Ograve: 210,	Oacute: 211,	Ocirc: 212,		Otilde: 213, 
	Ouml: 214, 		times: 215,		Oslash: 216,	Ugrave: 217,	Uacute: 218,	Ucirc: 219, 
	Uml: 220, 		Yacute: 221,	THORN: 222,		szlig: 223,		agrave: 224,	aacute: 225, 
	acirc: 226, 	atilde: 227,	auml: 228,		aring: 229,		aelig: 230,		ccedil: 231, 
	egrave: 232, 	eacute: 233,	ecirc: 234,		euml: 235,		igrave: 236,	iacute: 237, 
	icirc: 238, 	iuml: 239,		eth: 240,		ntilde: 241,	ograve: 242,	oacute: 243, 
	ocirc: 244, 	otilde: 245,	ouml: 246,		divide: 247,	oslash: 248,	ugrave: 249, 
	uacute: 250, 	ucirc: 251,		uuml: 252,		yacute: 253,	thorn: 254,		yuml: 255 
};

exports.htmlDecode = function( str )
{
	// this function has a flaw in that codes within a quote get converted
	// and doesn't take hex values which are technically allowed
	
	if ( !exports.isUsefulString( str ) ) {
		return '';
	}
	var codes = str.match( /&[a-z]{2,6};/gi );
	for ( var i in codes ) {
		var code = codes[i];
		var name = code.substring( 1, code.length - 1 );
		var numeric = String.fromCharCode( entityReferenceTable[name] );
		if ( !!numeric )
			str = str.replace( code, numeric );
	}
	codes = str.match( /&#[0-9]{1,5};/gi );
	for ( var i in codes ) {
		var code = codes[i];
		var numeric = Number( code.substring( 2, code.length - 1 ) );
		var character = String.fromCharCode( numeric );
		if ( !!character )
			str = str.replace( code, character );
	}
	codes = null;
	return str;
}

