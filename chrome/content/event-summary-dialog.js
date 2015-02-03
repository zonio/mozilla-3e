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

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://calendar3e/modules/attachment.jsm');

function cal3eEventSummary(window, calendar) {
  var eventSummaryDialog = this;
  const nsIFilePicker = Components.interfaces.nsIFilePicker;

  function createMenuItemOpen() {
    var menuItem = document.createElement('menuitem');
    menuItem.setAttribute('label', 'Open...');
    menuItem.setAttribute('onclick', 'cal3e_openFile();');

    return menuItem;
  }

  function createMenuItemSave() {
    var menuItem = document.createElement('menuitem');
    menuItem.setAttribute('label', 'Save...');
    menuItem.setAttribute('onclick', 'cal3e_saveFile();');

    return menuItem;
  }

  function createPopupMenu() {
    var popupMenu = document.createElement('menupopup');
    popupMenu.setAttribute('id', 'event-summary-attachment-popup');
    popupMenu.appendChild(createMenuItemOpen());
    popupMenu.appendChild(createMenuItemSave());

    return popupMenu;
  }

  function createListBox(attachments) {
    var listBox = document.createElement('listbox');
    listBox.setAttribute('id', 'item-attachments-listbox');
    listBox.setAttribute('flex', '1');
    listBox.setAttribute('rows', '3');
    listBox.setAttribute('context', 'event-summary-attachment-popup');

    attachments.forEach(function(attachment) {
      var listItem = document.createElement('listitem');
      listItem.value = attachment.uri.spec;

      var splittedUri = attachment.uri.spec.split('/');
      listItem.setAttribute('label',
        decodeURIComponent(splittedUri[splittedUri.length - 1]));

      listBox.appendChild(listItem);
    });

    return listBox;
  }

  function createAttachmentsInnerBox(attachments) {
    var innerBox = document.createElement('box');
    innerBox.setAttribute('orient', 'horizontal');
    innerBox.appendChild(createSpacer());
    innerBox.appendChild(createListBox(attachments));

    return innerBox;
  }

  function createCalendarCaption(label) {
    var calendarCaption = document.createElement('calendar-caption');
    calendarCaption.setAttribute('label', label);
    calendarCaption.setAttribute('align', 'center');

    return calendarCaption;
  }

  function createSpacer() {
    var spacer = document.createElement('spacer');
    spacer.setAttribute('class', 'default-spacer');

    return spacer;
  }

  function createAttachmentsBox(attachments) {
    var box = document.createElement('box');
    box.setAttribute('id', 'item-attachments');
    box.setAttribute('orient', 'vertical');

    box.appendChild(createSpacer());
    box.appendChild(createCalendarCaption('Attachments'));
    box.appendChild(createAttachmentsInnerBox(attachments));

    return box;
  }

  function showAttachments(attachments) {
    var dialog = document.getElementById('calendar-event-summary-dialog');

    dialog.appendChild(createPopupMenu());
    dialog.appendChild(createAttachmentsBox(attachments));
  }

  eventSummaryDialog.showAttachments = showAttachments;
}

function cal3e_saveFile() {
  var eeeUri = document.getElementById('item-attachments-listbox')
    .selectedItem.value;

  cal3eAttachment.save(eeeUri, window, window.arguments[0].calendar);
}

function cal3e_openFile() {
  var eeeUri = document.getElementById('item-attachments-listbox')
    .selectedItem.value;

  cal3eAttachment.open(eeeUri, window, window.arguments[0].calendar);
}

cal3eEventSummary.onLoad = function cal3eSubscription_onLoad() {
  var args = window.arguments[0];
  var event = args.calendarEvent.clone();
  var controller = new cal3eEventSummary(window, window.arguments[0].calendar);

  var attachments = event.getAttachments({});

  if (attachments.length > 0) {
    controller.showAttachments(attachments);
  }
}

window.addEventListener('load', cal3eEventSummary.onLoad, false);
