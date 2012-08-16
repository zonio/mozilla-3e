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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar3e/modules/identity.jsm");
Components.utils.import("resource://calendar3e/modules/utils.jsm");
Components.utils.import("resource://calendar3e/modules/request.jsm");
Components.utils.import("resource://calendar3e/modules/response.jsm");

/**
 * Synchronizer of calendars present in Mozilla client application
 * (i.e. Lightning) with those on EEE server.
 */
function calEeeSynchronizationService() {
  /**
   * Map of timers by identity.
   *
   * @type Object
   */
  this._timersByIdentity = {};

  /**
   * Map of synchronizers by identity.
   *
   * @type Object
   */
  this._synchronizersByIdentity = {};

  /**
   * Synchronizer of EEE calendars.
   *
   * @type calEeeISynchronizer
   */
  this._synchronizer = Components.classes[
    "@zonio.net/calendar3e/synchronizer;1"
  ].createInstance(Components.interfaces.calEeeISynchronizer);

  /**
   * Observer of changes in identities.
   *
   * @type Object
   */
  this._identityObserver = null;
}

calEeeSynchronizationService.classInfo = XPCOMUtils.generateCI({
  classID: Components.ID("{d7a08a5f-46ad-4a84-ad66-1cc27e9f388e}"),
  contractID: "@zonio.net/calendar3e/synchronization-service;1",
  classDescription: "EEE calendar synchronization service",
  interfaces: [Components.interfaces.calEeeISynchronizationService,
               Components.interfaces.nsIObserver,
               Components.interfaces.nsIClassInfo],
  flags: Components.interfaces.nsIClassInfo.SINGLETON
});

