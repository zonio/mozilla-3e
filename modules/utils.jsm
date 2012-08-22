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
  var uriString = eeeUri.spec;
  var port = 4444;
  var server = uriString.split('/')[2].split('@')[1];
  var sha1 = uriString.split('/')[4];
  var file = uriString.split('/')[5];
  var httpUri = 'https://' + server + ':' + port + '/' + 'attach' + '/'
                + sha1 + '/' + file;
  return Services.io.newURI(httpUri, null, null);
}

var cal3eUtils = {
  createOperationListener: createOperationListener,
  eeeAttachmentToHttpUri: eeeAttachmentToHttpUri
};
EXPORTED_SYMBOLS = [
  'cal3eUtils'
];
