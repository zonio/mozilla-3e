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

Components.utils.import("resource://calendar3e/modules/utils.jsm");

function cal3eSelectAttach() {
  var ltn_updateCapabilities;
  var ltn_openAttachment
  var bundleString;
  var lastCalendarType;

  function activate3e() {
    var attachButton = document.getElementById('button-url');
    attachButton.command = 'cal3e_cmd_attach_file';

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
    menuItem.setAttribute('id', 'cal3e-options-attachments-menuitem');

    menuItem = document.createElementNS(
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      'menuitem'
    );
    menuItem.setAttribute('label', bundleString.getString('cal3eCalendarAttachements.attach.label'));
    menuItem.setAttribute('command', 'cal3e_cmd_attach_file');
    menuItem.setAttribute('id', 'cal3e-attachment-popup-attachFile');
    menuItem.setAttribute(
      'accesskey',
      bundleString.getString('cal3eCalendarAttachements.attach.accesskey')
    );
    var attachPage = document.getElementById('attachment-popup-attachPage');
    attachPage.parentNode.insertBefore(menuItem, attachPage.nextSibling);

    var attachListBox = document.getElementById('attachment-link');
    attachListBox.addEventListener('select', onAttachSelect, false);
    attachListBox.removeAttribute('onclick');
    attachListBox.removeEventListener('click', attachmentLinkClicked, false);
    attachListBox.addEventListener('click', cal3e_attachmentLinkClicked, false);

    ltn_openAttachment = openAttachment;
    openAttachment = cal3e_openAttachment;
  }

  function deactivate3e() {
    var attachButton = document.getElementById('button-url');
    attachButton.command = 'cmd_attach_url';

    var elem = document.getElementById('cal3e-options-attachments-menuitem');
    elem.parentNode.removeChild(elem);
    elem = document.getElementById('cal3e-attachment-popup-attachFile');
    elem.parentNode.removeChild(elem);

    var attachListBox = document.getElementById('attachment-link');
    attachListBox.removeEventListener('select', onAttachSelect, false);
    attachListBox.removeEventListener('click', cal3e_attachmentLinkClicked, false);
    attachListBox.addEventListener('click', attachmentLinkClicked, false);

    openAttachement = ltn_openAttachement;
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
    ltn_updateCapabilities();
    var calendar = getCurrentCalendar();
    if (calendar.type === lastCalendarType) {
      return;
    }
    
    if (calendar.type == 'eee') {
      activate3e();
    } else {
      deactivate3e();
    }
    lastCalendarType = calendar.type;
  }

  function cal3e_attachmentLinkClicked(event) {
    event.currentTarget.focus();
  
    if (event.button != 0) {
      return;
    }
  
    if (event.originalTarget.localName == "listboxbody") {
      attachFile();
    } else if (event.originalTarget.localName == "listitem" && event.detail == 2) {
      openAttachment();
    }
  }

  function cal3e_openAttachment() {
    var documentLink = document.getElementById("attachment-link");
    if (documentLink.selectedItems.length == 1) {
      var attURI = documentLink.getSelectedItem(0).attachment.uri;
      var externalLoader = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                                     .getService(Components.interfaces.nsIExternalProtocolService);

      if (attURI.schemeIs('eee')) {
        attURI = cal3eUtils.eeeAttachmentToHttpUri(attURI);
      }
      // TODO There should be a nicer dialog
      externalLoader.loadUrl(attURI);
    }
  }

  function init() {
    bundleString = document.getElementById('calendar3e-strings');
    ltn_updateCapabilities = updateCapabilities;
    updateCapabilities = cal3e_updateCapabilities;
    updateCapabilities();
  }

  init();
};

cal3eSelectAttach.onLoad = function cal3eSelectAttach_onLoad() {
  new cal3eSelectAttach();
};

window.addEventListener('load', cal3eSelectAttach.onLoad, false);
