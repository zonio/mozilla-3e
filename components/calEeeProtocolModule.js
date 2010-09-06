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


const calEeeProtocolFactory = {

  QueryInterface: function (aIID) {
    if (!aIID.equals(Ci.nsISupports) &&
        !aIID.equals(Ci.nsIFactory)) {
      throw Cr.NS_ERROR_NO_INTERFACE;
    }

    return this;
  },

  createInstance: function (outer, iid) {
    if (null !== outer) {
      throw Cr.NS_ERROR_NO_AGGREGATION;
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
      var cal3eExtensionId = "calendar3e@zonio.net";
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
      throw Cr.NS_ERROR_NO_INTERFACE;
    }
    if (!iid.equals(Ci.nsIFactory)) {
      throw Cr.NS_ERROR_NOT_IMPLEMENTED;
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
