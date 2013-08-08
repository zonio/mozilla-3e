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

Components.utils.import("resource://calendar3e/modules/response.jsm");
Components.utils.import("resource://calendar3e/modules/identity.jsm");
Components.utils.import("resource://calendar3e/modules/request.jsm");
Components.utils.import("resource://calendar3e/modules/model.jsm");
Components.utils.import("resource://calendar3e/modules/xul.jsm");

function cal3ePermissions(calendar) {
  var controller = this;
  var identity;
  var element;
  var list;

  function listUsersAndGroups() {
    loadUsers();
  }

  function didError() {
    document.getElementById('notifications').appendNotification(
      'Could not get list of users and groups.',
      0,
      null,
      document.getElementById('notifications').PRIORITY_WARNING_MEDIUM,
      null
    );
  }

  function loadUsers() {
    cal3eRequest.Client.getInstance()
      .getUsers(identity, usersDidLoad, '');
  }

  function usersDidLoad(result) {
    if (!(result instanceof cal3eResponse.Success)) {
      didError();
      return;
    }

    var users = result.data;
    users.forEach(function(user) {
      user['type'] = 'user';
      user['label'] = cal3eModel.userLabel(user);
      user.toString = function() {
        return user.label;
      }
    });

    list = users;
    list.push({
      username: '*',
      type: 'group',
      label: 'All users',
      toString: function() {
        return this.label;
      }
    })
    loadGroups();
  }

  function loadGroups() {
    cal3eRequest.Client.getInstance()
      .getGroups(identity, groupsDidLoad, '');
  }

  function groupsDidLoad(result) {
    if (!(result instanceof cal3eResponse.Success)) {
      didError();
      return;
    }

    var groups = result.data;
    groups.forEach(function(group) {
      group['type'] = 'group';
      group['label'] = group.title || 'Unknown Group (' + group.groupname + ')';
      group.toString = function() {
        return group.label;
      }
    });

    list = list.concat(groups);
    fillElement();
  }

  function fillElement() {
    list.sort();
    list.forEach(function(entity) {
      cal3eXul.addItemsToTree(element, [
        { label: entity.label,
          properties: entity.type === 'user'
            ? "calendar3e-treecell-icon-user"
            : "calendar3e-treecell-icon-group"},
      ]);
    });
  }

  function findAndSetIdentity() {
    var identities = cal3eIdentity.Collection()
      .getEnabled()
      .findByEmail(cal3eModel.calendarOwner(calendar));
    
    identity = identities.length > 0 ? identities[0] : null;
  }

  function init() {
    element = document.getElementById('calendar3e-permissions-tree');
    findAndSetIdentity();
  }

  controller.listUsersAndGroups = listUsersAndGroups;

  init();
};

cal3ePermissions.open = function cal3ePermissions_open() {
  var calendar = window.arguments[0].calendar;
  openDialog(
    'chrome://calendar3e/content/permissions.xul',
    'cal3ePermissions',
    'chrome,titlebar,modal,resizable',
    calendar
  );
};

cal3ePermissions.onLoad = function cal3ePermissions_onLoad() {
  dump('[3e] cal3ePermissions.onLoad called.\n');
  var calendar = window.arguments[0];
  var controller = new cal3ePermissions(calendar);
  controller.listUsersAndGroups();
};

cal3ePermissions.addRead = function cal3ePermissions_addRead() {
  dump('[3e] cal3ePermissions.addRead() called\n');
};

cal3ePermissions.addReadWrite = function cal3ePermissions_addReadWrite() {
  dump('[3e] cal3ePermissions.addReadWrite() called\n');
};
