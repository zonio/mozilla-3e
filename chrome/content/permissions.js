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
Components.utils.import("resource://calendar3e/modules/utils.jsm");
Components.utils.import("resource://calendar3e/modules/model.jsm");
Components.utils.import("resource://calendar3e/modules/xul.jsm");

function cal3ePermissions() {
  var controller = this;
  var identity;
  var tree;
  var list;

  function listUsersAndGroups() {
    loadUsers();
  }

  function addPermissionForSelection(perm) {
    dump('[3e] addPermissionForSelection called\n');
    var selection = getSelection();
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
        return cal3eModel.attribute(user, 'realname') || user.username;
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
    fillTree();
  }

  function fillTree() {
    cal3eUtils.naturalSort.insensitive = true;
    list.sort(cal3eUtils.naturalSort);

    list.forEach(function(entity) {
      if (!findEntity(entity, cal3ePermissions._oldList)) {
        cal3eXul.addItemsToTree(tree, [
          { label: entity.label,
            properties: entity.type === 'user'
              ? "calendar3e-treecell-icon-user"
              : "calendar3e-treecell-icon-group"},
        ]);
      }
    });
  }

  function findEntity(entity, entities) {
    for (var i = 0; i < entities.length; i++) {
      if (entities[i].label === entity.label) {
        return true;
      }
    };
    return false;
  }

  function getSelection() {
    var start = {}, end = {};
        numRanges = tree.view.selection.getRangeCount(),
        selection = [];
    
    for (var i = 0; i < numRanges; i++) {
      tree.view.selection.getRangeAt(i, start, end);
      for (var j = start.value; j <= end.value; j++) {
        selection.push(list[j]);
      }
    }
    return selection;
  }

  function findAndSetIdentity() {
    var identities = cal3eIdentity.Collection()
      .getEnabled()
      .findByEmail(cal3eModel.calendarOwner(cal3ePermissions._calendar));
    
    identity = identities.length > 0 ? identities[0] : null;
  }

  function init() {
    tree = document.getElementById('calendar3e-permissions-tree');
    findAndSetIdentity();
  }

  controller.listUsersAndGroups = listUsersAndGroups;
  controller.addPermissionForSelection = addPermissionForSelection;

  init();
};

cal3ePermissions.onLoad = function cal3ePermissions_onLoad() {
  dump('[3e] cal3ePermissions.onLoad called.\n');
  cal3ePermissions._calendar = window.arguments[0];
  cal3ePermissions._oldList = window.arguments[1];
  cal3ePermissions.controller = new cal3ePermissions();
  cal3ePermissions.controller.listUsersAndGroups();
};

cal3ePermissions.addRead = function cal3ePermissions_addRead() {
  dump('[3e] cal3ePermissions.addRead() called\n');
  dump('[3e] controller: ' + cal3ePermissions.controller + '\n');
  cal3ePermissions.controller.addPermissionForSelection('read');
};

cal3ePermissions.addReadWrite = function cal3ePermissions_addReadWrite() {
  dump('[3e] cal3ePermissions.addReadWrite() called\n');
};
