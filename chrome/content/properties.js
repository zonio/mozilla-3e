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

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");
Components.utils.import("resource://calendar3e/modules/feature.jsm");
Components.utils.import("resource://calendar3e/modules/model.jsm");
Components.utils.import("resource://calendar3e/modules/request.jsm");
Components.utils.import("resource://calendar3e/modules/utils.jsm");

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
    if (cal3eFeature.isSupported('permissions')) {
      permissionsRow.removeAttribute('hidden');
    }
  } else {
    if (cal3eFeature.isSupported('permissions')) {
      permissionsRow.hidden = 'true';
    }
  }
};

/**
 * Hides 3e controls introduced by overlay and shows those which
 * overlay hides.
 */
cal3eProperties.hide3eControls = function hide3eControls() {
  cal3eProperties.destroyTabs();

  var uriRow = document.getElementById('calendar-uri-row');
  uriRow.removeAttribute('hidden');
  var emailIdentityRow = document.getElementById('calendar-email-identity-row');
  emailIdentityRow.removeAttribute('hidden');
  var readOnlyRow = document.getElementById('calendar-readOnly-row');
  readOnlyRow.removeAttribute('hidden');

  if (cal3eFeature.isSupported('permissions')) {
    var typeRow = document.getElementById('calendar3e-type-row');
    typeRow.hidden = 'true';
    var permissionsRow = document.getElementById(
      'calendar3e-permissions-row'
    );
    permissionsRow.hidden = 'true';
  }

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

  var clientListener = function cal3eProperties_loadUsers_onResult(result) {
    if (!(result instanceof cal3eResponse.Success)) {
      //TODO can't get list of users
      return;
    }

    result.data.forEach(function(user) {
      permissionsListBox.appendChild(
        cal3eProperties._listItemFromUser(user)
      );
    });
  };

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
  cal3eRequest.Client.getInstance().getUsers(identity, clientListener, "");
};

cal3eProperties._listItemFromUser = function listItemFromAccount(user) {
  var listItem = document.createElement("listitem");
  listItem.allowevents = 'true';

  var nameListCell = document.createElement("listcell");
  nameListCell.appendChild(document.createTextNode(
    cal3eModel.userLabel(user))
  );
  listItem.appendChild(nameListCell);

  var stringBundle = document.getElementById('calendar3e-strings');

  var permissionListCell = document.createElement("listcell");
  var permissionMenuList = document.createElement("menulist");
  var permissionMenuPopup = document.createElement("menupopup");

  permissionMenuList.label = stringBundle ?
    stringBundle.getString('calendar3e.properties.permissions.label') :
    "Permissions" ;

  var readPermissionMenuItem = document.createElement("menuitem");
  readPermissionMenuItem.setAttribute(
    'label',
    stringBundle ? stringBundle.getString('calendar3e.properties.read.label') : "Read Only");
  readPermissionMenuItem.setAttribute(
    'value',
    'read');
  permissionMenuPopup.appendChild(readPermissionMenuItem);

  var writePermissionMenuItem = document.createElement("menuitem");
  writePermissionMenuItem.setAttribute(
    'label',
    stringBundle ? stringBundle.getString('calendar3e.properties.write.label') : "Read/Write");
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
 * Takes content of "General Information" tab moves it back to dialog
 * and removes all tabs.
 */
cal3eProperties.destroyTabs = function destroyTabs() {
  var tabbedVBox = document.getElementById('calendar3e-tabpanel-general-vbox');
  if (!tabbedVBox) {
    return;
  }

  var tabbox = tabbedVBox.parentNode.parentNode.parentNode;
  var mainVBox = tabbox.parentNode;

  var childNodes = tabbedVBox.childNodes
  for (var i = 0; i < childNodes.length; i++) {
    mainVBox.appendChild(childNodes[i]);
  };
  mainVBox.removeChild(tabbox);
}

/**
 * Takes content of "Calendar properties" dialog
 * and moves is to tab "General Information".
 */
cal3eProperties.moveGeneralToTab = function moveGeneralToTab() {
  var tabbedVBox = document.getElementById('calendar3e-tabpanel-general-vbox');
  var child = document.getElementById('calendar-enabled-checkbox');
  tabbedVBox.appendChild(child.cloneNode(true));
  child.parentNode.removeChild(child);

  child = document.getElementById('calendar-properties-grid');
  tabbedVBox.appendChild(child.cloneNode(true));
  child.parentNode.removeChild(child);

  document.getElementById('calendar-name').defaultValue =
    cal3eProperties._calendar.name;
}

/**
 * Displays additional controls for 3e calendars in properties dialog.
 *
 * Otherwise ensures that those controls are hidden.
 */
cal3eProperties.init = function init() {
  cal3eProperties._init = true;
  var calendar = window.arguments[0].calendar;
  cal3eProperties._calendar = calendar;

  if (calendar.type == 'eee') {
    cal3eProperties.moveGeneralToTab()
  } else {
    cal3eProperties.hide3eControls();
  }

  cal3eProperties._init = false;
};

window.addEventListener('load', cal3eProperties.init, false);
