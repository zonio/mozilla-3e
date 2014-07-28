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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import('resource://calendar3e/modules/feature.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/model.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function cal3eSelectAttach(calendar) {
  var controller = this;

  function updateUI() {
    document.getElementById('button-url').command = 'cal3e_cmd_attach_file';
    document.getElementById('attachment-popup-attachPage').hidden = true;
    document.getElementById('attachment-popup')
      .getElementsByTagName('menuseparator')[0].hidden = true;
    document.getElementById('attachment-link')
      .addEventListener('click', cal3eSelectAttach.onRightClick);
  }

  function addAttachmentDialog() {
    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Components.classes["@mozilla.org/filepicker;1"]
      .createInstance(nsIFilePicker);
    var title = "Select attachment";
    fp.init(window, title, nsIFilePicker.modeOpen);

    var retval = fp.show();

    if (retval == nsIFilePicker.returnOK) {
      // Create attachment for item.
      var newAttachment = createAttachment();
      newAttachment.uri = fp.fileURL.clone();
      addAttachment(newAttachment); /* This function is from lightning. */
    }
  }

  function saveFile() {
    var eeeUri = document.getElementById('attachment-link')
      .selectedItem.label;

    var listener = function(httpStatus, responseText) {
      dump('Attachment ' + eeeUri + ' downloaded.\n');
    }

    cal3eRequest.Client.getInstance()
      .downloadAttachment(findIdentity(), listener, eeeUri);
  }

  function findIdentity() {
    var identities = cal3eIdentity.Collection()
      .getEnabled()
      .findByEmail(cal3eModel.calendarUser(calendar));

    return identities.length > 0 ? identities[0] : null;
  }

  controller.updateUI = updateUI;
  controller.attachFile = addAttachmentDialog;
  controller.saveFile = saveFile;
}

var cal3e_attachFile;
var cal3e_saveFile;

cal3eSelectAttach.onRightClick =
  function cal3eSelectAttach_onRightClick(event) {
  if (event.button !== 2) {
    return;
  }

  var selectedItem = document.getElementById('attachment-link').selectedItem;

  if (selectedItem.label.indexOf('eee://') === 0) {
    document.getElementById('cal3e-attachment-popup-save').hidden = false;
    document.getElementById('attachment-popup-copy').hidden = true;
  } else {
    document.getElementById('cal3e-attachment-popup-save').hidden = true;
    document.getElementById('attachment-popup-copy').hidden = false;
  }
}

cal3eSelectAttach.onLoad = function cal3eSelectAttach_onLoad() {
  if (getCurrentCalendar().type != 'eee') {
    return;
  }

  var controller = new cal3eSelectAttach(window.arguments[0].calendar);
  cal3e_attachFile = controller.attachFile;
  cal3e_saveFile = controller.saveFile;
  controller.updateUI();
};

window.addEventListener('load', cal3eSelectAttach.onLoad, false);
