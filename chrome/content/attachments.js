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
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function cal3eSelectAttach(ltn_updateCapabilities) {
  var controller = this;

  function updateUI() {
    var buttonUrl = document.getElementById('button-url');
    buttonUrl.setAttribute('label', 'Attachments');
    buttonUrl.command = 'cal3e_cmd_attach_file';
    buttonUrl.removeAttribute('type');
    //
    //document.getElementById('options-attachments-menu').hidden = true;
    //document.getElementById('event-grid-attachment-row').hidden = true;
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

  //function addAttachment(attachment) {
  //  if (!attachment.uri) {
  //    return;
  //  }
  //
  //  //var documentLink = document.getElementById("cal3e-attachment-link");
  //  var documentLink = document.getElementById("attachment-link");
  //  var listItem = documentLink.appendChild(createXULElement("listitem"));
  //
  //  listItem.setAttribute("crop", "end");
  //  //listItem.setAttribute("class", "listitem-iconic");
  //  listItem.setAttribute("label", filename(attachment.uri));
  //  listItem.attachment = attachment;
  //
  //  var item = window.arguments[0].calendarEvent;
  //  item.addAttachment(attachment);
  //
  //  var attachments = item.getAttachments({});
  //  dump("attachments.length: " + attachments.length + "\n");
  //  item.getAttachments({}).forEach(function(attachment) {
  //    dump("attachment: " + attachment + "\n");
  //  });
  //
  //  showAttachmentListbox();
  //}
  //
  //function showAttachmentListbox() {
  //  //document.getElementById("cal3e-attachments-row")
  //  //  .removeAttribute("collapsed");
  //}

  function filename(uri) {
    if (!uri) {
      return null;
    }

    var splittedUri = uri.path.split("/");
    return splittedUri[splittedUri.length - 1];
  }

  controller.updateUI = updateUI;
  controller.attachFile = addAttachmentDialog;
}

var cal3e_attachFile;

cal3eSelectAttach.onLoad = function cal3eSelectAttach_onLoad() {
  if (getCurrentCalendar().type != 'eee') {
    return;
  }

  var controller = new cal3eSelectAttach();
  cal3e_attachFile = controller.attachFile;
  controller.updateUI();
};

window.addEventListener('load', cal3eSelectAttach.onLoad, false);
