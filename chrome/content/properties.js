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
Components.utils.import("resource://calendar3e/modules/identity.jsm");
Components.utils.import("resource://calendar3e/modules/feature.jsm");
Components.utils.import("resource://calendar3e/modules/model.jsm");
Components.utils.import("resource://calendar3e/modules/request.jsm");
Components.utils.import("resource://calendar3e/modules/response.jsm");
Components.utils.import("resource://calendar3e/modules/utils.jsm");
Components.utils.import("resource://calendar3e/modules/xul.jsm");

function cal3ePermissionsTreeController(calendar) {
  var groupPermissions;
  var userPermissions;
  var identity;
  var element;

  function didError() {
    document.getElementById('notifications').appendNotification(
      'Could not get list of permissions.',
      0,
      null,
      document.getElementById('notifications').PRIORITY_WARNING_MEDIUM,
      null
    );
  }

  function loadPermissions() {
    loadUserPermissions();
  }

  function loadUserPermissions() {
    userPermissions = null;

    cal3eRequest.Client.getInstance()
      .getUserPermissions(identity, userPermissionsDidLoad, calendar);
  }

  function userPermissionsDidLoad(result) {
    if (!(result instanceof cal3eResponse.Success)) {
      didError();
      return;
    }

    userPermissions = result.data;
    loadUsers();
  }

  function loadUsers() {
    var query = '';
    userPermissions.forEach(function(user) {
      if (query !== '') {
        query += ' OR ';
      }
      query += "match_username('" + user.user + "')";
    });

    cal3eRequest.Client.getInstance()
      .getUsers(identity, usersDidLoad, query);
  }

  function usersDidLoad(result) {
    if (!(result instanceof cal3eResponse.Success)) {
      didError();
      return;
    }

    var users = result.data;
    userPermissions.forEach(function(userPermission) {
      userPermission['type'] = 'user';
      userPermission['label'] =
        cal3eModel.userLabel(findUser(userPermission.user, users)) ||
        cal3eModel.userLabel({ username: userPermission.user });
      userPermission.toString = function() {
        return userPermission.label;
      }
    });

    loadGroupPermissions();
  }

  function loadGroupPermissions() {
    groupPermissions = null;

    cal3eRequest.Client.getInstance()
      .getGroupPermissions(identity, groupPermissionsDidLoad, calendar);
  }

  function groupPermissionsDidLoad(result) {
    if (!(result instanceof cal3eResponse.Success)) {
      didError();
      return;
    }

    groupPermissions = result.data;
    loadGroups();
  }

  function loadGroups() {
    var query = '';
    groupPermissions.forEach(function(group) {
      if (query !== '') {
        query += ' OR ';
      }
      query += "match_groupname('" + group.group + "')";
    });

    cal3eRequest.Client.getInstance()
      .getGroups(identity, groupsDidLoad, query);
  }

  function groupsDidLoad(result) {
    if (!(result instanceof cal3eResponse.Success)) {
      didError();
      return;
    }

    var groups = result.data;
    groupPermissions.forEach(function(groupPermission) {
      groupPermission['type'] = 'group';
      groupPermission['label'] =
        findGroup(groupPermission.group, groups)['title'] ||
        'Unknown Group (' + groupPermission.group + ')';
      groupPermission.toString = function() {
        return groupPermission['label'];
      }
    });

    fillElement();
  }

  function fillElement() {
    var entities = userPermissions.concat(groupPermissions);
    entities.sort();

    entities.forEach(function(entity) {
      cal3eXul.addItemsToTree(element, [
        { label: entity.label,
          properties: entity.type === 'user'
            ? "calendar3e-treecell-icon-user"
            : "calendar3e-treecell-icon-group"},
        { value: true },
        { value: entity.perm === 'write' }
      ]);
    });
  }

  function findUser(username, users) {
    if (username === '*') {
      return { username: 'All users' };
    }
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === username) {
        return users[i];
      }
    }
    return null;
  }

  function findGroup(groupname, groups) {
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].groupname === groupname) {
        return groups[i];
      }
    }
    return null;
  }

  function findAndSetIdentity() {
    var identities = cal3eIdentity.Collection()
      .getEnabled()
      .findByEmail(cal3eModel.calendarUser(calendar));

    identity = identities.length > 0 ? identities[0] : null;
  }

  function init() {
    element = document.getElementById('calendar3e-permissions-tree');
    findAndSetIdentity();
    loadPermissions();
  }

  init();
};


var cal3eProperties = {};

/**
 * Hides 3e controls introduced by overlay and shows those which
 * overlay hides.
 */
cal3eProperties.hide3eControls = function hide3eControls() {
  cal3eProperties.destroyTabs();

  var grid = document.getElementById('calendar-properties-grid');
  grid.removeAttribute('flex');
  grid.removeAttribute('style');
  var enableCalendarRow = document.getElementById('calendar-enabled-checkbox');
  enableCalendarRow.removeAttribute('hidden');
  var refreshRow = document.getElementById('calendar-refreshInterval-row');
  refreshRow.removeAttribute('hidden');
  var uriRow = document.getElementById('calendar-uri-row');
  uriRow.removeAttribute('hidden');
  var emailIdentityRow = document.getElementById('calendar-email-identity-row');
  emailIdentityRow.removeAttribute('hidden');
  var readOnlyRow = document.getElementById('calendar-readOnly-row');
  readOnlyRow.removeAttribute('hidden');
  var cacheRow = document.getElementById('calendar-cache-row');
  cacheRow.removeAttribute('hidden');
  var alarmsRow = document.getElementById('calendar-suppressAlarms-row');
  if (alarmsRow.childNodes[0].hidden) {
    /* Spacer before checkbox. */
    alarmsRow.childNodes[0].remoteAttribute('hidden');
  }
};

/**
 * Takes content of "General Information" tab moves it back to dialog
 * and removes whole tab layout.
 */
cal3eProperties.destroyTabs = function destroyTabs() {
  var tabGeneral = document.getElementById('calendar3e-tabpanel-general');
  if (!tabGeneral) {
    return;
  }

  var tabbox = tabGeneral.parentNode.parentNode;
  var mainVBox = tabbox.parentNode;

  var childNodes = tabGeneral.childNodes
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
  var tabbedGeneral = document.getElementById('calendar3e-tabpanel-general');

  var child = document.getElementById('calendar-properties-grid');
  tabbedGeneral.appendChild(child.cloneNode(true));
  child.parentNode.removeChild(child);

  document.getElementById('calendar-name').defaultValue =
    cal3eProperties._calendar.name;
}

cal3eProperties.tweakUI = function tweakUI() {
  document.getElementById('calendar-refreshInterval-row').hidden = true;
  var alarmsRow = document.getElementById('calendar-suppressAlarms-row');
  alarmsRow.childNodes[0].hidden = true; /* Spacer before checkbox */

  cal3eProperties.moveGeneralToTab();
}

/**
 * Displays additional controls for 3e calendars in properties dialog.
 *
 * Otherwise ensures that those controls are hidden.
 */
cal3eProperties.init = function init() {
  var calendar = window.arguments[0].calendar;
  cal3eProperties._calendar = calendar;


  if (calendar.type == 'eee') {
    cal3eProperties.tweakUI();
    var permissions = new cal3ePermissionsTreeController(calendar);
  } else {
    cal3eProperties.hide3eControls();
  }

  window.sizeToContent();
};

window.addEventListener('load', cal3eProperties.init, false);
