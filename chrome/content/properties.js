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
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import("resource://calendar3e/modules/identity.jsm");
Components.utils.import("resource://calendar3e/modules/feature.jsm");
Components.utils.import("resource://calendar3e/modules/model.jsm");
Components.utils.import("resource://calendar3e/modules/request.jsm");
Components.utils.import("resource://calendar3e/modules/response.jsm");
Components.utils.import("resource://calendar3e/modules/utils.jsm");
Components.utils.import("resource://calendar3e/modules/xul.jsm");

function cal3ePropertiesSetPermissionsDelegate() {
  var setPermissionsDelegate = this;

  function setPermissions(identity, calendar, permissions, callback) {
    var errors = [];
    var processed = 0;

    function onNext(error) {
      processed += 1;
      if (error) {
        errors.push(error);
      }

      if (permissions.length === processed) {
        callback(errors);
      }
    }

    permissions.forEach(function(permission) {
      setPermission(identity, calendar, permission, onNext);
    });
  }

  function setPermission(identity, calendar, entity, onNext) {
    function didSetPermission(result) {
      if (!(result instanceof cal3eResponse.Success)) {
        onNext(result);
        return;
      }
      onNext();
    }

    if (entity['type'] === 'user') {
      cal3eRequest.Client.getInstance().setUserPermission(
        identity,
        didSetPermission,
        calendar,
        entity['username'],
        entity['perm']
      );
    } else {
      cal3eRequest.Client.getInstance().setGroupPermission(
        identity,
        didSetPermission,
        calendar,
        entity['groupname'],
        entity['perm']
      );
    }
  }

  setPermissionsDelegate.setPermissions = setPermissions;
}

