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

Components.utils.import('resource://calendar3e/modules/model.jsm');

function cal3eContextMenu() {
  var controller = this;
  var treeElement;
  var contextMenuItem;
  var sunbirdMenuItem;
  var lightningMenuItem;
  var stringBundle;

  function selectedCalendarDidChange() {
    var selectedCalendar = getCompositeCalendar().defaultCalendar;
    if (selectedCalendar && (selectedCalendar.type === 'eee') &&
        cal3eModel.isSubscribedCalendar(selectedCalendar)) {
      setMenuLabels('subscribedOnly');
    } else {
      setMenuLabels('ownedOnly');
    }
  }

  function setMenuLabels(type) {
    contextMenuItem.label = stringBundle.getString(
      'cal3eCalendarMenu.context.delete.' + type + '.label'
    );
    sunbirdMenuItem.label = stringBundle.getString(
      'cal3eCalendarMenu.app.delete.' + type + '.label'
    );
    lightningMenuItem.label = stringBundle.getString(
      'cal3eCalendarMenu.app.delete.' + type + '.label'
    );
  }

  function init() {
    window.addEventListener('unload', finalize, false);

    stringBundle = document.getElementById('calendar3e-strings');

    contextMenuItem = document.getElementById(
      'list-calendars-context-delete'
    );
    sunbirdMenuItem = document.getElementById(
      'ltnDeleteSelectedCalendar'
    );
    lightningMenuItem = document.getElementById(
      'appmenu_ltnDeleteSelectedCalendar'
    );

    treeElement = document.getElementById('calendar-list-tree-widget');
    treeElement.addEventListener('select', selectedCalendarDidChange, false);
    selectedCalendarDidChange();
  }

  function finalize() {
    contextMenuItem = null;
    sunbirdMenuItem = null;
    lightningMenuItem = null;

    treeElement.removeEventListener(
      'select', selectedCalendarDidChange, false
    );
    treeElement = null;

    stringBundle = null;

    window.removeEventListener('unload', finalize, false);
  }

  init();
}

cal3eContextMenu.onLoad = function cal3eSubscription_onLoad() {
  cal3eContextMenu.controller = new cal3eContextMenu();
  window.addEventListener('unload', cal3eSubscription.onUnload, false);
}
cal3eContextMenu.onUnload = function cal3eContextMenu_onUnload() {
  window.removeEventListener('unload', cal3eContextMenu.onUnload, false);
  delete cal3eContextMenu.controller;
};

window.addEventListener('load', cal3eContextMenu.onLoad, false);
