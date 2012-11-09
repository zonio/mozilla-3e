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

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://calendar/modules/calUtils.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/model.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');
Components.utils.import('resource://calendar3e/modules/synchronization.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

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
   * Observer of changes in identities.
   *
   * @type Object
   */
  this._identityObserver = null;
}

calEeeSynchronizationService.classInfo = XPCOMUtils.generateCI({
  classID: Components.ID('{d7a08a5f-46ad-4a84-ad66-1cc27e9f388e}'),
  contractID: '@zonio.net/calendar3e/synchronization-service;1',
  classDescription: 'EEE calendar synchronization service',
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
    calEeeSynchronizationService.classInfo.getInterfaces({})
  ),

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

    var synchronizationService = this;
    cal3eIdentity.Collection()
      .getEnabled()
      .filter(function(identity) {
        return !knownIdentities.hasOwnProperty(identity.key) ||
          !knownIdentities[identity.key];
      })
      .forEach(function(identity) {
        synchronizationService.addIdentity(identity);
      });

    cal3eIdentity.Collection()
      .getDisabled()
      .filter(function(identity) {
        return knownIdentities.hasOwnProperty(identity.key) &&
          knownIdentities[identity.key];
      })
      .forEach(function(identity) {
        synchronizationService.removeIdentity(identity);
      });
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
      this.registerAfterMainWindowOpen();
      break;
    case 'timer-callback':
      this.runSynchronizer(this._findIdentityOfTimer(subject));
      break;
    }
  },

  registerAfterMainWindowOpen:
  function calEeeSyncService_registerAfterMainWindowOpen() {
    //XXX WindowMediator nor WindowWatcher don't work and
    // final-ui-startup startup category isn't what we want
    var timer = Components.classes['@mozilla.org/timer;1']
      .createInstance(Components.interfaces.nsITimer);
    var mainWindowObserver = this._mainWindowObserver.bind(this);
    if (!mainWindowObserver(timer)) {
      timer.init({
        QueryInterface: XPCOMUtils.generateQI([
          Components.interfaces.nsIObserver
        ]),
        observe: mainWindowObserver
      }, 100, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
    }
  },

  _mainWindowObserver: function calEeeSyncService_windowObserver(timer) {
    var mailWindow = Services.wm.getMostRecentWindow('mail:3pane');
    if (!mailWindow) {
      return false;
    }

    timer.cancel();
    this.registerOnReady(mailWindow.document);

    return true;
  },

  registerOnReady: function calEeeSyncService_registerOnReady(document) {
    var synchronizationService = this;
    if (document.readyState !== 'complete') {
      document.addEventListener(
        'readystatechange',
        function onStateChange() {
          if (document.readyState !== 'complete') {
            return;
          }

          document.removeEventListener(
            'readystatechange', onStateChange, false
          );
          synchronizationService.register();
        },
        false
      );
    } else {
      this.register();
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
    this._identityObserver = cal3eIdentity.Observer();
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
    this._synchronizersByIdentity[identity.key] = new Synchronizer(identity);

    this._timersByIdentity[identity.key] = Components.classes[
      '@mozilla.org/timer;1'
    ].createInstance(Components.interfaces.nsITimer);
    this._timersByIdentity[identity.key].init(
      this,
      1,
      Components.interfaces.nsITimer.TYPE_ONE_SHOT
    );

    return this;
  },

  /**
   * Removes identity from periodical calendar synchronization.
   *
   * @param {String} identity
   * @returns {calEeeISynchronizationService} receiver
   */
  removeIdentity: function calEeeSyncService_removeIdentity(identity) {
    this._timersByIdentity[identity.key].cancel();
    delete this._timersByIdentity[identity.key];
    delete this._synchronizersByIdentity[identity.key];
    this._unregisterCalendarsOfIdentity(identity);

    return this;
  },

  /**
   * Runs synchronizer of given identity.
   *
   * If identity's synchronizer is not found, nothing happens.
   *
   * @param {nsIMsgIdentity} identity
   * @returns {calEeeISynchronizationService} receiver
   */
  runSynchronizer: function calEeeSyncService_runSynchronizer(identity) {
    if (!this._synchronizersByIdentity[identity.key]) {
      return this;
    }

    var synchronizationService = this;
    this._synchronizersByIdentity[identity.key]
      .synchronize()
      .whenDone(function() {
        synchronizationService._timersByIdentity[identity.key].init(
          synchronizationService,
          Services.prefs.getIntPref('calendar.eee.calendar_sync_interval'),
          Components.interfaces.nsITimer.TYPE_ONE_SHOT
        );
      });

    return this;
  },

  /**
   * Tries to find identity (its key) of given timer.
   *
   * @param {nsITimer} timer
   * @returns {nsIMsgIdentity|null}
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

    return found ?
      Components.classes['@mozilla.org/messenger/account-manager;1']
      .getService(Components.interfaces.nsIMsgAccountManager)
      .getIdentity(identityKey) :
      null;
  },

  /**
   * Unregisters all identity's calendars.
   *
   * @param {nsIMsgIdentity} identity
   */
  _unregisterCalendarsOfIdentity:
  function calEeeService_unregisterCalendarsOfIdentity(identity) {
    var manager = Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager);
    manager
      .getCalendars({})
      .filter(function(calendar) {
        return (calendar.type === 'eee') &&
          calendar.getProperty('imip.identity') &&
          (calendar.getProperty('imip.identity') === identity);
      })
      .forEach(function(calendar) {
        manager.unregisterCalendar(calendar);
      });
  }

};

