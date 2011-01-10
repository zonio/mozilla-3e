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

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource://calendar3e/cal3eUtils.jsm");

var cal3eProperties = {};

/**
 * Shows permissions control if calendar type is shared.
 *
 * Otherwise ensures that permissions control is hidden.
 */
cal3eProperties.typeChange = function typeChanged() {
  if ('eee' != cal3eProperties._calendar.type) {
    return;
  }

  var calendarEeeType = document.getElementById('calendar3e-type-group'),
      permissionsRow = document.getElementById('calendar3e-permissions-row');
  if ('shared' == calendarEeeType.selectedItem.value) {
    cal3eProperties._loadUsers();
    permissionsRow.removeAttribute('hidden');
  } else {
    permissionsRow.hidden = 'true';
  }
};

/**
 * Hides 3e controls introduced by overlay and shows those which
 * overlay hides.
 */
cal3eProperties.hide3eControls = function hide3eControls() {
  var uriRow = document.getElementById('calendar-uri-row');
  uriRow.removeAttribute('hidden');
  var emailIdentityRow = document.getElementById('calendar-email-identity-row');
  emailIdentityRow.removeAttribute('hidden');

  var typeRow = document.getElementById('calendar3e-type-row');
  typeRow.hidden = 'true';
  var permissionsRow = document.getElementById('calendar3e-permissions-row');
  permissionsRow.hidden = 'true';

  if (cal3eProperties._init) {
    window.sizeToContent();
  }
};

/**
 * Loads users from server.
 */
cal3eProperties._loadUsers = function loadUsers() {
  var consoleService = Cc["@mozilla.org/consoleservice;1"]
    .getService(Ci.nsIConsoleService);

  var permissionsListBox = document.getElementById('permissions');
  var permissionsListCols = permissionsListBox.getElementsByTagName(
    "listcols")[0];
  while (permissionsListCols.nextSibling) {
    permissionsListBox.removeChild(permissionsListCols.nextSibling);
  }

  var clientListener = cal3e.createOperationListener(
    function cal3eProperties_loadUsers_onResult(methodQueue, result) {
      consoleService.logStringMessage("Wut?");
      if (Cr.NS_OK !== methodQueue.status) {
        //TODO can't get list of users
        return;
      }

      consoleService.logStringMessage("How many? " + result.length);
      // permissionsListBox.appendChild(cal3eProperties._listItemFromUser());
    });

  var client = Cc["@zonio.net/calendar3e/client;1"]
    .createInstance(Ci.calEeeIClient);

  var uriSpec = cal3eProperties._calendar.uri.spec,
      uriParts = uriSpec.split('/', 4),
      eeeUser = uriParts[2];
  var accountManager = Cc["@mozilla.org/messenger/account-manager;1"].
    getService(Ci.nsIMsgAccountManager);
  var identities = [i for each (
    i in fixIterator(accountManager.allIdentities, Ci.nsIMsgIdentity)
  )];
  var idx = identities.length;
  while (idx--) {
    if (identities[idx].getBoolAttribute('eee_enabled') &&
        (eeeUser == identities[idx].email)) {
      client.identity = identities[idx];
      break;
    }
  }
  client.getUsers(clientListener, "");
};

cal3eProperties._listItemFromUser = function listItemFromAccount(user) {
  var listItem = document.createElement("listitem");
  listitem.allowevents = 'true';

  var nameListCell = document.createElement("listcell");
  nameListCell.value = user.username;
  listItem.appendChild(nameListCell);

  var stringBundle = document.getElementById('calendar3e-strings');

  var permissionListCell = document.createElement("listcell");
  var permissionMenuList = document.createElement("menulist");
  permissionMenuList.label = stringBundle.getString(
    'cal3eCalendarProperties.permissions.label');
  permissionMenuList.appendItem(stringBundle.getString(
    'cal3eCalendarProperties.read.label'), 'read');
  permissionMenuList.appendItem(stringBundle.getString(
    'cal3eCalendarProperties.write.label'), 'write');
  permissionListCell.appendChild(permissionMenuList);
  listItem.appendChild(permissionListCell);
};

/**
 * Displays additional controls for 3e calendars in properties dialog.
 *
 * Otherwise ensures that those controls are hidden.
 */
cal3eProperties.init = function init() {
  cal3eProperties._init = true;
  var calendar = window.arguments[0].calendar;
  cal3eProperties._calendar = calendar;

  if ('eee' != calendar.type) {
    cal3eProperties.hide3eControls();
  }

  var calendarEeeType = document.getElementById('calendar3e-type-group');
  calendarEeeType.addEventListener(
    'command', cal3eProperties.typeChange, false);
  cal3eProperties.typeChange();

  cal3eProperties._init = false;
};

window.addEventListener('load', cal3eProperties.init, false);
