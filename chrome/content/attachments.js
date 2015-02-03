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

function cal3eSelectAttach(calendar) {
  var controller = this;
  const nsIFilePicker = Components.interfaces.nsIFilePicker;

  function updateUI() {
    document.getElementById('button-url').command = 'cal3e_cmd_attach_file';
    document.getElementById('attachment-link')
      .removeAttribute('onclick');
    document.getElementById('attachment-link')
      .setAttribute('ondblclick', 'cal3e_openFile();');
    document.getElementById('attachment-link')
      .addEventListener('click', cal3eSelectAttach.onPopupShowing);
    document.getElementById('attachment-link').setAttribute('rows', 5);
  }

  function addAttachmentDialog() {
    var fp = Components.classes['@mozilla.org/filepicker;1']
      .createInstance(nsIFilePicker);
    var title = document.getElementById('calendar3e-strings')
      .getString('calendar3e.attachements.attach.label');
    fp.init(window, title, nsIFilePicker.modeOpen);

    var retval = fp.show();

    if (retval == nsIFilePicker.returnOK) {
      var newAttachment = createAttachment();
      newAttachment.uri = fp.fileURL.clone();
      addAttachment(newAttachment);
    }

    setTimeout(function() {
      pretifyAttachmentsLabels();
      var listbox = document.getElementById('attachment-link');
      listbox.ensureElementIsVisible(
        listbox.getItemAtIndex(listbox.itemCount - 1));
      }, 500)
  }

  function pretifyAttachmentsLabels() {
    var listbox = document.getElementById('attachment-link');

    for (var idx = 0; idx < listbox.itemCount; idx++) {
      var listitem = listbox.getItemAtIndex(idx);
      var uriScheme = listitem.attachment.uri.scheme;
      if (uriScheme === 'eee' || uriScheme === 'file') {
        pretifyAttachmentLabel(listitem);
      }
    }
  }

  function pretifyAttachmentLabel(listitem) {
    listitem.value = listitem.attachment.uri.spec;
    var splittedUri = listitem.attachment.uri.spec.split('/');
    listitem.label = decodeURIComponent(splittedUri[splittedUri.length - 1]);
  }

  controller.updateUI = updateUI;
  controller.attachFile = addAttachmentDialog;
  controller.pretifyAttachmentsLabels = pretifyAttachmentsLabels;
}

var cal3e_attachFile;

function cal3e_saveFile() {
  var uri = document.getElementById('attachment-link').selectedItem;

  if (uri) {
    cal3eAttachment.save(uri.value, window, window.arguments[0].calendar);
  }
}

function cal3e_openFile() {
  var uri = document.getElementById('attachment-link').selectedItem;

  if (uri) {
    cal3eAttachment.open(uri.value, window, window.arguments[0].calendar);
  }
}

cal3eSelectAttach.onPopupShowing =
  function cal3eSelectAttach_onRightClick(event) {
  if (getCurrentCalendar().type != 'eee') {
    return;
  }

  if(cal3eSelectAttach.isOldGecko()) {
    document.getElementById('attachment-popup-open').hidden = true;
  }

  document.getElementById('attachment-popup-attachPage').hidden = true;
  document.getElementById('attachment-popup')
    .getElementsByTagName('menuseparator')[0].hidden = true;

  var itemUriScheme = document.getElementById('attachment-link')
    .selectedItem.attachment.uri.scheme;

  var popupCopy = document.getElementById('attachment-popup-copy');

  if (itemUriScheme === 'eee') {
    document.getElementById('cal3e-attachment-popup-save').hidden = false;
    if (popupCopy) {
      popupCopy.hidden = true;
    }
    document.getElementById('attachment-popup-open').command = 'cal3e_cmd_open';
  } else if (itemUriScheme === 'file') {
    document.getElementById('cal3e-attachment-popup-save').hidden = true;
    if (popupCopy) {
      popupCopy.hidden = true;
    }
  } else {
    document.getElementById('cal3e-attachment-popup-save').hidden = true;
    if (popupCopy) {
      popupCopy.hidden = false;
    }
  }
}

cal3eSelectAttach.isOldGecko = function cal3eSelectAttach_isOldGecko() {
  var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
    .getService(Components.interfaces.nsIXULAppInfo);

  var versionChecker = Components.classes[
      "@mozilla.org/xpcom/version-comparator;1"
    ].getService(Components.interfaces.nsIVersionComparator);

  return versionChecker.compare(appInfo.version, "14") < 0;
}

cal3eSelectAttach.onLoad = function cal3eSelectAttach_onLoad() {
  if (getCurrentCalendar().type != 'eee') {
    return;
  }

  var controller = new cal3eSelectAttach(window.arguments[0].calendar);
  cal3e_attachFile = controller.attachFile;
  controller.updateUI();
  setTimeout(controller.pretifyAttachmentsLabels, 500);
};

window.addEventListener('load', cal3eSelectAttach.onLoad, false);
