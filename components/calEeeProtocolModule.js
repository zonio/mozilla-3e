const Ci = Components.interfaces;
const Cc = Components.classes;


const calEeeProtocolFactory = {

  QueryInterface: function (aIID) {
    if (!aIID.equals(Ci.nsISupports) &&
        !aIID.equals(Ci.nsIFactory)) {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }

    return this;
  },

  createInstance: function (outer, iid) {
    if (null !== outer) {
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    }

    return (new calEeeProtocol()).QueryInterface(iid);
  }

}


var calEeeProtocolModule = {

  cid: Components.ID("{a9ffc806-c8e1-4feb-84c9-d748bc5e34f3}"),
  contractId: "@mozilla.org/network/protocol;1?name=eee",

  _utilsLoaded: false,
  _loadUtils: function () {
    if (this._utilsLoaded) {
      return;
    }

    Components.utils.import("resource://calendar/modules/calUtils.jsm");

    var calendar3eResource = "calendar3e";
    var ioService = Cc["@mozilla.org/network/io-service;1"]
        .getService(Ci.nsIIOService);
    var resourceProtocol = ioService.getProtocolHandler("resource")
        .QueryInterface(Ci.nsIResProtocolHandler);
    if (!resourceProtocol.hasSubstitution(calendar3eResource)) {
      var cal3eExtensionId = "{a62ef8ec-5fdc-40c2-873c-223b8a6925cc}";
      var em = Cc["@mozilla.org/extensions/manager;1"]
          .getService(Ci.nsIExtensionManager);
      var file = em.getInstallLocation(cal3eExtensionId)
          .getItemFile(cal3eExtensionId, "install.rdf");
      var resourceDir = file.parent.clone();
      resourceDir.append("js");
      var resourceDirUri = ioService.newFileURI(resourceDir);
      resourceProtocol.setSubstitution(calendar3eResource, resourceDirUri);
    }
    Components.utils.import("resource://" + calendar3eResource + "/calEeeProtocol.js");

    this._utilsLoaded = true;
  },

  registerSelf: function (compMgr, fileSpec, location, type) {
    compMgr = compMgr.QueryInterface(Ci.nsIComponentRegistrar);
    compMgr.registerFactoryLocation(
        this.cid,
        "Calendar 3e provider",
        this.contractId,
        fileSpec,
        location,
        type
      );
  },

  getClassObject: function (compMgr, cid, iid) {
    if (!cid.equals(this.cid)) {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    if (!iid.equals(Ci.nsIFactory)) {
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    }
    this._loadUtils();

    return calEeeProtocolFactory;
  },

  canUnload: function(compMgr) {
    return true;
  }

}


function NSGetModule(compMgr, fileSpec) {
  return calEeeProtocolModule;
}
