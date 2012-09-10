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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
//Components.utils.import("resource://calendar3e/modules/dns.jsm");

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
 * Translates eee attachment uri to http uri so attachment can be
 * downloaded by web  browser.
 * @param {nsIURI} eeeUri Uri to be translated
 * @return {nsIURI} translated Uri
 */
function eeeAttachmentToHttpUri(eeeUri) {
  
  // XXX: We should ask DNS for hostname and port number.
  var dns;
  if (typeof cal3eDns !== 'undefined') {
    dns = new cal3eDns();
  }
  var host = eeeUri.spec.split('/')[2].split('@')[1];
  var port;
  if (!dns) {
    port = 4444;
  } else {
    [host, port] = dns.resolverServer(host);
  }
  var uriString = eeeUri.spec;
  var sha1 = uriString.split('/')[4];
  var file = uriString.split('/')[5];
  var httpUri = 'https://' + host + ':' + port + '/' + 'attach' + '/'
                + sha1 + '/' + file;
  return Services.io.newURI(httpUri, null, null);
}

/**
 * Computes SHA1 of content of local file specified by given uri.
 * @param {nsIURI} uri specifying file.
 * @return {String} sha1 hash.
 */
function computeSha1(uri) {
  var inputStream = Services.io.newChannel(uri.spec, null, null).open();

  var ch = Components.classes["@mozilla.org/security/hash;1"]
    .createInstance(Components.interfaces.nsICryptoHash);
  ch.init(ch.SHA1);
  ch.updateFromStream(inputStream, 0xffffffff);
  var hash = ch.finish(false);

  function toHexString(charCode) {
    return ("0" + charCode.toString(16)).slice(-2);
  }
  return [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
}

/**
 * Converts iCalendar local file attachment uri to eee attachment uri.
 * @param {nsIURI} fileUri local file uri
 * @param {String} email of user creating an event with attachments.
 * @return {String} eee attachment uri.
 */
function fileAttachmentToEeeUri(fileUri, email) {
  var sha1 = computeSha1(fileUri);
  var splittedUri = fileUri.spec.split('/');
  var fileName = splittedUri[splittedUri.length - 1];
  var eeeUri = 'eee://' + email + '/attach/' + sha1 + '/' + fileName;
  return Services.io.newURI(eeeUri, null, null);
}

var cal3eUtils = {
  createOperationListener: createOperationListener,
  eeeAttachmentToHttpUri: eeeAttachmentToHttpUri,
  fileAttachmentToEeeUri: fileAttachmentToEeeUri
};
EXPORTED_SYMBOLS = [
  'cal3eUtils'
];
