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
Components.utils.import('resource://calendar3e/modules/feature.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/model.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function cal3eEventSummary(calendar) {
  var eventSummaryDialog = this;
  const nsIFilePicker = Components.interfaces.nsIFilePicker;

  function createMenuItemOpen() {
    var menuItem = document.createElement('menuitem');
    menuItem.setAttribute('label', 'Open...');
    menuItem.setAttribute('onclick', 'cal3e_saveFile(false);');

    return menuItem;
  }

  function createMenuItemSave() {
    var menuItem = document.createElement('menuitem');
    menuItem.setAttribute('label', 'Save...');
    menuItem.setAttribute('onclick', 'cal3e_saveFile(true);');

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

  function saveFile(doSave, logger) {
    var eeeUri = document.getElementById('item-attachments-listbox')
      .selectedItem.value;

    if (eeeUri.indexOf('eee://') !== 0) {
      openAttachment();
      return;
    }

    var splittedUri = eeeUri.split('/');
    var filename = decodeURIComponent(splittedUri[splittedUri.length - 1]);
    var file;

    if (doSave) {
      file = saveAttachmentDialog(filename);
      if (!file) {
        return;
      }
    } else {
      file = Components.classes['@mozilla.org/file/directory_service;1']
        .getService(Components.interfaces.nsIProperties)
        .get('TmpD', Components.interfaces.nsIFile);
      file.append(filename);
    }

    var listener = function(httpStatusCode, response) {
      dump('Attachment ' + eeeUri + ' downloaded.\n');
      if (httpStatusCode != '200') {
        dump('Error\n');
        return;
      }

      var stream = Components.classes[
        '@mozilla.org/network/safe-file-output-stream;1'
      ].createInstance(Components.interfaces.nsIFileOutputStream);

      stream.init(file, 0x02 | 0x08 | 0x20, 384, 0); // readwrite, create, truncate

      var maxArgs = 65535;
      var processed = 0;
      while (processed < response.length) {
        var responseSlice = Array.prototype.slice.call(
          response, processed, processed + maxArgs);
        var dataSlice = String.fromCharCode.apply(String, responseSlice);
        stream.write(dataSlice, dataSlice.length);
        processed += maxArgs;
      }

      if (stream instanceof Components.interfaces.nsISafeOutputStream) {
        stream.finish();
      } else {
        stream.close();
      }

      if (!doSave) {
        openFile(file);
      }
    }

    cal3eRequest.Client.getInstance()
      .downloadAttachment(findIdentity(), listener, eeeUri);
  }

  function openFile(file) {
    try {
      file.launch();
    } catch (error) {
      dump('Cannot open file. ' + error.message + '\n');
    }
  }

  function saveAttachmentDialog(defaultFilename) {
    var fp = Components.classes['@mozilla.org/filepicker;1']
      .createInstance(nsIFilePicker);
    fp.init(window, 'Save As…', nsIFilePicker.modeSave);
    fp.defaultString = defaultFilename;

    var result = fp.show();
    if (result == nsIFilePicker.returnCancel) {
      return false;
    }

    return fp.file;
  }

  function findIdentity() {
    var identities = cal3eIdentity.Collection()
      .getEnabled()
      .findByEmail(cal3eModel.calendarUser(calendar));

    return identities.length > 0 ? identities[0] : null;
  }

  eventSummaryDialog.showAttachments = showAttachments;
  eventSummaryDialog.saveFile = saveFile;
}

var cal3e_saveFile;

cal3eEventSummary.onLoad = function cal3eSubscription_onLoad() {
  var args = window.arguments[0];
  var event = args.calendarEvent.clone();
  var controller = new cal3eEventSummary(window.arguments[0].calendar);
  cal3e_saveFile = controller.saveFile;

  var attachments = event.getAttachments({});

  if (attachments.length > 0) {
    controller.showAttachments(attachments);
  }
}

window.addEventListener('load', cal3eEventSummary.onLoad, false);
