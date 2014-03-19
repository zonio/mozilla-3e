/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2011  Zonio s.r.o.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://calendar3e/modules/sd.jsm');

/**
 * Wraps given function to object acting as calIGenericOperationListener
 *
 * @param {Function} onResult
 * @returns {calIGenericOperationListener}
 */
function createOperationListener(onResult) {
  return {
    QueryInterface: XPCOMUtils.generateQI([
      Components.interfaces.calIGenericOperationListener
    ]),
    onResult: onResult
  };
}

/**
 * Takes Mozilla calendar date/time and returns it formatted as ISO
 * 8601 date/time.
 *
 * It preserves date/time's timezone and doesn't try to convert
 * everything to UTC like ISO8601DateUtils JavaScript module.  So,
 * this function is great for debugging.
 *
 * @param {calIDateTime} dateTime
 * @returns {String}
 */
function calDateTimeToIsoDate(dateTime) {
  var isoTzOffset = '';
  if (dateTime.timezoneOffset) {
    isoTzOffset += dateTime.timezoneOffset >= 0 ? '+' : '-';
    isoTzOffset += zeropad(Math.floor(
      Math.abs(dateTime.timezoneOffset) / 3600
    ), 2);
    isoTzOffset += ':';
    isoTzOffset += zeropad(Math.floor(
      (Math.abs(dateTime.timezoneOffset) % 3600) / 60
    ), 2);
  } else {
    isoTzOffset += 'Z';
  }

  return '' +
    zeropad(dateTime.year, 4) + '-' +
    zeropad(dateTime.month + 1, 2) + '-' +
    zeropad(dateTime.day, 2) + 'T' +
    zeropad(dateTime.hour, 2) + ':' +
    zeropad(dateTime.minute, 2) + ':' +
    zeropad(dateTime.second, 2) +
    isoTzOffset;
}

function eeeAttachmentToHttpUri(eeeUri) {
  sd.resolveServer(eeeUri.host).then(function(service) {
    var hash = eeeUri.spec.split('/')[4];
    var filename = eeeUri.spec.split('/')[5];

    return Services.io.newURI(
      ['https:', '', service, 'attach', hash, filename].join('/'),
      null, null
    );
  });
}

/**
 * Computes SHA1 of content of local file specified by given uri.
 * @param {nsIURI} uri specifying file.
 * @return {String} sha1 hash.
 */
function computeSha1(uri) {
  var hashBuilder = Components.classes['@mozilla.org/security/hash;1']
    .createInstance(Components.interfaces.nsICryptoHash);
  hashBuilder.init(hashBuilder.SHA1);
  hashBuilder.updateFromStream(
    Services.io.newChannel(uri.spec, null, null).open(), 0xffffffff
  );
  var hash = hashBuilder.finish(false);

  function toHexString(charCode) {
    return ('0' + charCode.toString(16)).slice(-2);
  }

  return [toHexString(hash.charCodeAt(i)) for (i in hash)].join('');
}

/**
 * Converts iCalendar local file attachment uri to eee attachment uri.
 *
 * @param {nsIURI} fileUri local file uri
 * @param {String} email of user creating an event with attachments.
 * @return {String} eee attachment uri.
 */
function fileAttachmentToEeeUri(fileUri, email) {
  var fileName = fileUri.spec.split('/')[fileUri.spec.split('/').length - 1];

  return Services.io.newURI(
    ['eee:', '', email, 'attach', computeSha1(fileUri), fileName].join('/'),
    null, null
  );
}

function isSupportedServer(server) {
  return ['imap', 'pop3'].indexOf(server.type) >= 0;
}

function getExpandedItems(item, start, end) {
  return item.recurrenceInfo ?
    item.recurrenceInfo.getOccurrences(start, end, 0, {}) :
    [item];
}

function getInstanceId(item, itemInstance) {
  return itemInstance ?
    item.id + '@' + itemInstance.getProperty('RECURRENCE-ID').icalString :
    item.id;
}

function zeropad(number, length) {
  var string = '' + number;
  while (string.length < length) {
    string = '0' + string;
  }

  return string;
}

/*
* Natural Sort algorithm for Javascript - Version 0.7 - Released under MIT license
* Author: Jim Palmer (based on chunking idea from Dave Koelle)
* https://github.com/overset/javascript-natural-sort
*/
function naturalSort(a, b) {
  var re = /(^-?[0-9]+(\.?[0-9]*)[df]?e?[0-9]?$|^0x[0-9a-f]+$|[0-9]+)/gi,
      sre = /(^[ ]*|[ ]*$)/g,
      dre = /(^([\w ]+,?[\w ]+)?[\w ]+,?[\w ]+\d+:\d+(:\d+)?[\w ]?|^\d{1,4}[\/\-]\d{1,4}[\/\-]\d{1,4}|^\w+, \w+ \d+, \d{4})/,
      hre = /^0x[0-9a-f]+$/i,
      ore = /^0/,
      i = function(s) { return naturalSort.insensitive && (''+s).toLowerCase() || ''+s },
      // convert all to strings strip whitespace
      x = i(a).replace(sre, '') || '',
      y = i(b).replace(sre, '') || '',
      // chunk/tokenize
      xN = x.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
      yN = y.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
      // numeric, hex or date detection
      xD = parseInt(x.match(hre)) || (xN.length != 1 && x.match(dre) && Date.parse(x)),
      yD = parseInt(y.match(hre)) || xD && y.match(dre) && Date.parse(y) || null,
      oFxNcL, oFyNcL;
  // first try and sort Hex codes or Dates
  if (yD)
    if ( xD < yD ) return -1;
    else if ( xD > yD ) return 1;
  // natural sorting through split numeric strings and default strings
  for(var cLoc=0, numS=Math.max(xN.length, yN.length); cLoc < numS; cLoc++) {
    // find floats not starting with '0', string or 0 if not defined (Clint Priest)
    oFxNcL = !(xN[cLoc] || '').match(ore) && parseFloat(xN[cLoc]) || xN[cLoc] || 0;
    oFyNcL = !(yN[cLoc] || '').match(ore) && parseFloat(yN[cLoc]) || yN[cLoc] || 0;
    // handle numeric vs string comparison - number < string - (Kyle Adams)
    if (isNaN(oFxNcL) !== isNaN(oFyNcL)) { return (isNaN(oFxNcL)) ? 1 : -1; }
    // rely on string comparison if different types - i.e. '02' < 2 != '02' < '2'
    else if (typeof oFxNcL !== typeof oFyNcL) {
      oFxNcL += '';
      oFyNcL += '';
    }
    if (oFxNcL < oFyNcL) return -1;
    if (oFxNcL > oFyNcL) return 1;
  }
  return 0;
}

var cal3eUtils = {
  createOperationListener: createOperationListener,
  calDateTimeToIsoDate: calDateTimeToIsoDate,
  eeeAttachmentToHttpUri: eeeAttachmentToHttpUri,
  fileAttachmentToEeeUri: fileAttachmentToEeeUri,
  isSupportedServer: isSupportedServer,
  getExpandedItems: getExpandedItems,
  getInstanceId: getInstanceId,
  naturalSort: naturalSort
};
EXPORTED_SYMBOLS = [
  'cal3eUtils'
];