function Synchronizer(identity) {
  var synchronizer = this;

  function synchronize() {
    var future = new cal3eSynchronization.Future();

    cal3eRequest.Client.getInstance().getCalendars(
      identity,
      function Synchronizer_onGetCalendars(result) {
        if (result instanceof cal3eResponse.UserError) {
          future.done();
          return;
        } else if (!(result instanceof cal3eResponse.Success)) {
          var bundle = Services.strings.createBundle(
            'chrome://calendar3e/locale/cal3eCalendar.properties'
          );
          Services.prompt.alert(
            cal.getCalendarWindow(),
            bundle.GetStringFromName('cal3eAlertDialog.calendarSync.title'),
            bundle.formatStringFromName(
              'cal3eAlertDialog.calendarSync.text',
              [identity.fullName + ' <' + identity.email + '>'],
              1
            )
          );
          future.done();
          return;
        }

        var knownCalendars = loadEeeCalendarsByUri();

        result.data.forEach(function(data, idx) {
          var uri = buildCalendarUri(data);
          if (!knownCalendars.hasOwnProperty(uri.spec)) {
            addCalendar(data);
          } else {
            updateCalendar(knownCalendars[uri.spec], data);
          }
          delete knownCalendars[uri.spec];
        });

        var uriSpec;
        for (uriSpec in knownCalendars) {
          if (!knownCalendars.hasOwnProperty(uriSpec)) {
            continue;
          }

          deleteCalendar(knownCalendars[uriSpec]);
        }

        future.done();
      },
      'owned()'
    );

    return future.returnValue();
  }

  function buildCalendarUri(data) {
    return Services.io.newURI(
      'eee://' + data['owner'] + '/' + data['name'], null, null
    );
  }

  function addCalendar(data) {
    var manager = Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager);

    var calendar = manager.createCalendar('eee', buildCalendarUri(data));
    calendar.setProperty('cache.enabled', true);
    manager.registerCalendar(calendar);

    calendar.setProperty('imip.identity.key', identity.key);
    setCalendarProperties(calendar, data);
  }

  function updateCalendar(calendar, data) {
    setCalendarProperties(calendar, data);
  }

  function deleteCalendar(calendar) {
    Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .unregisterCalendar(calendar);
  }

  function setCalendarProperties(calendar, data) {
    calendar.name = cal3eModel.calendarLabel(data);

    //TODO validation
    if (cal3eModel.attribute(data, 'color')) {
      calendar.setProperty('color', cal3eModel.attribute(data, 'color'));
    }
  }

  function loadEeeCalendarsByUri() {
    var eeeCalendars = Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .getCalendars({})
      .filter(function(calendar) {
        return (calendar.type === 'eee') &&
          (calendar.getProperty('imip.identity') === identity);
      });
    var calendarsByUri = {};
    var calendar;
    for each (calendar in eeeCalendars) {
      calendarsByUri[calendar.uri.spec] = calendar;
    }

    return calendarsByUri;
  }

  synchronizer.synchronize = synchronize;
}

const NSGetFactory = XPCOMUtils.generateNSGetFactory([
  calEeeSynchronizationService
]);
