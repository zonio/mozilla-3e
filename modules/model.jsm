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

function getAttribute(object, name) {
  if (!object['attrs']) {
    return null;
  }

  var value = null;
  object['attrs'].forEach(function(attr) {
    if (attr['name'] === name) {
      value = attr['value'];
    }
  });

  return value;
}

function getUserLabel(user) {
  var userLabel = '';
  if (getAttribute(user, 'realname')) {
    userLabel += getAttribute(user, 'realname') + ' <';
  }
  userLabel += user['username'];
  if (getAttribute(user, 'realname')) {
    userLabel += '>';
  }

  return userLabel;
}

function getCalendarLabel(calendar) {
  return '' + (getAttribute(calendar, 'title') || calendar['name']);
}

var cal3eModel = {
  attribute: getAttribute,
  userLabel: getUserLabel,
  calendarLabel: getCalendarLabel
};
EXPORTED_SYMBOLS = [
  'cal3eModel'
];
