/* ***** BEGIN LICENSE BLOCK *****
 * Mozilla 3e Calendar Extension
 * Copyright © 2010  Zonio s.r.o.
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

var cal3eCreation = {};

/**
 * Checks value of selected calendar format and modifies dialog
 * accordingly.
 *
 * If calendar format is 3e, then URI textbox is hidden because URI is
 * computed automatically. Previous value is stored in case user
 * changes her mind.
 */
cal3eCreation.selectionChanged = function selectionChanged() {
  var calendarFormat = document.getElementById('calendar-format'),
      calendarUri = document.getElementById('calendar-uri');

  if ('3e' == calendarFormat.value) {
    cal3eCreation._originalUri = calendarUri.value || "";
    calendarUri.parentNode.hidden = 'true';
    calendarUri.value = "eee://";
  } else {
    calendarUri.value = cal3eCreation._originalUri;
    calendarUri.parentNode.removeAttribute('hidden');
  }

  var commandEvent = document.createEvent('Event');
  commandEvent.initEvent('command', true, true);
  calendarUri.dispatchEvent(commandEvent);
};

/**
 * Initializes calendar creation dialog with 3e extesion specific
 * behavior.
 */
cal3eCreation.init = function init() {
  var calendarFormat = document.getElementById('calendar-format');
  calendarFormat.addEventListener(
    'command', cal3eCreation.selectionChanged, false);
};

window.addEventListener('load', cal3eCreation.init, false);
