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

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://calendar3e/cal3eUtils.jsm");

/**
 * Top-level 3e calendar provider namespace.
 *
 * @namespace
 * @name Calendar3e
 */
if ('undefined' === typeof Calendar3e) {
  var Calendar3e = {};
}

/**
 * Calendar synchronization provider.
 *
 * @todo parametrized timeout
 * @todo different interval for each account/client
 */
Calendar3e.Sync = function () {
  var console = Cc["@mozilla.org/consoleservice;1"].getService(
      Ci.nsIConsoleService
    );
  this._console = console;

  var accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(
      Ci.nsIMsgAccountManager
    );
  accountManager.addIncomingServerListener(this);
  this._accountManager = accountManager;

  var calendarManager = Cc["@mozilla.org/calendar/manager;1"]
    .getService(Ci.calICalendarManager);
  this._calendarManager = calendarManager;

  this._initClients();
}

Calendar3e.Sync.prototype = {

  /**
   * Thunderbird's error console.
   *
   * @type nsIConsoleService
   * @todo replace by Log4Moz
   */
  _console: undefined,

  /**
   * Thunderbird's account manager.
   *
   * @type nsIMsgAccountManager
   */
  _accountManager: undefined,

  /**
   * Thunderbird's calendar manager.
   *
   * @type calICalendarManager
   */
  _calendarManager: undefined,

  /**
   * Maps identities with their EEE clients.
   *
   * @type Object
   */
  _identityClientMap: {},

  /**
   * Identifier of interval used by sync.
   *
   * @type numeric
   */
  _syncId: undefined,

  /**
   * Loads calendars for every account and then synchronizes them with what
   * is currently registered.
   */
  loadCalendars: function () {
    var console = this._console,
        calendarManager = this._calendarManager;

    var map = this._identityClientMap,
        identityKey, client;
    for (identityKey in map) {
      client = map[identityKey];

      calSync = this;
      client.getCalendars("match_owner('" + client.identity.email + "')", {
        onSuccess: function (calendars, methodStack) {
          var calendarsEee = [], calendarProperties = [],
              idx = -1,
              length = calendars.length,
              calendar, calendarUri, calendarEee,
              properties;
          if (0 < length) {
            while (++idx < length) {
              properties = {
                name: null,
                color: null
              };
              calendar = calendars[idx];
              calendarUri = ioService.newURI("eee://" + client.identity.email + "/" + calendar.name, null, null);
              calendarEee = calendarManager.createCalendar(
                'eee', calendarUri
              );
              for each (var attr in calendar.attrs) {
                switch (attr.name) {
                case 'title':
                  properties.name = attr.value;
                  break;
                case 'color':
                  properties.color = attr.value;
                  break;
                }
              }
              if (null === properties.name) {
                properties.name = calendar.name;
              }
              calendarsEee.push(calendarEee);
              calendarProperties.push(properties);
            }
          } else {
          }
          calSync.syncCalendars(calendarsEee, calendarProperties);
        },
        onError: function (methodStack) { }
      });
    }
  },

  /**
   * Synchronizes given calendars with already registered calendars.
   *
   * @param {Array} calendars array of calEeeCalendar
   */
  syncCalendars: function (calendars, properties) {
    var console = this._console,
        calendarManager = this._calendarManager,
        currentCalendars = calendarManager.getCalendars({});

    currentCalendars = currentCalendars.filter(function (c) {
      return 'eee' == c.type;
    });
    var newCalendars = calendars.filter(function (c) {
      var isNew = true, current;
      for each (current in currentCalendars) {
        if (c.uri.equals(current.uri)) {
          isNew = false;
          break;
        }
      }

      return isNew;
    });

    var idx = calendars.length,
        calendar, props;
    while (idx--) {
      calendar = calendars[idx];
      props = properties[idx];
      calendarManager.registerCalendar(calendar);
      calendar.name = props.name;
      if (null !== props.color) {
        calendar.setProperty('color', props.color);
      }
    }
  },

  /**
   * Initializes identity to client map.
   */
  _initClients: function () {
    var clientClass = Cc["@zonio.net/calendar3e/client;1"];
    var accountCollection = new cal3e.AccountCollection();
    var enabledAccounts = accountCollection.filter(
          cal3e.AccountCollection.filterEnabled),
        map = this._identityClientMap,
        account, client, identity;
    for each (account in enabledAccounts) {
      identity = account.defaultIdentity;
      client = clientClass.createInstance(Ci.calEeeIClient);
      client.identity = identity;
      map[identity.key] = client;
    }
  },

  /**
   * Adds new EEE client according to added server.
   *
   * Implemented according to nsIIncomingServerListener.
   *
   * @param {nsIMsgIncomingServer} server
   */
  onServerLoaded: function (server) {
    var accountManager = this._accountManager,
        account = accountManager.FindAccountForServer(server);
    if (null === account) {
      return
    }

    var identity = accounts.defaultIdentity,
	client = Cc["@zonio.net/calendar3e/client;1"].createInstance(
	    Ci.calEeeIClient);
    client.identity = identity;
    this._identityClientMap[identity.key] = client;
  },

  /**
   * Removes EEE client according to given server.
   *
   * Implemented according to nsIIncomingServerListener.
   *
   * @param {nsIMsgIncomingServer} server
   */
  onServerUnloaded: function (server) {
    var accountManager = this._accountManager,
        account = accountManager.FindAccountForServer(server);
    if (null === account) {
      return
    }

    var identity = accounts.defaultIdentity;
    delete this._identityClientMap[identity.key];
  },

  /**
   * Does nothing.
   *
   * Implemented according to nsIIncomingServerListener.
   *
   * @param {nsIMsgIncomingServer} server
   */
  onServerChanged: function (server) { },

  startSync: function () {
    var calSync = this;
    function sync() {
      calSync.loadCalendars();
    }
    window.setInterval(sync, 15000);
  }

}

var sync;
Calendar3e.Sync.onLoad = function () {
  sync = new Calendar3e.Sync();
  //sync.loadCalendars();
}

window.addEventListener('load', Calendar3e.Sync.onLoad, false);
