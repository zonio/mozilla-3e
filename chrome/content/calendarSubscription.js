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

function calendarSubscription() {
  this._client = Cc["@zonio.net/calendar3e/client-service;1"].
    getService(Ci.calEeeIClient);
}

calendarSubscription.prototype = {

  getIdentity: function calendarSubscription_getIdentity() {
  },

  loadUsers: function calendarSubscription_loadUsers() {
    this._client
  }

}


var subscribeDialog;
calendarSubscription.open = function () {
  openDialog("chrome://calendar3e/content/calendarSubscription.xul",
             "cal3eSubscribe", "chrome,titlebar,modal,resizable");
}
calendarSubscription.onLoad = function () {
  subscribeDialog = new calendarSubscription();
}
calendarSubscription.onAccept = function () {
  subscribeDialog.store();

  return true;
}
calendarSubscription.onUnload = function () {
  subscribeDialog.finalize();
  subscribeDialog = null;
}
