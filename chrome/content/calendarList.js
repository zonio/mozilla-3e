/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2011  Zonio s.r.o.
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

function cal3eCalendarList(dataDelegate) {
}

function cal3eCalendarDataDelegate() {
  var delegate = this;

  function getAccounts() {
    return [
      {
        defaultIdentity: {
          id: 'id1',
          fullName: '1'
        }
      },
      {
        defaultIdentity: {
          id: 'id2',
          fullName: '2'
        }
      },
      {
        defaultIdentity: {
          id: 'id3',
          fullName: '3'
        }
      },
      {
        defaultIdentity: {
          id: 'id4',
          fullName: '4'
        }
      },
      {
        defaultIdentity: {
          id: 'id5',
          fullName: '5'
        }
      }
    ];
  }

  function getCalendars(account) {
    return [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D' },
      { id: 'e', name: 'E' }
    ];
  }

  delegate.accounts = getAccounts;
  delegate.getCalendars = getCalendars;
}

cal3eCalendarList.onLoad = function cal3eCalendarList_onLoad() {
  window.removeEventListener('load', cal3eCalendarList.onLoad, false);
  if (!cal3eFeature.isSupported('sidebar')) {
    return;
  }

  Cal3ecalendarlist.controller = new cal3eCalendarList(
    new cal3eCalendarDataDelegate()
  );
  window.addEventListener('unload', cal3eCalendarList.onUnload, false);
};
cal3eCalendarList.onUnload = function cal3eCalendarList_onUnload() {
  window.removeEventListener('unload', cal3eCalendarList.onUnload, false);
  delete cal3eCalendarList.controller;
};

window.addEventListener('load', cal3eCalendarList.onLoad, false);
