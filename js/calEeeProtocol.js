EXPORTED_SYMBOLS = [
  "calEeeProtocol"
];

Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;


function calEeeProtocol() {
}

calEeeProtocol.prototype = {

  QueryInterface: function(iid) {
    if (!iid.equals(Ci.nsIProtocolHandler) &&
        !iid.equals(Ci.nsISupports)) {
      throw new Components.results.NS_ERROR_NO_INTERFACE;
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
    var spec = eeeUri.spec;
    //TODO resolve hostname
  },

  newChannel: function(uri) {
  },

}
