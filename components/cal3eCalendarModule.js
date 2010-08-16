// nsIFactory
const cal3eCalendarFactory = {

  QueryInterface: function (aIID) {
    if (!aIID.equals(Components.interfaces.nsISupports) &&
        !aIID.equals(Components.interfaces.nsIFactory)) {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }

    return this;
  },

  createInstance: function (outer, iid) {
    if (null !== outer) {
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    }

    return (new cal3eCalendar()).QueryInterface(iid);
  }

}


/****
 **** module registration
 ****/

var cal3eCalendarModule = {

  cid: Components.ID("{20d220ec-818d-43be-8969-5a03b7757d3d}"),
  contractId: "@mozilla.org/calendar/calendar;1?type=3e",

  _utilsLoaded: false,
  _loadUtils: function () {
    if (this._utilsLoaded) {
      return;
    }

    Components.utils.import("resource://calendar/modules/calUtils.jsm");
    Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");
    cal.loadScripts(["calUtils.js"], this.__parent__);

    var calendar3eResource = "calendar3e";
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
        .getService(Components.interfaces.nsIIOService);
    var resourceProtocol = ioService.getProtocolHandler("resource")
        .QueryInterface(Components.interfaces.nsIResProtocolHandler);
    if (!resourceProtocol.hasSubstitution(calendar3eResource)) {
      var cal3eExtensionId = "{a62ef8ec-5fdc-40c2-873c-223b8a6925cc}";
      var em = Components.classes["@mozilla.org/extensions/manager;1"]
          .getService(Components.interfaces.nsIExtensionManager);
      var file = em.getInstallLocation(cal3eExtensionId)
          .getItemFile(cal3eExtensionId, "install.rdf");
      var resourceDir = file.parent.clone();
      resourceDir.append("js");
      var resourceDirUri = ioService.newFileURI(resourceDir);
      resourceProtocol.setSubstitution(calendar3eResource, resourceDirUri);
    }
    Components.utils.import("resource://" + calendar3eResource + "/cal3eCalendar.js");

    this._utilsLoaded = true;
  },

  registerSelf: function (compMgr, fileSpec, location, type) {
    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
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
    if (!iid.equals(Components.interfaces.nsIFactory)) {
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    }
    this._loadUtils();

    return cal3eCalendarFactory;
  },

  canUnload: function(compMgr) {
    return true;
  }

}


function NSGetModule(compMgr, fileSpec) {
  return cal3eCalendarModule;
}
