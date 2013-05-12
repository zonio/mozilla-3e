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

Components.utils.import('resource://calendar3e/modules/feature.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function cal3eSelectAttach(ltn_updateCapabilities) {
  var controller = this;
  var bundleString;
  var lastCalendarType;

  function updateCapabilities() {
    ltn_updateCapabilities();
    if (getCurrentCalendar().type === lastCalendarType) {
      return;
    }

    if (getCurrentCalendar().type == 'eee') {
      activate3e();
    } else {
      deactivate3e();
    }
    lastCalendarType = getCurrentCalendar().type;
  }

  function openAttachment() {
    if (document.getElementById('attachment-link').selectedItems.length > 0) {
      return;
    }

    var uri = document.getElementById('attachment-link').getSelectedItem(0)
      .attachment.uri;
    if (uri.schemeIs('eee')) {
      cal3eUtils.eeeAttachmentToHttpUri(uri, function(uri) {
        loadAttachment(uri);
      });
    } else {
      loadAttachment(uri);
    }
  }

  function activate3e() {
    document.getElementById('button-url').command =
      'cal3e_cmd_attach_file';
    document.getElementById('attachment-popup-open').command =
      'cal3e_cmd_open_attachment';

    var mainMenuItem = document.getElementById('options-menu')
      .insertItemAt(
        getMainMenuItemIndex() + 1,
        bundleString.getString('calendar3e.attachements.attach.label'),
        null
      );
    // XXX This doesn't work: "menuItem.command = 'cal3e_cmd_attach_file';"
    // that's why setAttribute is used.
    mainMenuItem.setAttribute('id', 'cal3e-options-attachments-menuitem');
    mainMenuItem.setAttribute('command', 'cal3e_cmd_attach_file');

    var contextMenuItem = document.createElementNS(
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      'menuitem'
    );
    contextMenuItem.setAttribute('id', 'cal3e-attachment-popup-attachFile');
    contextMenuItem.setAttribute('command', 'cal3e_cmd_attach_file');
    contextMenuItem.setAttribute(
      'label',
      bundleString.getString('calendar3e.attachements.attach.label')
    );
    contextMenuItem.setAttribute(
      'accesskey',
      bundleString.getString('calendar3e.attachements.attach.accesskey')
    );
    var attachPage = document.getElementById('attachment-popup-attachPage');
    attachPage.parentNode.insertBefore(contextMenuItem, attachPage.nextSibling);
    var attachListBox = document.getElementById('attachment-link');
    attachListBox.removeAttribute('onclick');
    attachListBox.addEventListener(
      'select', onAttachSelect, false
    );
    attachListBox.addEventListener(
      'click', attachmentLinkClicked, false
    );
  }

  function deactivate3e() {
    document.getElementById('button-url').command =
      'cmd_attach_url';
    document.getElementById('attachment-popup-open').command =
      'cmd_openAttachment';

    var mainMenuItem = document.getElementById(
      'cal3e-options-attachments-menuitem'
    );
    mainMenuItem.parentNode.removeChild(mainMenuItem);

    var contextMenuItem = document.getElementById(
      'cal3e-attachment-popup-attachFile'
    );
    contextMenuItem.parentNode.removeChild(contextMenuItem);

    var attachListBox = document.getElementById('attachment-link');
    attachListBox.removeEventListener(
      'select', onAttachSelect, false
    );
    attachListBox.removeEventListener(
      'click', attachmentLinkClicked, false
    );
    attachListBox.setAttribute('onclick', 'attachmentLinkClicked(event);');
  }

  //TODO seems like there's a difference between ESR10 and latest
  // releases
  function getMainMenuItemIndex() {
    return document.getElementById('options-menu')
      .getIndexOfItem(document.getElementById(
        'options-attachments-menuitem'
      ));
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

  function attachmentLinkClicked(event) {
    event.currentTarget.focus();

    if (!isMainButtonClick(event)) {
      return;
    }

    if (event.originalTarget.localName === 'listboxbody') {
      attachFile();
    } else if ((event.originalTarget.localName == 'listitem') &&
               isDoubleClick(event)) {
      openAttachment();
    }
  }

  function isMainButtonClick(event) {
    return event.button !== 0;
  }

  function isDoubleClick(event) {
    return event.detail === 2;
  }

  /**
   * @todo There should be a nicer dialog
   */
  function loadAttachment(uri) {
    Components.classes['@mozilla.org/uriloader/external-protocol-service;1']
      .getService(Components.interfaces.nsIExternalProtocolService)
      .loadUrl(uri);
  }

  function init() {
    bundleString = document.getElementById('calendar3e-strings');
    updateCapabilities();
  }

  controller.updateCapabilities = updateCapabilities;
  controller.openAttachment = openAttachment;

  init();
}

var cal3e_openAttachment;
cal3eSelectAttach.onLoad = function cal3eSelectAttach_onLoad() {
  if (!cal3eFeature.isSupported('attachments')) {
    return;
  }

  var controller = new cal3eSelectAttach(updateCapabilities);
  updateCapabilities = controller.updateCapabilities;
  cal3e_openAttachment = controller.openAttachment;
};

window.addEventListener('load', cal3eSelectAttach.onLoad, false);
