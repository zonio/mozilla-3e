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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;
const Cu = Components.utils;

var calEeeClassInfo = {
  calEeeClient: {
    getInterfaces: function cI_cal3eClient_getInterfaces(count) {
      var interfaces = [
        Ci.calEeeIClient,
        Ci.calIGenericOperationListener,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage: function cI_cal3eClient_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "EEE client simplifying server method calls to " +
                      "prepared operations",
    contractID: "@zonio.net/calendar3e/client;1",
    classID: Components.ID("{738411ac-e702-4e7e-86b6-be1ca113c853}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeClient",
    flags: 0
  },

  calEeeProtocol: {
    getInterfaces: function cI_cal3eProtocol_getInterfaces(count) {
      var interfaces = [
        Ci.nsIProtocolHandler,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage: function cI_cal3eProtocol_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "EEE protocol handler",
    contractID: "@mozilla.org/network/protocol;1?name=eee",
    classID: Components.ID("{a9ffc806-c8e1-4feb-84c9-d748bc5e34f3}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeProtocol",
    flags: 0
  },

  calEeeCalendar: {
    getInterfaces: function cI_cal3eCalendar_getInterfaces(count) {
      var interfaces = [
        Ci.calICalendar,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage: function cI_cal3eCalendar_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "EEE calendar provider",
    contractID: "@mozilla.org/calendar/calendar;1?type=eee",
    classID: Components.ID("{e2b342d0-6119-43d0-8fc6-6116876d2fdb}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeCalendar",
    flags: 0
  },

  calEeeMethodQueue: {
    getInterfaces: function cI_cal3eMethodQueue_getInterfaces(count) {
      var interfaces = [
        Ci.calEeeIMethodQueue,
        Ci.nsIXmlRpcClientListener,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage: function cI_cal3eMethodQueue_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "Queue for methods to be executed on the EEE server",
    contractID: "@zonio.net/calendar3e/method-queue;1",
    classID: Components.ID("{bd47191f-9617-4a77-ae79-b7927b535f4c}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeMethodQueue",
    flags: 0
  }
};

var calEeeCalendarModule = {

  _utilsLoaded: false,

  _loadUtils: function cal3eModule_loadUtils() {
    if (this._utilsLoaded) {
        return;
    }

    Cu.import("resource://calendar/modules/calUtils.jsm");
    Cu.import("resource://calendar/modules/calProviderUtils.jsm");
    Cu.import("resource://calendar/modules/calAuthUtils.jsm");
    Cu.import("resource:///modules/iteratorUtils.jsm");
    Cu.import("resource://gre/modules/XPCOMUtils.jsm");
    cal.loadScripts(["calUtils.js"], this.__parent__);
    
    // dynamically register resource space for 3e calendar provider which is
    // needed because this code is executed before chrome registration
    // (registering records from chrome.manifest)
    var calendar3eResource = "calendar3e";
    var ioService = Cc["@mozilla.org/network/io-service;1"].
        getService(Ci.nsIIOService);
    var resourceProtocol = ioService.getProtocolHandler("resource").
        QueryInterface(Ci.nsIResProtocolHandler);
    if (!resourceProtocol.hasSubstitution(calendar3eResource)) {
      var cal3eExtensionId = "calendar3e@zonio.net";
      var em = Cc["@mozilla.org/extensions/manager;1"].
          getService(Ci.nsIExtensionManager);
      var file = em.getInstallLocation(cal3eExtensionId).
          getItemFile(cal3eExtensionId, "install.rdf");
      var resourceDir = file.parent.clone().append("js");
      var resourceDirUri = ioService.newFileURI(resourceDir);
      resourceProtocol.setSubstitution(calendar3eResource, resourceDirUri);
    }

    Cu.import("resource://" + calendar3eResource + "/cal3eUtils.js", this.__parent__);

    // Now load EEE extension scripts. Note that unintuitively,
    // __LOCATION__.parent == . We expect to find the subscripts in ./../js
    var jsDir = __LOCATION__.parent.parent.clone();
    jsDir.append("js");
    cal.loadScripts(["calEeeClient.js", "calEeeProtocol.js",
		     "calEeeCalendar.js", "calEeeMethodQueue.js"],
		    this.__parent__, jsDir);

    this._utilsLoaded = true;
  },

  unregisterSelf: function cal3eModule_unregisterSelf(componentManager) {
    componentManager = componentManager.QueryInterface(
      Ci.nsIComponentRegistrar);
    for each (var component in calEeeClassInfo) {
      componentManager.unregisterFactoryLocation(component.classID);
    }
  },

  registerSelf: function cal3eModule_registerSelf(componentManager,
                                                  fileSpec,
                                                  location,
                                                  type) {
    componentManager = componentManager.QueryInterface(
      Ci.nsIComponentRegistrar);

    for each (var component in calEeeClassInfo) {
      componentManager.registerFactoryLocation(
          component.classID,
          component.classDescription,
          component.contractID,
          fileSpec,
          location,
          type);
    }
  },

  makeFactoryFor: function cal3eModule_makeFactoryFor(constructor) {
    var factory = {
      QueryInterface: function (iid) {
        if (!iid.equals(Ci.nsISupports) &&
            !iid.equals(Ci.nsIFactory)) {
          throw Cr.NS_ERROR_NO_INTERFACE;
        }

        return this;
      },

      createInstance: function (outer, iid) {
        if (outer != null) {
          throw Cr.NS_ERROR_NO_AGGREGATION;
        }

        return (new constructor()).QueryInterface(iid);
      }
    };

    return factory;
  },

  getClassObject: function cal3eModule_getClassObject(componentManager,
                                                      cid,
                                                      iid) {
    if (!iid.equals(Ci.nsIFactory)) {
      throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    }

    this._loadUtils();

    for each (var component in calEeeClassInfo) {
      if (cid.equals(component.classID)) {
        return this.makeFactoryFor(eval(component.constructor));
      }
    }
    throw Cr.NS_ERROR_NO_INTERFACE;
  },

  canUnload: function(componentManager) {
    return true;
  }

};

function NSGetModule(componentManager, fileSpec) {
  return calEeeCalendarModule;
}
