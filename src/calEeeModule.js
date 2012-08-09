/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2011  Zonio s.r.o.
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

var components = {
  calEeeClient: {
    getInterfaces: function calEeeClient_getInterfaces(count) {
      var interfaces = [
        Ci.calEeeIClient,
        Ci.calIGenericOperationListener,
        Ci.nsIObserver,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage:
    function calEeeClient_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "EEE client simplifying server method calls to " +
                      "prepared operations",
    contractID: "@zonio.net/calendar3e/client-service;1",
    classID: Components.ID("{738411ac-e702-4e7e-86b6-be1ca113c853}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeClient",
    flags: Ci.nsIClassInfo.SINGLETON,
    resource: "resource://calendar3e/js/calEeeClient.js"
  },

  calEeeProtocol: {
    getInterfaces: function calEeeProtocol_getInterfaces(count) {
      var interfaces = [
        Ci.nsIProtocolHandler,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage:
    function calEeeProtocol_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "EEE protocol handler",
    contractID: "@mozilla.org/network/protocol;1?name=eee",
    classID: Components.ID("{a9ffc806-c8e1-4feb-84c9-d748bc5e34f3}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeProtocol",
    flags: 0,
    resource: "resource://calendar3e/js/calEeeProtocol.js"
  },

  calEeeCalendar: {
    getInterfaces: function calEeeCalendar_getInterfaces(count) {
      var interfaces = [
        Ci.calEeeICalendar,
        Ci.calICalendar,
        Ci.calIObserver,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage:
    function calEeeCalendar_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "EEE calendar provider",
    contractID: "@mozilla.org/calendar/calendar;1?type=eee",
    classID: Components.ID("{e2b342d0-6119-43d0-8fc6-6116876d2fdb}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeCalendar",
    flags: 0,
    resource: "resource://calendar3e/js/calEeeCalendar.js"
  },

  calEeeManager: {
    getInterfaces: function calEeeManager_getInterfaces(count) {
      var interfaces = [
        Ci.calEeeIManager,
        Ci.calICalendarManagerObserver,
        Ci.nsIObserver,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage:
    function calEeeManager_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "EEE calendar manager",
    contractID: "@zonio.net/calendar3e/manager;1",
    classID: Components.ID("{b65ddbd7-c4f0-46fe-9a36-f2bc8ffe113b}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeManager",
    flags: Ci.nsIClassInfo.SINGLETON,
    resource: "resource://calendar3e/js/calEeeManager.js"
  },

  calEeeMethodQueue: {
    getInterfaces:
    function calEeeMethodQueue_getInterfaces(count) {
      var interfaces = [
        Ci.calEeeIMethodQueue,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage:
    function calEeeMethodQueue_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "Queue for methods to be executed on the EEE server",
    contractID: "@zonio.net/calendar3e/method-queue;1",
    classID: Components.ID("{bd47191f-9617-4a77-ae79-b7927b535f4c}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeMethodQueue",
    flags: 0,
    resource: "resource://calendar3e/js/calEeeMethodQueue.js"
  },

  calEeeSynchronizationService: {
    getInterfaces:
    function calEeeSynchronizationService_getInterfaces(count) {
      var interfaces = [
        Ci.calEeeISynchronizationService,
        Ci.nsIObserver,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage:
    function calEeeSynchronizer_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "EEE calendar synchronization service",
    contractID: "@zonio.net/calendar3e/synchronization-service;1",
    classID: Components.ID("{d7a08a5f-46ad-4a84-ad66-1cc27e9f388e}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeSynchronizationService",
    flags: Ci.nsIClassInfo.SINGLETON,
    resource: "resource://calendar3e/js/calEeeSynchronizer.js"
  },

  calEeeSynchronizer: {
    getInterfaces: function calEeeSynchronizer_getInterfaces(count) {
      var interfaces = [
        Ci.calEeeISynchronizer,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage:
    function calEeeSynchronizer_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "EEE-enabled client calendar synchronizer",
    contractID: "@zonio.net/calendar3e/synchronizer;1",
    classID: Components.ID("{9045ff85-9e1c-47e4-9872-44c5ab424b73}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeSynchronizer",
    flags: 0,
    resource: "resource://calendar3e/js/calEeeSynchronizer.js"
  },

  calEeeFreeBusyProvider: {
    getInterfaces: function calEeeFreeBusyProvider_getInterfaces(count) {
      var interfaces = [
        Ci.calEeeIFreeBusyProvider,
        Ci.calIFreeBusyProvider,
        Ci.nsIObserver,
        Ci.nsIClassInfo
      ];
      count.value = interfaces.length;
      return interfaces;
    },

    getHelperForLanguage:
    function calEeeFreeBusyProvider_getHelperForLanguage(language) {
      return null;
    },

    classDescription: "EEE calendar freebusy provider",
    contractID: "@zonio.net/calendar3e/freebusy-provider;1",
    classID: Components.ID("{310e5872-2101-40cc-8315-a05578f3e5df}"),
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    constructor: "calEeeFreeBusyProvider",
    flags: Ci.nsIClassInfo.SINGLETON,
    resource: "resource://calendar3e/js/calEeeFreeBusyProvider.js"
  }
};

var calEeeModule = {

  _registerResource: function calEeeModule_registerResource() {
    if (this._resourceRegistered) {
      return;
    }

    var ioService = Components.classes["@mozilla.org/network/io-service;1"].
      getService(Components.interfaces.nsIIOService);
    var resourceProtocol = ioService.getProtocolHandler("resource").
      QueryInterface(Components.interfaces.nsIResProtocolHandler);
    if (resourceProtocol.hasSubstitution('calendar3e')) {
      this._resourceRegistered = true;
      return;
    }

    var cal3eExtensionId = "calendar3e@zonio.net";
    var em = Components.classes["@mozilla.org/extensions/manager;1"]
      .getService(Components.interfaces.nsIExtensionManager);
    var file = em.getInstallLocation(cal3eExtensionId)
      .getItemFile(cal3eExtensionId, "chrome.manifest");
    var resourceDir = file.parent.clone();
    var resourceDirUri = ioService.newFileURI(resourceDir);
    resourceProtocol.setSubstitution('calendar3e', resourceDirUri);

    this._resourceRegistered = true;
  },

  unregisterSelf: function calEeeModule_unregisterSelf(componentManager) {
    componentManager = componentManager.QueryInterface(
      Ci.nsIComponentRegistrar);
    for each (var component in components) {
      componentManager.unregisterFactoryLocation(component.classID);
    }
  },

  registerSelf: function calEeeModule_registerSelf(componentManager,
                                                   fileSpec,
                                                   location,
                                                   type) {
    componentManager = componentManager.QueryInterface(
      Ci.nsIComponentRegistrar
    );

    for each (var component in components) {
      componentManager.registerFactoryLocation(
          component.classID,
          component.classDescription,
          component.contractID,
          fileSpec,
          location,
          type
      );
    }
  },

  makeFactoryFor: function calEeeModule_makeFactoryFor(constructor) {
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

  getClassObject: function calEeeModule_getClassObject(componentManager,
                                                       cid,
                                                       iid) {
    if (!iid.equals(Ci.nsIFactory)) {
      throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    }

    var found = false;
    for each (var component in components) {
      if (cid.equals(component.classID)) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw Cr.NS_ERROR_NO_INTERFACE;
    }

    this._registerResource();
    Cu.import(component.resource);

    return this.makeFactoryFor(eval(component.constructor));
  },

  canUnload: function(componentManager) {
    return true;
  }

};

function NSGetModule(componentManager, fileSpec) {
  return calEeeModule;
}
