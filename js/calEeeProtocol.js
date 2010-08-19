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

Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

EXPORTED_SYMBOLS = [
  "calEeeProtocol"
];


function calEeeProtocol() {
}

calEeeProtocol.prototype = {

  QueryInterface: function(iid) {
    if (!iid.equals(Ci.nsIProtocolHandler) &&
        !iid.equals(Ci.nsISupports)) {
      throw new Cr.NS_ERROR_NO_INTERFACE;
    }

    return this;
  },

  scheme: 'eee',

  defaultPort: 4444,

  protocolFlags: Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE |
    Ci.nsIProtocolHandler.URI_NORELATIVE |
    Ci.nsIProtocolHandler.URI_NOAUTH ,

  newURI: function(spec, charset, baseUri) {
    var uri = Cc['@mozilla.org/network/simple-uri;1'].createInstance(Ci.nsIURI);
    //TODO some checks?
    uri.spec = spec;

    return uri;
  },

  eeeToHttpUri: function(eeeUri) {
    //TODO resolve hostname
    var httpUri = Cc['@mozilla.org/network/simple-uri;1'].createInstance(Ci.nsIURI);
    httpUri.spec = 'http://localhost:4444/RPC2';

    return httpUri;
  },

  newChannel: function(uri) {
  },

}
