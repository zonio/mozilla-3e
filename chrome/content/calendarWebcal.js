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

function cal3eWebcal(calendar) {
  var controller = this;

  function copyUriToClipboard() {
    Components.classes['@mozilla.org/widget/clipboardhelper;1']
      .getService(Components.interfaces.nsIClipboardHelper)
      .copyString(document.getElementById('calendar3e-webcal-uri').value);
  }

  function initCalendarUri() {
    cal3eModel.buildWebcalUri(calendar).whenDone(setCalendarUri);
  }

  function setCalendarUri(future) {
    document.getElementById('calendar3e-webcal-uri').value =
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

cal3eWebcal.open = function cal3eWebcal_open() {
  openDialog(
    'chrome://calendar3e/content/calendarWebcal.xul',
    'cal3eWebcal',
    'chrome,titlebar,modal',
    getCompositeCalendar().defaultCalendar
  );
};
cal3eWebcal.onExtra1 = function cal3eWebcal_onExtra1() {
  return cal3eWebcal.controller.copyUriToClipboard();
};
cal3eWebcal.onLoad = function cal3eWebcal_onLoad() {
  cal3eWebcal.controller = new cal3eWebcal(window.arguments[0]);
  window.addEventListener('unload', cal3eWebcal.onUnload, false);
};
cal3eWebcal.onUnload = function cal3eWebcal_onUnload() {
  window.removeEventListener('unload', cal3eWebcal.onUnload, false);
  delete cal3eWebcal.controller;
};