function cal3ePropertiesSharing(calendar, setPermissionsDelegate) {
  var controller = this;
  var updatedPermissions = [];
  var groupPermissions;
  var userPermissions;
  var listWithoutNonePermissions;
  var isLoaded;
  var identity;
  var tree;

  function savePermissions() {
    checkWritePermChanges();
    setPermissionsDelegate.setPermissions(
      identity, calendar, updatedPermissions, didSavePermissions);
  }

  function didSavePermissions(errors) {
    if (errors.length > 0) {
      didSaveError(errors);
    }
  }

  function didSaveError(errors) {
    document.getElementById('notifications').appendNotification(
      document.getElementById('calendar3e-strings').getString(
        'calendar3e.properties.errors.permission'),
      0,
      null,
      document.getElementById('notifications').PRIORITY_WARNING_MEDIUM,
      null
    );
  }

  function didLoadError() {
    document.getElementById('notifications').appendNotification(
      document.getElementById('calendar3e-strings').getString(
        'calendar3e.properties.errors.data'),
      0,
      null,
      document.getElementById('notifications').PRIORITY_WARNING_MEDIUM,
      null
    );
  }

  function updateTree() {
    fillTree();
  }

  function removeSelection() {
    var selection = getSelection();
    for (var i = 0; i < selection.length; i++) {
      setPermissionNone(selection[i]);
    }

    fillTree();
  }

  function checkWritePermChanges() {
    if ((tree.view.rowCount == 1) && !tree.view.getItemAtIndex(0)
                                      .firstChild.lastChild
                                      .getAttribute('value')) {
      return;
    }

    for (var i = 0; i < tree.view.rowCount; i++) {
      var treeitem = tree.view.getItemAtIndex(i);
      if ((treeitem.firstChild.lastChild.getAttribute('value') == 'true') !==
          (listWithoutNonePermissions[i].perm === 'write')) {
        listWithoutNonePermissions[i].perm =
          treeitem.firstChild.lastChild.getAttribute('value') == 'true'
          ? 'write' : 'read';
        updatedPermissions.push(listWithoutNonePermissions[i]);
      }
    }
  }

  function loadPermissions() {
    fillTree();
    loadUserPermissions();
  }

  function loadUserPermissions() {
    userPermissions = null;

    cal3eRequest.Client.getInstance()
      .getUserPermissions(identity, userPermissionsDidLoad, calendar);
  }

  function userPermissionsDidLoad(result) {
    if (!(result instanceof cal3eResponse.Success)) {
      didLoadError();
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
      didLoadError();
      return;
    }

    var users = result.data;
    userPermissions.forEach(function(userPermission) {
      userPermission['username'] = userPermission['user']
      userPermission['type'] = 'user';
      if (userPermission['user'] == '*') {
        var bundle = Services.strings.createBundle(
          'chrome://calendar3e/locale/calendar3e.properties'
        );
        userPermission['label'] = bundle.GetStringFromName(
          'calendar3e.properties.sharing.allUsers');
      } else {
        userPermission['realname'] =
          cal3eModel.attribute(findUser(userPermission.user, users), 'realname');
        userPermission['label'] = userPermission['realname']
          ? userPermission['realname'] + ' <' + userPermission.user + '>'
          : userPermission.user;
      }
      userPermission.toString = function() {
        return userPermission.realname || userPermission.label;
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
      didLoadError();
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
      didLoadError();
      return;
    }

    var groups = result.data;
    groupPermissions.forEach(function(groupPermission) {
      groupPermission['groupname'] = groupPermission['group'];
      groupPermission['type'] = 'group';
      groupPermission['label'] =
        findGroup(groupPermission.group, groups)['title'] ||
        'Unknown Group (' + groupPermission.group + ')';
      groupPermission.toString = function() {
        return groupPermission['label'];
      }
    });

    isLoaded = true;
    fillTree();
  }

  function fillTree() {
    if (!isLoaded) {
      fillTreeLoading();
    } else if (userPermissions.length === 0 &&
               groupPermissions.length === 0 &&
               updatedPermissions.length === 0) {
      fillTreeNoEntities();
    } else {
      fillTreeLoaded();
    }
  }

  function fillTreeLoading() {
    cal3eXul.clearTree(tree);
    cal3eXul.addItemsToTree(tree, [
      { label: document.getElementById('calendar3e-strings').getString(
        'calendar3e.properties.sharing.loading') },
      { properties: 'disabled' },
      { properties: 'disabled' }
    ]);
    tree.addEventListener('select', deselect);
  }

  function fillTreeNoEntities() {
    cal3eXul.clearTree(tree);
    cal3eXul.addItemsToTree(tree, [
      { label: document.getElementById('calendar3e-strings').getString(
        'calendar3e.properties.sharing.empty') },
      { properties: 'disabled' },
      { properties: 'disabled' }
    ]);
    tree.addEventListener('select', deselect);
  }

  function fillTreeLoaded() {
    tree.removeEventListener('select', deselect);
    controller.list = userPermissions.concat(groupPermissions, updatedPermissions);
    cal3eUtils.naturalSort.insensitive = true;
    controller.list.sort(cal3eUtils.naturalSort);

    listWithoutNonePermissions = controller.list.filter(function(entity) {
      return entity['perm'] !== 'none';
    });

    cal3eXul.clearTree(tree);
    listWithoutNonePermissions.forEach(function(entity) {
      cal3eXul.addItemsToTree(tree, [
        { label: entity.label,
          properties: entity.type === 'user'
            ? 'calendar3e-treecell-icon-user'
            : 'calendar3e-treecell-icon-group' },
        { value: true },
        { value: entity.perm === 'write' }
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
        selection.push(listWithoutNonePermissions[j]);
      }
    }
    return selection;
  }

  function setPermissionNone(entity) {
    var list = entity['type'] === 'user' ? userPermissions : groupPermissions;
    removeFromPermissionsList(list, entity);
    removeFromPermissionsList(updatedPermissions, entity);
    entity['perm'] = 'none';
    updatedPermissions.push(entity);
  }

  function removeFromPermissionsList(list, entity) {
    for (var i = 0; i < list.length; i++) {
      if (entity.label === list[i].label) {
        list.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  function findUser(username, users) {
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === username) {
        return users[i];
      }
    }
    return null;
  }

  function deselect() {
    tree.view.selection.toggleSelect(0);
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
    isLoaded = false;
    controller.list = [];
    tree = document.getElementById('calendar3e-sharing-tree');
    findAndSetIdentity();
    loadPermissions();
  }

  init();

  controller.updateTree = updateTree;
  controller.removeSelection = removeSelection;
  controller.savePermissions = savePermissions;
  controller.updatedPermissions = updatedPermissions;
  controller.removeFromPermissionsList = removeFromPermissionsList
}

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
}

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
  document.getElementById('calendar-properties-dialog-2')
    .setAttribute('ondialogaccept', 'return cal3eProperties.onAccept();');
  document.getElementById('calendar-refreshInterval-row').hidden = true;
  document.getElementById('calendar-cache-row').hidden = true;
  var alarmsRow = document.getElementById('calendar-suppressAlarms-row');
  alarmsRow.childNodes[0].hidden = true; /* Spacer before checkbox */

  cal3eProperties.moveGeneralToTab();
}

cal3eProperties.openPermissions = function cal3eProperties_openPermissions() {
  openDialog(
    'chrome://calendar3e/content/permissions.xul',
    'cal3ePermissions',
    'chrome,titlebar,modal,resizable',
    cal3eProperties._calendar, cal3eProperties.sharing
  );
}

cal3eProperties.removePermissions = function cal3eProperties_removePermissions() {
  cal3eProperties.sharing.removeSelection();
}

cal3eProperties.onAccept = function cal3eProperties_onAccept() {
  cal3eProperties.sharing.savePermissions();
  return onAcceptDialog();
}

cal3eProperties.disableSharingTab = function cal3eProperties_disableSharingTab() {
  document.getElementById('calendar3e-label-sharing')
    .setAttribute('value', document.getElementById('calendar3e-strings')
      .getString('calendar3e.properties.sharing.notOwner'));
  document.getElementById('calendar3e-sharing-tree')
    .setAttribute('disabled', 'true');
  document.getElementById('calendar3e-properties-add-permission')
    .setAttribute('disabled', 'true');
  document.getElementById('calendar3e-properties-remove-permission')
    .setAttribute('disabled', 'true');
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
    if (cal3eModel.isOwnedCalendar(calendar)) {
      cal3eProperties.sharing = new cal3ePropertiesSharing(
        calendar,
        new cal3ePropertiesSetPermissionsDelegate()
      );
    } else {
      cal3eProperties.disableSharingTab();
    }
  } else {
    cal3eProperties.hide3eControls();
  }

  window.sizeToContent();
};

window.addEventListener('load', cal3eProperties.init, false);
