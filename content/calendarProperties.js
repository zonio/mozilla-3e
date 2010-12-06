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

var cal3eProperties = {};

/**
 * Shows permissions control if calendar type is shared.
 *
 * Otherwise ensures that permissions control is hidden.
 */
cal3eProperties.typeChange = function typeChanged() {
  if ('3e' == cal3eProperties._calendar.type) {
    return;
  }

  var calendarEeeType = document.getElementById('calendar3e-type-group'),
      permissionsRow = document.getElementById('calendar3e-permissions-row');
  if ('shared' == calendarEeeType.selectedItem.value) {
    permissionsRow.removeAttribute('hidden');
  } else {
    permissionsRow.hidden = 'true';
  }
};

/**
 * Hides 3e controls introduced by overlay and shows those which
 * overlay hides.
 */
cal3eProperties.hide3eControls = function hide3eControls() {
  var uriRow = document.getElementById('calendar-uri-row');
  uriRow.removeAttribute('hidden');
  var emailIdentityRow = document.getElementById('calendar-email-identity-row');
  emailIdentityRow.removeAttribute('hidden');

  var typeRow = document.getElementById('calendar3e-type-row');
  typeRow.hidden = 'true';
  var permissionsRow = document.getElementById('calendar3e-permissions-row');
  permissionsRow.hidden = 'true';

  if (cal3eProperties._init) {
    window.sizeToContent();
  }
};

/**
 * Displays additional controls for 3e calendars in properties dialog.
 *
 * Otherwise ensures that those controls are hidden.
 */
cal3eProperties.init = function init() {
  cal3eProperties._init = true;
  var calendar = window.arguments[0].calendar;
  cal3eProperties._calendar = calendar;

  var calendarEeeType = document.getElementById('calendar3e-type-group');

  if ('3e' != calendar.type) {
    cal3eProperties.hide3eControls();
  }

  calendarEeeType.addEventListener(
    'command', cal3eProperties.typeChange, false);
  cal3eProperties.typeChange();

  cal3eProperties._init = false;
};

window.addEventListener('load', cal3eProperties.init, false);
