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
    classID: Component.ID("{e2b342d0-6119-43d0-8fc6-6116876d2fdb}"),
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
    classID: Components.ID("{e2b342d0-6119-43d0-8fc6-6116876d2fdb}"),
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

    Cu.import("resource://" + calendar3eResource + "calEeeClient.js", this.__parent__);
    Cu.import("resource://" + calendar3eResource + "calEeeCalendar.js", this.__parent__);
    Cu.import("resource://" + calendar3eResource + "calEeeMethodQueue.js", this.__parent__);

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

    for each (var component in g_classInfo) {
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
      QueryInterface: function (aIID) {
        if (!aIID.equals(Ci.nsISupports) &&
            !aIID.equals(Ci.nsIFactory)) {
          throw Cr.NS_ERROR_NO_INTERFACE;
        }

        return this;
      },

      createInstance: function (aOuter, aIID) {
        if (aOuter != null) {
          throw Cr.NS_ERROR_NO_AGGREGATION;
        }

        return (new constructor()).QueryInterface(aIID);
      }
    };

    return factory;
  },

  getClassObject: function cal3eModule_getClassObject(componentManager,
                                                      aCID,
                                                      aIID) {
    if (!aIID.equals(Ci.nsIFactory)) {
      throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    }

    this._loadUtils();

    for each (var component in g_classInfo) {
      if (aCID.equals(component.classID)) {
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