calEeeSynchronizationService.prototype = {

  classDescription: calEeeSynchronizationService.classInfo.classDescription,

  classID: calEeeSynchronizationService.classInfo.classID,

  contractID: calEeeSynchronizationService.classInfo.contractID,

  QueryInterface: XPCOMUtils.generateQI(
    calEeeSynchronizationService.classInfo.getInterfaces({})),

  classInfo: calEeeSynchronizationService.classInfo,

  /**
   * Adds or removes identities according to state of identity
   * collection.
   */
  onIdentityChange: function calEeeSyncService_onIdentityChange() {
    var knownIdentities = {};
    var identityKey;
    for (identityKey in this._timersByIdentity) {
      if (!this._timersByIdentity.hasOwnProperty(identityKey)) {
        continue;
      }
      knownIdentities[identityKey] = true;
    }

    var identities = cal3eIdentity.Collection().
      getEnabled().
      filter(function(identity) {
        return !knownIdentities[identity.key];
      });
    var identity;
    for each (identity in identities) {
      this.addIdentity(identity);
      delete knownIdentities[identity.key];
    }

    var identityKey;
    for (identityKey in knownIdentities) {
      if (!knownIdentities.hasOwnProperty(identityKey)) {
        continue;
      }
      this.removeIdentity(identityKey);
    }
  },

  /**
   * Calls {@link register} when Thunderbird starts and runs
   * synchronization regularly.
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
  observe: function calEeeSyncService_observe(subject, topic, data) {
    switch (topic) {
    case 'profile-after-change':
      this.register();
      break;
    case 'timer-callback':
      this.runSynchronizer(this._findIdentityOfTimer(subject));
      break;
    }
  },

  /**
   * Registers synchronization service to globally observe identity
   * changes and synchronize their EEE calendars.
   *
   * @returns {calEeeISynchronizationService} receiver
   */
  register: function calEeeSyncService_register() {
    if (this._registered) {
      return this;
    }
    this._registered = true;
    this._identityObserver = cal3eIdentity.Observer()
    this._identityObserver.addObserver(this.onIdentityChange.bind(this));
    this.onIdentityChange();

    return this;
  },

  /**
   * Unregisters synchronization service globally observing account
   * changes and synchronizing their EEE calendars.
   *
   * @returns {calEeeISynchronizationService} receiver
   */
  unregister: function calEeeSyncService_register() {
    if (!this._registered) {
      return this;
    }
    this._identityObserver.destroy();
    this._registered = false;

    return this;
  },

  /**
   * Registers identity to synchronize its calendars once in 15 seconds.
   *
   * @param {nsIMsgIdentity} identity
   * @returns {calEeeISynchronizationService} receiver
   */
  addIdentity: function calEeeSyncService_addIdentity(identity) {
    this._synchronizersByIdentity[identity.key] =
      Components.classes[
        "@zonio.net/calendar3e/synchronizer;1"
      ].createInstance(Components.interfaces.calEeeISynchronizer);
    this._synchronizersByIdentity[identity.key].identity = identity;

    this._synchronizersByIdentity[identity.key].synchronize();

    this._timersByIdentity[identity.key] = Components.classes[
      "@mozilla.org/timer;1"
    ].createInstance(Components.interfaces.nsITimer);
    this._timersByIdentity[identity.key].init(
      this, 15000, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);

    return this;
  },

  /**
   * Removes identity from periodical calendar synchronization.
   *
   * @param {String} identity
   * @returns {calEeeISynchronizationService} receiver
   */
  removeIdentity: function calEeeSyncService_removeIdentity(identityKey) {
    this._timersByIdentity[identityKey].cancel();
    delete this._timersByIdentity[identityKey];
    delete this._synchronizersByIdentity[identityKey];
    this._unregisterCalendarsOfIdentity(identityKey);

    return this;
  },

  /**
   * Runs synchronizer of given identity.
   *
   * If identity's synchronizer is not found, nothing happens.
   *
   * @param {String} identityKey
   * @returns {calEeeISynchronizationService} receiver
   */
  runSynchronizer: function calEeeSyncService_runSynchronizer(identityKey) {
    if (this._synchronizersByIdentity[identityKey]) {
      this._synchronizersByIdentity[identityKey].synchronize();
    }

    return this;
  },

  /**
   * Tries to find identity (its key) of given timer.
   *
   * @param {nsITimer} timer
   * @returns {String|null}
   */
  _findIdentityOfTimer:
  function calEeeSyncService_findIdentityOfTimer(timer) {
    timer = timer.QueryInterface(Components.interfaces.nsITimer);
    var identityKey;
    var found = false;
    for (identityKey in this._timersByIdentity) {
      if (!this._timersByIdentity.hasOwnProperty(identityKey)) {
        continue;
      }
      if (timer === this._timersByIdentity[identityKey]) {
        found = true;
        break;
      }
    }

    return found ? identityKey : null ;
  },

  /**
   * Unregisters all identity's calendars.
   *
   * @param {String} identityKey
   */
  _unregisterCalendarsOfIdentity:
  function calEeeService_unregisterCalendarsOfIdentity(identityKey) {
    var manager = Components.classes[
      "@mozilla.org/calendar/manager;1"
    ].getService(Components.interfaces.calICalendarManager);
    manager.
      getCalendars({}).
      filter(function calEeeSynchronizer_filterEeeCalendars(calendar) {
        return ('eee' == calendar.type) &&
          calendar.getProperty("imip.identity") &&
          (calendar.getProperty("imip.identity").key === identityKey);
      }).
      forEach(function(calendar) {
        manager.unregisterCalendar(calendar);
      });
  }

}

/**
 * Synchronizer of calendars present in Mozilla client application
 * (i.e. Lightning) with those on EEE server.
 */
function calEeeSynchronizer() {
  this._identity = null;
}

