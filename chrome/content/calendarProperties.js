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

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource://calendar3e/modules/cal3eUtils.jsm");

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
  var permissionsListBox = document.getElementById('permissions');
  var permissionsListCols = permissionsListBox.getElementsByTagName(
    "listcols")[0];
  while (permissionsListCols.nextSibling) {
    permissionsListBox.removeChild(permissionsListCols.nextSibling);
  }

  var clientListener = cal3e.createOperationListener(
    function cal3eProperties_loadUsers_onResult(methodQueue, result) {
      if (Components.results.NS_OK !== methodQueue.status) {
        //TODO can't get list of users
        return;
      }

      var users;
      try {
        users = result.QueryInterface(Components.interfaces.nsISupportsArray);
      } catch (e) {
        //TODO can't get list of users
        return;
      }

      for (var idx = 0; idx < users.Count(); idx++) {
        permissionsListBox.appendChild(
          cal3eProperties._listItemFromUser(users.GetElementAt(idx)));
      }
    });

  var client = Cc["@zonio.net/calendar3e/client-service;1"]
    .createInstance(Components.interfaces.calEeeIClient);

  var uriSpec = cal3eProperties._calendar.uri.spec,
      uriParts = uriSpec.split('/', 4),
      eeeUser = uriParts[2];
  var accountManager = Cc["@mozilla.org/messenger/account-manager;1"].
    getService(Components.interfaces.nsIMsgAccountManager);
  var identities = [i for each (i in fixIterator(
    accountManager.allIdentities, Components.interfaces.nsIMsgIdentity
  ))];
  var idx = identities.length;
  var identity = null;
  while (idx--) {
    if (identities[idx].getBoolAttribute('eee_enabled') &&
        (eeeUser == identities[idx].email)) {
      identity = identities[idx];
      break;
    }
  }
  client.getUsers(identity, clientListener, "");
};

cal3eProperties._listItemFromUser = function listItemFromAccount(user) {
  user = user.QueryInterface(Components.interfaces.nsIDictionary);

  var listItem = document.createElement("listitem");
  listItem.allowevents = 'true';

  var nameListCell = document.createElement("listcell");
  var realname = null;
  if (user.hasKey('attrs')) {
    var userAttrs = user.getValue('attrs').QueryInterface(
      Components.interfaces.nsISupportsArray
    );
    for (var idx = 0, attr; idx < userAttrs.Count(); idx++) {
      attr = userAttrs.QueryElementAt(
        idx, Components.interfaces.nsIDictionary
      );
      if ('realname' == attr.getValue('name').QueryInterface(
        Components.interfaces.nsISupportsCString
      )) {
        realname = attr.getValue('value').QueryInterface(
          Components.interfaces.nsISupportsCString
        );
        break;
      }
    }
  }
  var userLabel = "";
  if (realname) {
    userLabel += realname + " <";
  }
  userLabel += user.getValue('username').QueryInterface(
    Components.interfaces.nsISupportsCString
  );
  if (realname) {
    userLabel += ">";
  }
  nameListCell.appendChild(document.createTextNode(userLabel));
  listItem.appendChild(nameListCell);

  var stringBundle = document.getElementById('calendar3e-strings');

  var permissionListCell = document.createElement("listcell");
  var permissionMenuList = document.createElement("menulist");
  var permissionMenuPopup = document.createElement("menupopup");

  permissionMenuList.label = stringBundle ?
    stringBundle.getString('cal3eCalendarProperties.permissions.label') :
    "Permissions" ;

  var readPermissionMenuItem = document.createElement("menuitem");
  readPermissionMenuItem.setAttribute(
    'label',
    stringBundle ? stringBundle.getString('cal3eCalendarProperties.read.label') : "Read Only");
  readPermissionMenuItem.setAttribute(
    'value',
    'read');
  permissionMenuPopup.appendChild(readPermissionMenuItem);

  var writePermissionMenuItem = document.createElement("menuitem");
  writePermissionMenuItem.setAttribute(
    'label',
    stringBundle ? stringBundle.getString('cal3eCalendarProperties.write.label') : "Read/Write");
  writePermissionMenuItem.setAttribute(
    'value',
    'write');
  permissionMenuPopup.appendChild(writePermissionMenuItem);

  permissionMenuList.appendChild(permissionMenuPopup);
  permissionListCell.appendChild(permissionMenuList);
  listItem.appendChild(permissionListCell);

  return listItem;
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
