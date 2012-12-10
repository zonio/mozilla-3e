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

function cal3eUriHelper(calendar) {
  var controller = this;

  function copyUriToClipboard() {
    Components.classes['@mozilla.org/widget/clipboardhelper;1']
      .getService(Components.interfaces.nsIClipboardHelper)
      .copyString(document.getElementById('calendar3e-uri-helper-uri').value);
  }

  function initCalendarUri() {
    cal3eModel.buildWebcalUri(calendar).whenDone(setCalendarUri);
  }

  function setCalendarUri(future) {
    document.getElementById('calendar3e-uri-helper-uri').value =
      future.value().spec;
    document.documentElement.getButton('extra1').disabled = false;
  }

  function init() {
    document.documentElement.getButton('extra1').disabled = true;
    initCalendarUri();
  }

  controller.copyUriToClipboard = copyUriToClipboard;

  init();
}

cal3eUriHelper.open = function cal3eUriHelper_open() {
  openDialog(
    'chrome://calendar3e/content/calendarUriHelper.xul',
    'cal3eUriHelper',
    'chrome,titlebar,modal',
    getCompositeCalendar().defaultCalendar
  );
};
cal3eUriHelper.onExtra1 = function cal3eUriHelper_onExtra1() {
  return cal3eUriHelper.controller.copyUriToClipboard();
};
cal3eUriHelper.onLoad = function cal3eUriHelper_onLoad() {
  cal3eUriHelper.controller = new cal3eUriHelper(window.arguments[0]);
  window.addEventListener('unload', cal3eUriHelper.onUnload, false);
};
cal3eUriHelper.onUnload = function cal3eUriHelper_onUnload() {
  window.removeEventListener('unload', cal3eUriHelper.onUnload, false);
  delete cal3eUriHelper.controller;
};
