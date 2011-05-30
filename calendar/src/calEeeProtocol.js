/* ***** BEGIN LICENSE BLOCK *****
 * Mozilla 3e Calendar Extension
 * Copyright © 2010  Zonio s.r.o.
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

/**
 * Simple definition of EEE URIs just enough to enable eee URI scheme.
 */
function calEeeProtocol() {
}

calEeeProtocol.prototype = {

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
    var uri = Cc['@mozilla.org/network/simple-uri;1']
      .createInstance(Ci.nsIURI);
    //TODO some checks?
    uri.spec = spec;

    return uri;
  },

  /**
   * Currently simply returns channel to XML-RPC gateway on EEE server.
   *
   * @param {nsIURI} uri EEE URI
   * @returns {nsIHttpProtocolHandler}
   */
  newChannel: function(uri) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
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
