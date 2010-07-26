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
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
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

    let jsDir = __LOCATION__.parent.parent.clone();
    jsDir.append("js");
    cal.loadScripts(["cal3eCalendar.js"], this.__parent__, jsDir);

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
