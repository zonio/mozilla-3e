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
        Ci.nsIObserver,
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
    flags: Ci.nsIClassInfo.SINGLETON
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
        Ci.calEeeICalendar,
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
  },

  calEeeSynchronizationService: {
    getInterfaces: function cI_cal3eSynchronizationService_getInterfaces(count) {
      var interfaces = [
        Ci.calEeeISynchronizationService,
        Ci.nsIObserver,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage: function cI_cal3eSynchronizer_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "EEE calendar synchronization service",
    contractID: "@zonio.net/calendar3e/synchronization-service;1",
    classID: Components.ID("{d7a08a5f-46ad-4a84-ad66-1cc27e9f388e}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeSynchronizationService",
    flags: Ci.nsIClassInfo.SINGLETON,
    categories: ['profile-do-change']
  },

  calEeeSynchronizer: {
    getInterfaces: function cI_cal3eSynchronizer_getInterfaces(count) {
      var interfaces = [
        Ci.calEeeISynchronizer,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage: function cI_cal3eSynchronizer_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "EEE-enabled client calendar synchronizer",
    contractID: "@zonio.net/calendar3e/synchronizer;1",
    classID: Components.ID("{9045ff85-9e1c-47e4-9872-44c5ab424b73}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeSynchronizer",
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

    Cu.import("resource://calendar3e/cal3eUtils.jsm", this.__parent__);

    // Now load EEE extension scripts. Note that unintuitively,
    // __LOCATION__.parent == . We expect to find the subscripts in ./../js
    var jsDir = __LOCATION__.parent.parent.clone();
    jsDir.append("js");
    cal.loadScripts(["calEeeClient.js", "calEeeProtocol.js",
		     "calEeeCalendar.js", "calEeeMethodQueue.js",
                     "calEeeSynchronizer.js"],
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
    var categoryManager = Cc["@mozilla.org/categorymanager;1"]
      .getService(Ci.nsICategoryManager);

    for each (var component in calEeeClassInfo) {
      componentManager.registerFactoryLocation(
          component.classID,
          component.classDescription,
          component.contractID,
          fileSpec,
          location,
          type);
      for each (var category in component.categories) {
        categoryManager.addCategoryEntry(
          'profile-do-change',
          component.classDescription,
          (component.flags & Ci.nsIClassInfo.SINGLETON ? "service" : "") +
            component.contractID,
          true,
          true);
      }
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
