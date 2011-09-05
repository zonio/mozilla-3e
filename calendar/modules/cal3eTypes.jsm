/* ***** BEGIN LICENSE BLOCK *****
 * Mozilla 3e Calendar Extension
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

function cal3eAttribute(data) {
  this.name = function attributeName() {
    return data['name'];
  }
  this.value = function attributeValue() {
    return data['value'];
  }
  this.isPublic = function attributeIsPublic() {
    return data['is_public'];
  }
}
cal3eAttribute.build = function(xmlRpcData) {
}
cal3eAttribute.canBuildFrom = function(xmlRpcData) {
  return false;
}

function cal3eCalendar(data) {
  this.owner = function calendarOwner() {
    return data['owner'];
  }
  this.name = function calendarName() {
    return data['name'];
  }
  this.perm = function calendarPerm() {
    return data['perm'];
  }
  this.attribute = function calendarAttribute(name) {
    return data['attrs'][name] ?
      data['attrs'][name].value() :
      undefined ;
  }
  this.displayName = function calendarDisplayName() {
    return this.attribute('title') || this.name();
  }
}

function cal3eUser(data) {
  var calendars = null;

  this.username = function userUsername() {
    return data['username'];
  }
  this.attribute = function userAttribute(name) {
    return data['attrs'][name]['value'];
  }
  this.displayName = function userDisplayName() {
    return data['attrs'][name] ?
      data['attrs'][name].value() :
      undefined ;
  }
  this.calendars = function userCalendars() {
    if (null === calendars) {
      this.loadCalendars.call(this);
    }
  }

  function loadCalendars() {
    var user = this;
    var listener = cal3e.createOperationListener(
      function calEee_adoptItem_onResult(methodQueue, result) {
        if (methodQueue.isPending) {
          return;
        }
        if (Cr.NS_OK !== methodQueue.status) {
          onCalendarsLoadFailed.call(this);
          return;
        }
        onCalendarsLoaded.call(
          this,
          ._buildProviders(result));
      });

    Cc["@zonio.net/calendar3e/client-service;1"].
      getService(Ci.calEeeIClient).
      getCalendars(identity, listener,
                   "match_username(" + this.username() + ")");
  }
}
