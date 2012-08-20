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

 
function cal3eSelectAttach() {
  dump('function cal3eSelectAttach\n');
  var calendar;

  function init() {
    calendar = getCurrentCalendar();
    if (calendar.type == 'eee') {
      var attachButton = document.getElementById('button-url');
      attachButton.command = 'cmd_attach_file';
      attachButton.label = "Attach File";
    }
  }

  init();
};

cal3eSelectAttach.onLoad = function cal3eSelectAttach_onLoad() {
  new cal3eSelectAttach();
};

window.addEventListener('load', cal3eSelectAttach.onLoad, false);
