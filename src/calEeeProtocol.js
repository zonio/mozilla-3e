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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://calendar3e/modules/utils.jsm");

/**
 * Simple definition of EEE URIs just enough to enable eee URI scheme.
 */
function calEeeProtocol() {
}

calEeeProtocol.prototype = {

  classDescription: "EEE protocol handler",

  classID: Components.ID("{a9ffc806-c8e1-4feb-84c9-d748bc5e34f3}"),

  contractID: "@mozilla.org/network/protocol;1?name=eee",

  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIProtocolHandler
  ]),

  scheme: 'eee',

  defaultPort: 4444,

  protocolFlags: Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE |
    Ci.nsIProtocolHandler.URI_NORELATIVE |
    Ci.nsIProtocolHandler.URI_NOAUTH ,

  /**
   * Creates new nsIURI instance from given URI specification.
   *
   * @param {String} spec URI specification
   * @param {String|null} charset (ignored) all data in EEE protocol
   * are UTF-8 encoded
   * @param {String|null} baseUri (ignored) no relative URIs are
   * relevant in EEE URI scheme
   * @returns {nsIURI}
   */
  newURI: function(spec, charset, baseUri) {
    var uri = Cc['@mozilla.org/network/standard-url;1']
      .createInstance(Ci.nsIStandardURL);
    //TODO some checks?
    uri.init(
      Ci.nsIStandardURL.URLTYPE_STANDARD,
      this.defaultPort,
      spec,
      charset,
      baseUri
    );

    return uri;
  },

  /**
   * Currently simply returns channel to XML-RPC gateway on EEE server.
   *
   * @param {nsIURI} uri EEE URI
   * @returns {nsIHttpProtocolHandler}
   */
  newChannel: function(uri) {
    if (!this.checkAttachUri(uri)) {
      throw Cr.NS_ERROR_FAILURE;
    }
    var httpUri = cal3eUtils.eeeAttachmentToHttpUri(uri);
    return Services.io.newChannel(httpUri.spec, null, null);
  },

  checkAttachUri: function(uri) {
    var splitted = uri.spec.split('/');
    return (splitted.length === 6 && splitted[3] === 'attach');
  },

  /**
   * Checks whether given port is backlisted.
   *
   * Resolution of this problem is delegated to {@link
   * nsIHttpProtocolHandler}.
   *
   * @param {Number} port
   * @param {String} scheme
   * @returns {Boolean}
   */
  allowPort: function(port, scheme) {
    return httpProtocol.allowPort(port, scheme);
  }

}

const NSGetFactory = XPCOMUtils.generateNSGetFactory([calEeeProtocol]);
