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
 * Takes NSPR time and returns EEE date as used in queries.
 *
 * @param {PRTime} nsprTime
 * @returns {String}
 */
function nsprTimeToEeeDate(nsprTime) {
  var jsDate = new Date(nsprTime / 1000);

  return '' +
    zeropad(jsDate.getUTCFullYear(), 4) + '-' +
    zeropad(jsDate.getUTCMonth() + 1, 2) + '-' +
    zeropad(jsDate.getUTCDate(), 2) + ' ' +
    zeropad(jsDate.getUTCHours(), 2) + ':' +
    zeropad(jsDate.getUTCMinutes(), 2) + ':' +
    zeropad(jsDate.getUTCSeconds(), 2);
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

function eeeAttachmentToHttpUri(eeeUri, callback) {
  sd.resolveServer(eeeUri.host, function(service) {
    var hash = eeeUri.spec.split('/')[4];
    var filename = eeeUri.spec.split('/')[5];

    callback(Services.io.newURI(
      ['https:', '', service, 'attach', hash, filename].join('/'),
      null, null
    ));
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

var cal3eUtils = {
  createOperationListener: createOperationListener,
  nsprTimeToEeeDate: nsprTimeToEeeDate,
  calDateTimeToIsoDate: calDateTimeToIsoDate,
  eeeAttachmentToHttpUri: eeeAttachmentToHttpUri,
  fileAttachmentToEeeUri: fileAttachmentToEeeUri,
  isSupportedServer: isSupportedServer,
  getExpandedItems: getExpandedItems,
  getInstanceId: getInstanceId
};
EXPORTED_SYMBOLS = [
  'cal3eUtils'
];
