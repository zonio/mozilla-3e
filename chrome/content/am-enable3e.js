/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2012  Zonio s.r.o.
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

Components.utils.import("resource://calendar3e/modules/cal3eUtils.jsm");

function amEnable3e() {
  var identity;

  this.onPreInit = function amEnable3e_onPreInit(account, accountValues) {
    identity = account.defaultIdentity;
    document.getElementById("cal3e-enable-checkbox").checked =
      identity.getBoolAttribute(cal3e.EEE_ENABLED_KEY) || false;
  }

  this.onSave = function amEnable3e_onSave() {
    identity.setBoolAttribute(
      cal3e.EEE_ENABLED_KEY,
      document.getElementById("cal3e-enable-checkbox").checked
    );
  }
}

var onPreInit, onSave;

amEnable3e.onLoad = function () {
  var controller = new amEnable3e();
  onPreInit = controller.onPreInit;
  onSave = controller.onSave;

  parent.onPanelLoaded('am-enable3e.xul');
}
