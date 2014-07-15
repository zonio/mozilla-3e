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

Components.utils.import('resource://calendar3e/modules/feature.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function cal3eSelectAttach(ltn_updateCapabilities) {
  var controller = this;

  function updateUI() {
    var buttonUrl = document.getElementById('button-url');
    buttonUrl.setAttribute('label', 'Attachments');
    buttonUrl.command = 'cal3e_cmd_attach_file';
    buttonUrl.removeAttribute('type');

    document.getElementById('options-attachments-menu').hidden = true;
  }

  controller.updateUI = updateUI;
}

var cal3e_openAttachment;
cal3eSelectAttach.onLoad = function cal3eSelectAttach_onLoad() {
  if (getCurrentCalendar().type != 'eee') {
    return;
  }

  var controller = new cal3eSelectAttach();
  controller.updateUI();
};

window.addEventListener('load', cal3eSelectAttach.onLoad, false);
