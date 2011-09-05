/* ***** BEGIN LICENSE BLOCK *****
 * Mozilla 3e Calendar Extension
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

const Cu = Components.utils;

function startUp() {
  var ioService = Cc["@mozilla.org/network/io-service;1"].
    getService(Ci.nsIIOService);
  var resourceProtocol = ioService.getProtocolHandler("resource").
    QueryInterface(Ci.nsIResProtocolHandler);

  var extensionDir = __LOCATION__.parent.parent.parent.clone();
  var resourceDir, resourceDirUri;

  resourceDir = extensionDir.clone().appendRelativePath('calendar');
  resourceDirUri = ioService.newFileURI(resourceDir);
  resourceProtocol.setSubstitution('cal3eCalendar', resourceDirUri);

  Cu.import("resource://cal3eCalendar/modules/cal3eTypes.js");

  Cu.import("resource://calendar/modules/calUtils.jsm");
  cal.loadScripts("xml-rpc/src/nsDictionary.js", this, extensionDir);
  cal.loadScripts("xml-rpc/src/nsXmlRpcClient.js", this, extensionDir);
}

testCalendarBuild.description = "Builds calendar from XML-RPC response";
testCalendarBuild.priority = 'normal';
function testCalendarBuild() {
  var response = new nsDictionary;
}
