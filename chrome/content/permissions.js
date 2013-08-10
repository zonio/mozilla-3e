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

function cal3ePermissions(calendar, sharingController) {
  var controller = this;
  var identity;
  var tree;
  var list;

  function addPermissionForSelection(perm) {
    var selection = getSelection();
    for (var i = 0; i < selection.length; i++) {
      selection[i]['perm'] = perm;
      sharingController.updatedPermissions.push(selection[i]);
    }

    sharingController.updateTree();
    window.close();
  }

  function listUsersAndGroups() {
    loadUsers();
  }

  function loadUsers() {
    var query = '';
    sharingController.list.forEach(function(entity) {
      if (entity.type === 'user') {
        if (query !== '') {
          query += ' AND ';
        }
        query += " NOT match_username('" + entity.username + "')";
      }
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
    users.forEach(function(user) {
      user['type'] = 'user';
      user['label'] = cal3eModel.userLabel(user);
      user.toString = function() {
        return cal3eModel.attribute(user, 'realname') || user.username;
      }
    });

    list = users;
    if (!allUsersAreinList()) {
      list.push({
        username: '*',
        type: 'group',
        label: 'All users',
        toString: function() {
          return this.label;
        }
      })
    }
    loadGroups();
  }

  function loadGroups() {
    var query = '';
    sharingController.list.forEach(function(entity) {
      if (entity.type === 'group') {
        if (query !== '') {
          query += ' AND ';
        }
        query += " NOT match_groupname('" + entity.groupname + "')";
      }
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
      cal3eXul.addItemsToTree(tree, [
        { label: entity.label,
          properties: entity.type === 'user'
            ? "calendar3e-treecell-icon-user"
            : "calendar3e-treecell-icon-group"},
      ]);
    });
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
      .findByEmail(cal3eModel.calendarOwner(calendar));
    
    identity = identities.length > 0 ? identities[0] : null;
  }

  function allUsersAreinList() {
    var list = sharingController.list;
    for (var i = 0; i < list.length; i++) {
      if (list[i].label === 'All users') {
        return true;
      }
    }
    return false;
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

  function init() {
    tree = document.getElementById('calendar3e-permissions-tree');
    findAndSetIdentity();
  }

  controller.listUsersAndGroups = listUsersAndGroups;
  controller.addPermissionForSelection = addPermissionForSelection;

  init();
};

cal3ePermissions.onLoad = function cal3ePermissions_onLoad() {
  var calendar = window.arguments[0];
  var sharingController = window.arguments[1];
  cal3ePermissions.controller = new cal3ePermissions(calendar,
    sharingController);
  cal3ePermissions.controller.listUsersAndGroups();
};

cal3ePermissions.add = function cal3ePermissions_add(perm) {
  cal3ePermissions.controller.addPermissionForSelection(perm);
};
