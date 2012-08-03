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


Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function calEeeItip () {};

calEeeItip.classInfo = XPCOMUtils.generateCI({
  classID: Components.ID("{ee2d0640-a786-4caf-ad54-1cc51f251ba8}"),
  contractID: "@zonio.net/calendar3e/itip;1",
  classDescription: "EEE calendar iTip",
  interfaces: [Components.interfaces.calIItipTransport,
               Components.interfaces.nsIClassInfo],
  flags: 0
});

calEeeItip.prototype = {
  classDescription: calEeeItip.classInfo.classDescription,
  classID: calEeeItip.classInfo.classID,
  contractID: calEeeItip.classInfo.contractID,
  QueryInterface: XPCOMUtils.generateQI(
    calEeeItip.classInfo.getInterfaces({})),
  classInfo: calEeeItip.classInfo,
  
  get scheme() {
      return "mailto";
  },

  _senderAddress: null,
  get senderAddress() {
    return this._senderAddress;
  },
  
  set senderAddress(value) {
    this._senderAddress = value
    return this._senderAddress;
  },

  get type() {
    return "email";
  },
  
  sendItems: function calEeeItip_sendItems(aCount, aRecipients, aItipItem) {
    dump("sendItems called\n");
    
  }
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([calEeeItip]);
