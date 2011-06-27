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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://calendar3e/modules/cal3eUtils.jsm");

/**
 * Handles calendar creation, deletion and updates by observing
 * Mozilla Calendar Manager and calling EEE client appropriately.
 */
function calEeeManager() {
}

calEeeManager.prototype = {

  QueryInterface: XPCOMUtils.generateQI([
    Ci.calEeeIManager,
    Ci.calICalendarManagerObserver,
    Ci.nsIObserver
  ]),

  /**
   * Calls {@link register} when Thunderbird starts.
   *
   * @param {nsISupports} subject
   * @param {String} topic
   * @param {String} data
   */
  observe: function calEeeManager_observe(subject, topic, data) {
    switch (topic) {
    case 'profile-after-change':
      this.register();
      break;
    }
  },

  /**
   * Registers EEE calendar manager globally.
   *
   * This is done by becoming a calendar manager observer.
   */
  register: function calEeeManager_register() {
    var calendarManager = Cc["@mozilla.org/calendar/manager;1"]
      .getService(Ci.calICalendarManager);
    calendarManager.addObserver(this);

    return this;
  },

  /**
   * Unregisters EEE calendar manager.
   */
  unregister: function calEeeManager_register() {
    var calendarManager = Cc["@mozilla.org/calendar/manager;1"]
      .getService(Ci.calICalendarManager);
    calendarManager.removeObserver(this);

    return this;
  },

  /**
   * Calls createCalendar method of EEE client if EEE calendar given.
   *
   * @param {calICalendar} calendar
   */
  onCalendarRegistered: function calEeeManager_registered(calendar) {
    if ('eee' != calendar.type) {
      return;
    }
    calendar = calendar.QueryInterface(Ci.calEeeICalendar);

    // calendar already is registered if it has calname set
    if (calendar.calname) {
      return;
    }

    var listener = cal3e.createOperationListener(
      function calEeeManager_create_onResult(methodQueue, result) {
        dump("Calendar " + calendar.name + " created");
      }
    );

    this._generateUniqueUri(calendar);
    this._getClient().createCalendar(calendar.identity, listener, calendar);
  },

  /**
   * Does nothing and is here only to comply with declared interface.
   *
   * @param {calICalendar} calendar
   */
  onCalendarUnregistering:
  function calEeeManager_onCalendarUnregistering(calendar) {
  },

  /**
   * Calls deleteCalendar method of EEE client if EEE calendar given.
   *
   * @param {calICalendar} calendar
   */
  onCalendarDeleting: function calEeeManager_deleting(calendar) {
    if ('eee' != calendar.type) {
      return;
    }
    calendar = calendar.QueryInterface(Ci.calEeeCalendar);

    var listener = cal3e.createOperationListener(
      function calEeeManager_delete_onResult(methodQueue, result) {}
    );
    this._getClient().deleteCalendar(calendar.identity, listener, calendar);
  },

  _getClient: function calEeeManager_getClient() {
    return Cc["@zonio.net/calendar3e/client-service;1"]
      .getService(Ci.calEeeIClient);
  },

  /**
   * Creates unique (by the means of UUID uniqueness) calendar URI
   * from which EEE calname is then derived.
   */
  _generateUniqueUri: function calEeeManager_generateUniqueUri(calendar) {
    var generator = Components.classes["@mozilla.org/uuid-generator;1"]
      .getService(Components.interfaces.nsIUUIDGenerator);

    var uri = "eee://" +
      calendar.identity.email + "/" +
      generator.generateUUID().toString().substring(1, 36);

    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
      .getService(Components.interfaces.nsIIOService);
    calendar.uri = ioService.newURI(uri, null, null);
  }

}

EXPORTED_SYMBOLS = [
  'calEeeManager'
];
