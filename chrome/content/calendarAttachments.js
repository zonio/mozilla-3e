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

 
function cal3eSelectAttach() {
  var calendar;
  var ltn_updateCapabilites;
  var bundleString;

  function activate3e() {
    var attachButton = document.getElementById('button-url');
      attachButton.command = 'cal3e_cmd_attach_file';
      attachButton.label = bundleString
        .getString('cal3eCalendarAttachements.attach.label');

    var menuItemIndex = document.getElementById('options-menu')
      .getIndexOfItem(document.getElementById('options-attachments-menuitem'));
    var menuItem = document.getElementById('options-menu')
      .insertItemAt(
        menuItemIndex + 1,
        bundleString.getString('cal3eCalendarAttachements.attach.label'),
        null
      );
    // XXX This doesn't work: "menuItem.command = 'cal3e_cmd_attach_file';"
    // that's why setAttribute is used.
    menuItem.setAttribute('command', 'cal3e_cmd_attach_file');

    menuItem = document.createElementNS(
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      'menuitem'
    );
    menuItem.setAttribute('label', bundleString.getString('cal3eCalendarAttachements.attach.label'));
    menuItem.setAttribute('command', 'cal3e_cmd_attach_file');
    menuItem.setAttribute(
      'accesskey',
      bundleString.getString('cal3eCalendarAttachements.attach.accesskey')
    );
    var attachPage = document.getElementById('attachment-popup-attachPage');
    attachPage.parentNode.insertBefore(menuItem, attachPage.nextSibling);

    menuItem = document.createElementNS(
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      'menuitem'
    );
    menuItem.setAttribute('label', bundleString.getString('cal3eCalendarAttachements.saveas.label'));
    menuItem.setAttribute('command', 'cal3e_cmd_save_as');
    menuItem.setAttribute(
      'accesskey',
      bundleString.getString('cal3eCalendarAttachements.saveas.accesskey')
    );
    var attachPage = document.getElementById('attachment-popup-open');
    attachPage.parentNode.insertBefore(menuItem, attachPage.nextSibling);

    var attachListBox = document.getElementById('attachment-link');
    attachListBox.addEventListener('select', onAttachSelect, false);
  }

  function deactivate3e() {
    
  }

  function onAttachSelect(event) {
    if (event.currentTarget.selectedItems.length !== 0 &&
        event.currentTarget.getSelectedItem(0).attachment.uri.schemeIs('eee')) {
      document.getElementById('cal3e-attachments-save-as')
        .setAttribute('disabled', 'false');
    } else {
      document.getElementById('cal3e-attachments-save-as')
        .setAttribute('disabled', 'true');
    }
  }

  function cal3e_updateCapabilities() {
    calendar = getCurrentCalendar();
    if (calendar.type == 'eee') {
      activate3e();
    } else {
      deactivate3e();
    }
  }

  function init() {
    bundleString = document.getElementById('calendar3e-strings');
    ltn_updateCapabilites = updateCapabilities;
    updateCapabilities = cal3e_updateCapabilities;
    updateCapabilities();
  }

  init();
};

cal3eSelectAttach.onLoad = function cal3eSelectAttach_onLoad() {
  new cal3eSelectAttach();
};

window.addEventListener('load', cal3eSelectAttach.onLoad, false);