calEeeSynchronizer.prototype = {

  classDescription: "EEE-enabled client calendar synchronizer",

  classID: Components.ID("{9045ff85-9e1c-47e4-9872-44c5ab424b73}"),

  contractID: "@zonio.net/calendar3e/synchronizer;1",

  QueryInterface: XPCOMUtils.generateQI([
    Components.interfaces.calEeeISynchronizer
  ]),

  get identity() {
    return this._identity;
  },

  set identity(identity) {
    this._identity = identity;
  },

  /**
   * Synchronizes calendars of client's identity with those on EEE
   * server.
   *
   * @returns {calEeeISynchronizer} receiver
   */
  synchronize: function calEeeSynchronizer_synchronize() {
    var synchronizer = this;
    cal3eRequest.Client.getInstance().getCalendars(
      this._identity,
      function calEeeSynchronizer_onGetCalendars(methodQueue, result) {
        if (result instanceof cal3eResponse.UserError) {
          return;
        } else if (!(result instanceof cal3eResponse.Success)) {
          var bundle = Services.strings.createBundle(
            "chrome://calendar3e/locale/cal3eCalendar.properties"
          );
          Services.prompt.alert(
            cal.getCalendarWindow(),
            bundle.GetStringFromName("cal3eAlertDialog.calendarSync.title"),
            bundle.formatStringFromName(
              "cal3eAlertDialog.calendarSync.text",
              [synchronizer._identity.fullName +
               " <" + synchronizer._identity.email + ">"],
              1
            )
          );
          return;
        }

        var knownCalendars = synchronizer._loadEeeCalendarsByUri();

        result.data.forEach(function(data, idx) {
          var uri = synchronizer._buildCalendarUri(data);
          if (!knownCalendars.hasOwnProperty(uri.spec)) {
            synchronizer._addCalendar(data);
          } else {
            synchronizer._updateCalendar(knownCalendars[uri.spec], data);
          }
          delete knownCalendars[uri.spec];
        });

        var uriSpec;
        for (uriSpec in knownCalendars) {
          if (!knownCalendars.hasOwnProperty(uriSpec)) {
            continue;
          }

          synchronizer._deleteCalendar(knownCalendars[uriSpec]);
        }
      }, "owned()");
  },

  /**
   * Builds calendar URI specifiacation from data retrieved from
   * 'getCalendar' method call.
   *
   * @param {Object} data
   * @returns {String}
   */
  _buildCalendarUri: function calEeeSynchronizer_buildCalendarUri(data) {
    return Services.io.newURI(
      'eee://' + data['owner'] + '/' + data['name'], null, null
    );
  },

  /**
   * Adds given calendar build from given data.
   *
   * @param {Object} data
   */
  _addCalendar:
  function calEeeSynchronizer_synchronizeCalendar(data) {
    var manager = Components.classes[
      "@mozilla.org/calendar/manager;1"
    ].getService(Components.interfaces.calICalendarManager);

    var calendar = manager.createCalendar('eee', this._buildCalendarUri(data));
    calendar.setProperty("cache.enabled", true);
    manager.registerCalendar(calendar);

    calendar.setProperty("imip.identity.key", this._identity.key);
    this._setCalendarProperties(calendar, data);
  },

  /**
   * Updates given calendar with given data.
   *
   * @param {calEeeICalendar} calendar
   * @param {nsIDictionary} data
   */
  _updateCalendar:
  function calEeeSynchronizer_synchronizeCalendar(calendar, data) {
    this._setCalendarProperties(calendar, data);
  },

  /**
   * Removes given calendar.
   *
   * @param {calEeeICalendar} calendar
   */
  _deleteCalendar:
  function calEeeSynchronizer_synchronizeCalendar(calendar) {
    var manager = Components.classes[
      "@mozilla.org/calendar/manager;1"
    ].getService(Components.interfaces.calICalendarManager);
    manager.unregisterCalendar(calendar);
  },

  /**
   * Sets properties to calendar according to given raw data from
   * XML-RPC response.
   *
   * @param {calICalendar} calendar
   * @param {nsIDictionary} data
   */
  _setCalendarProperties:
  function calEeeSynchronizer_setCalendarProperties(calendar, data) {
    var attrs = {};
    if (data.hasOwnProperty('attrs')) {
      data['attrs'].forEach(function(attrData) {
        attrs[attrData['name']] = '' + attrData['value'];
      });
    }

    if (attrs['title']) {
      calendar.name = attrs['title'];
    } else {
      calendar.name = '' + data['name'];
    }

    //TODO validation
    if (attrs['color']) {
      calendar.setProperty('color', attrs['color']);
    }
  },

  /**
   * Loads calendars of client's identity and maps them to their URI.
   *
   * @returns {Object}
   */
  _loadEeeCalendarsByUri:
  function calEeeSynchronizer_loadEeeCalendars() {
    var identity = this._identity;
    var eeeCalendars = Components.classes[
      "@mozilla.org/calendar/manager;1"
    ].getService(Components.interfaces.calICalendarManager).
      getCalendars({}).
      filter(function calEeeSynchronizer_filterEeeCalendars(calendar) {
        return ('eee' == calendar.type) &&
          (calendar.getProperty("imip.identity") === identity);
      });
    var calendarsByUri = {};
    var calendar;
    for each (calendar in eeeCalendars) {
      calendarsByUri[calendar.uri.spec] = calendar;
    }

    return calendarsByUri;
  }

}

const NSGetFactory = XPCOMUtils.generateNSGetFactory([
  calEeeSynchronizationService,
  calEeeSynchronizer
]);
