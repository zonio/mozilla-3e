/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2012 - 2013  Zonio s.r.o.
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
Components.utils.import("resource://calendar3e/modules/filter.jsm");
Components.utils.import("resource://calendar3e/modules/utils.jsm");
Components.utils.import("resource://calendar3e/modules/model.jsm");
Components.utils.import("resource://calendar3e/modules/xul.jsm");

function cal3ePermissions(calendar, sharingController, filterController) {
  var controller = this;
  var filteredList;
  var identity;
  var filter;
  var tree;
  var list;

  function addPermissionForSelection(perm) {
    var selection = getSelection();
    for (var i = 0; i < selection.length; i++) {
      selection[i]['perm'] = perm;
      sharingController.removeFromPermissionsList(
        sharingController.updatedPermissions, selection[i]);
      sharingController.updatedPermissions.push(selection[i]);
    }

    sharingController.updateTree();
    window.close();
  }

  function listUsersAndGroups() {
    isLoaded = false;
    fillTree();
    loadUsers();
  }

  function loadUsers() {
    var query = "NOT match_username('" + cal3eModel.calendarOwner(calendar) + "')";

    sharingController.list.forEach(function(entity) {
      if (entity.type === 'user' && entity.perm !== 'none') {
        query += " AND NOT match_username('" + entity.username + "')";
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
        type: 'user',
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
      if (entity.type === 'group' && entity.perm !== 'none') {
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

    filteredList = list = list.concat(groups);
    isLoaded = true;
    fillTree();
  }

  function fillTree() {
    if (!isLoaded) {
      fillTreeLoading();
    } else if (list.length === 0) {
      fillTreeNoEntities();
    } else if (getFilteredList().length === 0) {
      fillTreeNoMatch();
    } else {
      fillTreeLoaded();
    }
  }

  function fillTreeLoading() {
    cal3eXul.clearTree(tree);
    cal3eXul.addItemsToTree(tree, [
      { label: document.getElementById('calendar3e-strings').getString(
        'calendar3e.permissions.loading') }
    ]);
  }

  function fillTreeNoMatch() {
    cal3eXul.clearTree(tree);
    cal3eXul.addItemsToTree(tree, [
      { label: document.getElementById('calendar3e-strings').getString(
        'calendar3e.permissions.noMatch') }
    ]);
  }

  function fillTreeNoEntities() {
    cal3eXul.clearTree(tree);
    cal3eXul.addItemsToTree(tree, [
      { label: document.getElementById('calendar3e-strings').getString(
        'calendar3e.permissions.empty') }
    ]);
  }

  function fillTreeLoaded() {
    cal3eUtils.naturalSort.insensitive = true;
    list.sort(cal3eUtils.naturalSort);

    filteredList = getFilteredList();

    cal3eXul.clearTree(tree);
    filteredList.forEach(function(entity) {
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
        selection.push(filteredList[j]);
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
      document.getElementById('calendar3e-strings').getString(
        'calendar3e.permissions.error'),
      0,
      null,
      document.getElementById('notifications').PRIORITY_WARNING_MEDIUM,
      null
    );
  }

  function normalizeString(string) {
    return ('' + string).toLowerCase().replace(/s+/, ' ');
  }

  function matchesFilter(string) {
    return normalizeString(string).indexOf(normalizeString(filter)) >= 0;
  }

  function getFilteredList() {
    return list.filter(function(entity) {
      return matchesFilter(entity['label']);
    });
  }

  function filterDidChange() {
    filter = filterController.filter();
    fillTree();
  }

  function init() {
    filterController.addObserver(filterDidChange);
    tree = document.getElementById('calendar3e-permissions-tree');
    findAndSetIdentity();
    filter = '';
  }

  controller.listUsersAndGroups = listUsersAndGroups;
  controller.addPermissionForSelection = addPermissionForSelection;

  init();
}

cal3ePermissions.onLoad = function cal3ePermissions_onLoad() {
  var calendar = window.arguments[0];
  var sharingController = window.arguments[1];
  cal3ePermissions.controller = new cal3ePermissions(
    calendar,
    sharingController,
    new cal3eFilterController(window));
  cal3ePermissions.controller.listUsersAndGroups();
}

cal3ePermissions.add = function cal3ePermissions_add(perm) {
  cal3ePermissions.controller.addPermissionForSelection(perm);
}
