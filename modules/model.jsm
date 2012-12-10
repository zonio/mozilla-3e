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

Components.utils.import('resource://gre/modules/Services.jsm');

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

function getCalendarName(calendar) {
  return getStructuredUri(calendar.uri)['name'];
}

function getCalendarCalspec(calendar) {
  return getCalendarOwner(calendar) + ':' + getCalendarName(calendar);
}

function getCalendarUser(calendar) {
  return getStructuredUri(calendar.uri)['user'];
}

function getCalendarOwner(calendar) {
  return getStructuredUri(calendar.uri)['owner'] !== null ?
    getStructuredUri(calendar.uri)['owner'] :
    getStructuredUri(calendar.uri)['user'];
}

function getStructuredUri(uri) {
  var uriParts = uri.spec.split('/', 5);
  var structuredUri = {};
  structuredUri['protocol'] = uriParts[0].substring(0, uriParts[0].length - 1);
  structuredUri['user'] = decodeUsernameFromUri(uriParts[2]);
  structuredUri['owner'] = uriParts.length === 5 ? uriParts[3] : null;
  structuredUri['name'] = uriParts.length >= 4 ?
    uriParts[[uriParts.length - 1]] :
    null;

  return structuredUri;
}

function buildUri(structuredUri) {
  var spec = '';
  spec += structuredUri['protocol'] + ':/';
  spec += '/' + structuredUri['user'];
  if ((structuredUri['owner'] !== null) &&
      (structuredUri['owner'] !== structuredUri['user'])) {
    spec += '/' + structuredUri['owner'];
  }
  spec += '/' + structuredUri['name'];

  return Services.io.newURI(spec, null, null);
}

function decodeUsernameFromUri(username) {
  var parts = username.split('@');
  parts[0] = decodeURIComponent(parts[0]);

  return parts.join('@');
}

function getCalendarLabel(calendar) {
  return '' + (getAttribute(calendar, 'title') || calendar['name']);
}

function getPermissionLabel(calendar) {
  if (['write', 'read'].indexOf(calendar['perm']) < 0) {
    return '--';
  }

  return Services.strings
    .createBundle('chrome://calendar3e/locale/cal3eCalendar.properties')
    .GetStringFromName(
      'cal3eModel.permissions.' + calendar['perm']
    );
}

var cal3eModel = {
  attribute: getAttribute,
  userLabel: getUserLabel,
  buildUri: buildUri,
  calendarName: getCalendarName,
  calendarCalspec: getCalendarCalspec,
  calendarUser: getCalendarUser,
  calendarOwner: getCalendarOwner,
  calendarLabel: getCalendarLabel,
  permissionLabel: getPermissionLabel
};
EXPORTED_SYMBOLS = [
  'cal3eModel'
];
