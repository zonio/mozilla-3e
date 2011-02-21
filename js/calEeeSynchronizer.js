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

Components.utils.import("resource://calendar3e/cal3eUtils.jsm");

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
  this._synchronizer = Cc["@zonio.net/calendar3e/synchronizer;1"].
    createInstance(Ci.calEeeISynchronizer);

  /**
   * Collection of account dynamically notifying of changes in
   * accounts settings.
   *
   * @type cal3e.AccountCollection
   */
  this._accountCollection = new cal3e.AccountCollection();
}

calEeeSynchronizationService.prototype = {

  QueryInterface: XPCOMUtils.generateQI([
    Ci.calEeeISynchronizationService,
    Ci.nsIObserver
  ]),

  /**
   * Adds or removes identities according to state of account
   * collection.
   *
   * @param {cal3e.AccountCollection} accountCollection
   */
  onAccountsChange:
  function calEeeSyncService_onAccountsChange(accountCollection) {
    var knownIdentities = {};
    var identityKey;
    for (identityKey in this._timersByIdentity) {
      if (!this._timersByIdentity.hasOwnProperty(identityKey)) {
        continue;
      }
      knownIdentities[identityKey] = true;
    }

    var identities = accountCollection.
      filter(cal3e.AccountCollection.filterEnabled).
      map(function calEeeSyncService_mapAccountsToIdentities(account) {
        return account.defaultIdentity;
      }).
      filter(function calEeeSyncService_filterUnknownIdentities(identity) {
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
   * Calls {@link register} when Thunderbird starts.
   *
   * @param {nsISupports} subject
   * @param {String} topic
   * @param {String} data
   */
  observe: function calEeeSyncService_observe(subject, topic, data) {
    switch (topic) {
    case 'profile-do-change':
      this.register();
      break;
    case 'timer-callback':
      this.runSynchronizer(this._findIdentityOfTimer(subject));
      break;
    }
  },

  /**
   * Registers synchronization service to globally observe account changes
   * and synchronize their EEE calendars.
   *
   * @returns {calEeeISynchronizationService} receiver
   */
  register: function calEeeSyncService_register() {
    if (this._registered) {
      return this;
    }
    this._registered = true;
    this._accountCollection.addObserver(this);
    this.onAccountsChange(this._accountCollection);

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
      Cc["@zonio.net/calendar3e/synchronizer;1"].
      createInstance(Ci.calEeeISynchronizer);
    this._synchronizersByIdentity[identity.key].client =
      Cc["@zonio.net/calendar3e/client;1"].
      createInstance(Ci.calEeeIClient);
    this._synchronizersByIdentity[identity.key].client.identity = identity;

    this._synchronizersByIdentity[identity.key].synchronize();

    this._timersByIdentity[identity.key] = Cc["@mozilla.org/timer;1"].
      createInstance(Ci.nsITimer);
    this._timersByIdentity[identity.key].init(
      this, 15000, Ci.nsITimer.TYPE_REPEATING_SLACK);

    return this;
  },

  /**
   * Removes identity from periodical calendar synchronization.
   *
   * @param {String} identity
   * @returns {calEeeISynchronizationService} receiver
   */
  removeIdentity: function calEeeSyncService_removeAccount(identityKey) {
    this._timersByIdentity[identityKey].cancel();
    delete this._timersByIdentity[identityKey];
    delete this._synchronizersByIdentity[identityKey];

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
    timer = timer.QueryInterface(Ci.nsITimer);
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
  }

};

/**
 * Synchronizer of calendars present in Mozilla client application
 * (i.e. Lightning) with those on EEE server.
 */
function calEeeSynchronizer() {
  this._client = null;
}

calEeeSynchronizer.prototype = {

  QueryInterface: XPCOMUtils.generateQI([
    Ci.calEeeISynchronizer
  ]),

  get client() {
    return this._client;
  },

  set client(client) {
    this._client = client;
  },

  /**
   * Synchronizes calendars of client's identity with those on EEE
   * server.
   *
   * @param {calEeeIClient} client
   * @returns {calEeeISynchronizer} receiver
   */
  synchronize: function calEeeSynchronizer_synchronize() {
    var synchronizer = this;
    this._client.getCalendars(cal3e.createOperationListener(
      function calEeeSynchronizer_onGetCalendars(methodQueue, result) {
        if (Components.results.NS_OK !== methodQueue.status) {
          throw Components.Exception("Cannot retrieve calendar",
                                     methodQueue.status);
        }

        var knownCalendars = synchronizer._loadEeeCalendarsByUri(
          synchronizer.client.identity);
        var calendars = result.QueryInterface(Ci.nsISupportsArray);
        var idx = calendars.Count(), data, uri;
        while (idx--) {
          data = calendars.QueryElementAt(idx, Ci.nsIDictionary);
          uri = synchronizer._buildCalendarUri(data);
          if (!knownCalendars.hasOwnProperty(uri.spec)) {
            synchronizer._addCalendar(data);
          } else {
            synchronizer._updateCalendar(knownCalendars[uri.spec], data);
          }
          delete knownCalendars[uri.spec];
        }

        var uriSpec;
        for (uriSpec in knownCalendars) {
          if (!knownCalendars.hasOwnProperty(uriSpec)) {
            continue;
          }

          synchronizer._deleteCalendar(knownCalendars[uriSpec]);
        }
      }), "owned()");
  },

  /**
   * Builds calendar URI specifiacation from data retrieved from
   * 'getCalendar' method call.
   *
   * @param {nsIDictionary} data
   * @returns {String}
   */
  _buildCalendarUri: function calEeeSynchronizer_buildCalendarUri(data) {
    var ioService = Cc["@mozilla.org/network/io-service;1"]
      .getService(Ci.nsIIOService);

    return ioService.newURI(
      'eee://' +
        data.getValue('owner').QueryInterface(Ci.nsISupportsCString) +
        '/' +
        data.getValue('name').QueryInterface(Ci.nsISupportsCString),
      null, null);
  },

  /**
   * Adds given calendar build from given data.
   *
   * @param {nsIDictionary} data
   */
  _addCalendar:
  function calEeeSynchronizer_synchronizeCalendar(data) {
    var manager = Cc["@mozilla.org/calendar/manager;1"].
      getService(Ci.calICalendarManager);

    var calendar = manager.createCalendar('eee', this._buildCalendarUri(data));
    manager.registerCalendar(calendar);

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
    var manager = Cc["@mozilla.org/calendar/manager;1"].
      getService(Ci.calICalendarManager);
    manager.unregisterCalendar(calendar);
  },

  /**
   * Sets properties to calendar according to given raw data from
   * XML-RPC response.
   *
   * @param {calEeeICalendar} calendar
   * @param {nsIDictionary} data
   */
  _setCalendarProperties:
  function calEeeSynchronizer_setCalendarProperties(calendar, data) {
    var attrs = !data.hasKey('attrs') ?
      data.getValue('attrs').QueryInterface(Ci.nsIDictionary) :
      null ;

    if (attrs && attrs.hasKey('title')) {
      calendar.name = '' + attrs.getValue('title').
        QueryInterface(Ci.nsISupportsCString);
    } else {
      calendar.name = '' +
        data.getValue('name').QueryInterface(Ci.nsISupportsCString);
    }

    if (attrs && attrs.hasKey('color')) {
      calendar.setProperty(
        'color',
        '' + data.getValue('name').QueryInterface(Ci.nsISupportsCString));
    }
  },

  /**
   * Loads calendars of given identity and maps them to their URI.
   *
   * @param {nsIMsgIdentity} identity
   * @returns {Object}
   */
  _loadEeeCalendarsByUri:
  function calEeeSynchronizer_loadEeeCalendars(identity) {
    var eeeCalendars = Cc["@mozilla.org/calendar/manager;1"].
      getService(Ci.calICalendarManager).
      getCalendars({}).
      filter(function calEeeSynchronizer_filterEeeCalendars(calendar) {
        return 'eee' == calendar.type;
      });
      //TODO could be nice to allow this conversion
      // map(function calEeeSynchronizer_mapEeeCalendars(calendar) {
      //   return calendar.QueryInterface(Ci.calEeeICalendar);
      // })
    var calendarsByUri = {};
    var calendar;
    for each (calendar in eeeCalendars) {
      calendarsByUri[calendar.uri.spec] = calendar;
    }

    return calendarsByUri;
  }

};
