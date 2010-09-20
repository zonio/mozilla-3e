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

var calendar3eResource = "calendar3e";
var ioService = Cc["@mozilla.org/network/io-service;1"]
    .getService(Ci.nsIIOService);
var resourceProtocol = ioService.getProtocolHandler("resource")
    .QueryInterface(Ci.nsIResProtocolHandler);
if (!resourceProtocol.hasSubstitution(calendar3eResource)) {
  var cal3eExtensionId = "calendar3e@zonio.net";
  var em = Components.classes["@mozilla.org/extensions/manager;1"]
      .getService(Ci.nsIExtensionManager);
  var file = em.getInstallLocation(cal3eExtensionId)
      .getItemFile(cal3eExtensionId, "install.rdf");
  var resourceDir = file.parent.clone();
  resourceDir.append("js");
  var resourceDirUri = ioService.newFileURI(resourceDir);
  resourceProtocol.setSubstitution(calendar3eResource, resourceDirUri);
}
Components.utils.import("resource://" + calendar3eResource + "/cal3eClient.js");

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
  this._startSync();
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
   * Maps identities with their 3e clients.
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
          var calendars3e = [], calendarProperties = [],
              idx = -1,
              length = calendars.length,
              calendar, calendarUri, calendar3e,
              properties;
          if (0 < length) {
            while (++idx < length) {
              properties = {
                name: null,
                color: null
              };
              calendar = calendars[idx];
              calendarUri = ioService.newURI("eee://" + client.identity.email + "/" + calendar.name, null, null);
              calendar3e = calendarManager.createCalendar(
                '3e', calendarUri
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
              calendars3e.push(calendar3e);
              calendarProperties.push(properties);
            }
          } else {
          }
          calSync.syncCalendars(calendars3e, calendarProperties);
        },
        onError: function (methodStack) { }
      });
    }
  },

  /**
   * Synchronizes given calendars with already registered calendars.
   *
   * @param {Array} calendars array of cal3eCalendar
   */
  syncCalendars: function (calendars, properties) {
    var console = this._console,
        calendarManager = this._calendarManager,
        currentCalendars = calendarManager.getCalendars({});

    currentCalendars = currentCalendars.filter(function (c) {
      return '3e' == c.type;
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
    var accountManager = this._accountManager;

    var accounts = [
      a for each (a in fixIterator(accountManager.accounts, Ci.nsIMsgAccount))
    ];
    //XXX incomingServer server check due to 41133
    enabledAccounts = accounts.filter(function (a) {
      return a.incomingServer &&
            (a.incomingServer.type != "nntp") &&
            (a.incomingServer.type != "none") &&
             a.defaultIdentity.getBoolAttribute('eee_enabled');
    });

    var map = this._identityClientMap,
        account, identity;
    for each (account in enabledAccounts) {
      identity = account.defaultIdentity;
      map[identity.key] = new cal3eClient(identity);
    }
  },

  /**
   * Adds new 3e client according to added server.
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

    var identity = accounts.defaultIdentity;
    this._identityClientMap[identity.key] = new cal3eClient(identity);
  },

  /**
   * Removes 3e client according to given server.
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

  _startSync: function () {
    var calSync = this;
    function sync() {
      calSync.loadCalendars();
    }
    //window.setInterval(sync, 15000);
  }

}

var sync;
Calendar3e.Sync.onLoad = function () {
  sync = new Calendar3e.Sync();
  sync.loadCalendars();
}

window.addEventListener('load', Calendar3e.Sync.onLoad, false);
