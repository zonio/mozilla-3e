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
};

/****
 **** module registration
 ****/

var cal3eCalendarModule = {

  mCID: Components.ID("{20d220ec-818d-43be-8969-5a03b7757d3d}"),
  mContractID: "@mozilla.org/calendar/calendar;1?type=3e",

  mUtilsLoaded: false,
  loadUtils: function cICM_loadUtils() {
    if (this.mUtilsLoaded) {
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
      var extensionDir = file.parent.clone();
      extensionDir.append("js");

      var aliasFile = Components.classes["@mozilla.org/file/local;1"]
          .createInstance(Components.interfaces.nsILocalFile);
      aliasFile.initWithPath(extensionDir.path);
      var aliasUri = ioService.newFileURI(aliasFile);
      resourceProtocol.setSubstitution(calendar3eResource, aliasUri);
    }
    Components.utils.import("resource://" + calendar3eResource + "/cal3eCalendar.js");

    this.mUtilsLoaded = true;
  },

  registerSelf: function (compMgr, fileSpec, location, type) {

    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    compMgr.registerFactoryLocation(
        this.mCID,
        "Calendar 3e provider",
        this.mContractID,
        fileSpec,
        location,
        type
      );
  },

  getClassObject: function (compMgr, cid, iid) {
    if (!cid.equals(this.mCID))
      throw Components.results.NS_ERROR_NO_INTERFACE;

    if (!iid.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    this.loadUtils();

    return cal3eCalendarFactory;
  },

  canUnload: function(compMgr) {
    return true;
  }
};

function NSGetModule(compMgr, fileSpec) {
  return cal3eCalendarModule;
}
