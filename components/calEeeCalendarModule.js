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

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

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

/** @see calEeeClient */
Cu.import("resource://" + calendar3eResource + "/calEeeClient.js");
/** @see calEeeMethodQueue */
Cu.import("resource://" + calendar3eResource + "/calEeeMethodQueue.js");
/** @see calEeeCalendar */
Cu.import("resource://" + calendar3eResource + "/calEeeCalendar.js");

var components = [
  calEeeClient,
  calEeeMethodQueue,
  calEeeCalendar
];

function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule(components);
}
