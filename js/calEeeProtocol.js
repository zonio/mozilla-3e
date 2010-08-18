EXPORTED_SYMBOLS = [
  "calEeeProtocol"
];

Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;


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
