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

  if (cal3eProperties._init) {
    window.sizeToContent();
  }
};

/**
 * Takes content of "General Information" tab moves it back to dialog
 * and removes whole tab layout.
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
