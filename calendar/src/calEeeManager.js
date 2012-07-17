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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://calendar3e/modules/identities.jsm");
Cu.import("resource://calendar3e/modules/utils.jsm");

/**
 * Handles calendar creation, deletion and updates by observing
 * Mozilla Calendar Manager and calling EEE client appropriately.
 */
function calEeeManager() {
}

calEeeManager.classInfo = XPCOMUtils.generateCI({
  classID: Components.ID("{b65ddbd7-c4f0-46fe-9a36-f2bc8ffe113b}"),
  contractID: "@zonio.net/calendar3e/manager;1",
  classDescription: "EEE calendar manager",
  interfaces: [Ci.calEeeIManager,
               Ci.calICalendarManagerObserver,
               Ci.calIObserver,
               Ci.nsIObserver,
               Ci.nsIClassInfo],
  flags: Ci.nsIClassInfo.SINGLETON
});

calEeeManager.prototype = {

  classDescription: calEeeManager.classInfo.classDescription,

  classID: calEeeManager.classInfo.classID,

  contractID: calEeeManager.classInfo.contractID,

  QueryInterface: XPCOMUtils.generateQI(
    calEeeManager.classInfo.getInterfaces({})),

  classInfo: calEeeManager.classInfo,

  /**
   * Calls {@link register} when Thunderbird starts.
   *
   * We're observing profile-after-change to recognize Thunderbird
   * startup.  There's also calendar-startup-done but it actually
   * occurs before profile-after-change from our components'
   * perspective.
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
    if (this._registered) {
      return this;
    }
    this._registered = true;

    var calendarManager = Cc["@mozilla.org/calendar/manager;1"]
      .getService(Ci.calICalendarManager);
    calendarManager.addObserver(this);

    var count = {};
    var manager = this;
    calendarManager.getCalendars(count)
      .filter(function (calendar) {
        return 'eee' == calendar.type;
      })
      .forEach(function (calendar) {
        calendar.addObserver(manager)
      });

    return this;
  },

  /**
   * Unregisters EEE calendar manager.
   */
  unregister: function calEeeManager_register() {
    if (!this._registered) {
      return this;
    }
    var calendarManager = Cc["@mozilla.org/calendar/manager;1"]
      .getService(Ci.calICalendarManager);
    calendarManager.removeObserver(this);
    this._registered = false;

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
    calendar.addObserver(this);

    // calendar already is registered if it has calname set
    if (this._getCalname(calendar)) {
      return;
    }

    var listener = cal3e.createOperationListener(
      function calEeeManager_create_onResult(methodQueue, result) {
        Services.prefs.setCharPref(
          "calendar.registry." + calendar.id + ".uri",
          calendar.uri.spec
        );
      }
    );
    this._generateUniqueUri(calendar);
    this._getClient().createCalendar(
      this._getIdentity(calendar),
      listener,
      calendar
    );
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
    calendar.removeObserver(this);

    // calendar is not registered if it has no calname set
    if (!this._getCalname(calendar)) {
      return;
    }

    var listener = cal3e.createOperationListener(
      function calEeeManager_delete_onResult(methodQueue, result) {}
    );
    this._getClient().deleteCalendar(
      this._getIdentity(calendar),
      listener,
      calendar
    );
  },

  onPropertyChanged: function calEeeManager_onPropertyChanged(
    calendar, name, value, oldValue) {
    if ('eee' != calendar.type) {
      return;
    }

    // calendar is not registered if it has no calname set
    if (!this._getCalname(calendar)) {
      return;
    }

    var attrName, attrValue, isPublic;
    switch (name) {
    case 'name':
      attrName = 'title';
      attrValue = value;
      isPublic = true;
      break;
    case 'color':
      attrName = 'color';
      attrValue = value;
      isPublic = true;
      break;
    default:
      return;
      break;
    }

    var listener = cal3e.createOperationListener(
      function calEeeManager_update_onResult(methodQueue, result) {}
    );
    this._getClient().setCalendarAttribute(
      this._getIdentity(calendar),
      listener,
      calendar,
      attrName,
      attrValue,
      isPublic
    );
  },

  onStartBatch: function calEeeManager_onStartBatch() {},
  onEndBatch: function calEeeManager_onEndBatch() {},
  onLoad: function calEeeManager_onLoad(calendar) {},
  onAddItem: function calEeeManager_onAddItem(item) {},
  onModifyItem: function calEeeManager_onModifyItem(newItem, oldItem) {},
  onDeleteItem: function calEeeManager_onDeleteItem(item) {},
  onError: function calEeeManager_onError(calendar, error, message) {},
  onPropertyDeleting: function calEeeManager_onPropertyDeleting(
    calendar, name) {},

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
      this._getIdentity(calendar).email + "/" +
      generator.generateUUID().toString().substring(1, 36);

    calendar.uri = Services.io.newURI(uri, null, null);
  },

  _getIdentity: function calEeeManager_getIdentity(calendar) {
    var eeeUser = calendar.uri.spec.split('/', 4)[2];

    var identities = cal3e.IdentityCollection().
      getEnabled().
      findByEmail(eeeUser);

    return identities.length > 0 ? identities[0] : null ;
  },

  _getCalname: function calEeeManager_getCalname(calendar) {
    var uriParts = calendar.uri.spec.split('/', 5);

    return uriParts[4] || uriParts[3];
  }

}

const NSGetFactory = XPCOMUtils.generateNSGetFactory([calEeeManager]);
