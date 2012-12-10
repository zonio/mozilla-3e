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
Components.utils.import('resource://calendar3e/modules/feature.jsm');
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

  /**
   * Indicator whether syncing is active.
   *
   * @type Boolean
   */
  this._isSyncing = false;
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
    var knownIdentities = this.getSyncedIdentities();

    cal3eIdentity.Collection()
      .getDisabled()
      .filter(function(identity) {
        return knownIdentities.indexOf(identity) >= 0;
      })
      .forEach(this.removeIdentity.bind(this));

    cal3eIdentity.Collection()
      .getEnabled()
      .filter(function(identity) {
        return knownIdentities.indexOf(identity) < 0;
      })
      .forEach(this.addIdentity.bind(this))
      .forEach(this.runSynchronizer.bind(this));
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
      this.runSynchronizer(this.findIdentityOfTimer(subject));
      break;
    case 'network:offline-about-to-go-offline':
      this.stopSyncing();
      break;
    case 'network:offline-status-changed':
      this.startSyncingIfOnline();
      this.stopSyncingIfOffline();
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

    if (cal3eFeature.isSupported('offline_mode')) {
      Services.obs.addObserver(
        this,
        'network:offline-about-to-go-offline',
        false
      );
      Services.obs.addObserver(
        this,
        'network:offline-status-changed',
        false
      );
    }

    this._identityObserver = cal3eIdentity.Observer();
    this._identityObserver.addObserver(this.onIdentityChange.bind(this));
    this.checkSyncing();
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

    if (cal3eFeature.isSupported('offline_mode')) {
      Services.obs.removeObserver(
        this,
        'network:offline-about-to-go-offline'
      );
      Services.obs.removeObserver(
        this,
        'network:offline-status-changed'
      );
    }

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

    return this;
  },

  /**
   * Removes identity from periodical calendar synchronization.
   *
   * @param {String} identity
   * @returns {calEeeISynchronizationService} receiver
   */
  removeIdentity: function calEeeSyncService_removeIdentity(identity) {
    this.stopSynchronizer(identity);
    delete this._timersByIdentity[identity.key];
    delete this._synchronizersByIdentity[identity.key];
    this.unregisterCalendarsOfIdentity(identity);

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
    if (!this._isSyncing || !this.has(identity)) {
      return this;
    }

    var synchronizationService = this;
    this._synchronizersByIdentity[identity.key]
      .synchronize()
      .whenDone(function() {
        synchronizationService._timersByIdentity[identity.key].init(
          synchronizationService,
          Services.prefs.getIntPref(
            'extensions.calendar3e.calendar_sync_interval'),
          Components.interfaces.nsITimer.TYPE_ONE_SHOT
        );
      });

    return this;
  },

  stopSynchronizer: function calEeeSyncService_stopSynchronizer(identity) {
    this._timersByIdentity[identity.key].cancel();
    this._synchronizersByIdentity[identity.key].cancel();
  },

  checkSyncing: function calEeeSyncService_checkSyncing() {
    this._isSyncing = !Services.io.offline;

    return this._isSyncing;
  },

  startSyncingIfOnline: function calEeeSyncService_startSyncingIfOnline() {
    if (!this.checkSyncing()) {
      return;
    }

    this.getSyncedIdentities().forEach(this.runSynchronizer.bind(this));
  },

  stopSyncingIfOffline: function calEeeSyncService_stopSyncingIfOffline() {
    var wasSyncing = this._isSyncing;
    if (this.checkSyncing() || (wasSyncing === this._isSyncing)) {
      return;
    }

    this.stopSyncing();
  },

  stopSyncing: function calEeeSyncService_stopSyncing(identities) {
    //XXX Stop syncing can be called before Services.io.offline is
    // changed to true, so it is benefitial to set our internal state
    // to not syncing even now.
    this._isSyncing = false;
    this.getSyncedIdentities().forEach(this.stopSynchronizer.bind(this));
  },

  /**
   * Tries to find identity (its key) of given timer.
   *
   * @param {nsITimer} timer
   * @returns {nsIMsgIdentity|null}
   */
  findIdentityOfTimer: function calEeeSyncService_findIdentityOfTimer(timer) {
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
  unregisterCalendarsOfIdentity:
  function calEeeService_unregisterCalendarsOfIdentity(identity) {
    this.getIdentityCalendars(identity).forEach(function(calendar) {
      Components.classes['@mozilla.org/calendar/manager;1']
        .getService(Components.interfaces.calICalendarManager)
        .unregisterCalendar(calendar);
    });
  },

  getIdentityCalendars:
  function calEeeService_getIdentityCalendars(identity) {
    return Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .getCalendars({})
      .filter(function(calendar) {
        return (calendar.type === 'eee') &&
          (calendar.getProperty('imip.identity') === identity);
      });
  },

  getSyncedIdentities: function calEeeSyncService_getSyncedIdentities() {
    return cal3eIdentity.Collection().filter(this.has.bind(this));
  },

  has: function calEeeSyncService_has(identity) {
    return this._synchronizersByIdentity[identity.key] &&
      this._timersByIdentity[identity.key];
  }

};

function Synchronizer(identity) {
  var synchronizer = this;
  var operation;
  var future;

  function synchronize() {
    future = new cal3eSynchronization.Future();
    operation = cal3eRequest.Client.getInstance().getCalendars(
      identity,
      function Synchronizer_onGetCalendars(result) {
        operation = null;

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

  function cancel() {
    if (!operation) {
      return;
    }

    operation.cancel();
    future.done();
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
    return Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .getCalendars({})
      .filter(function(calendar) {
        return (calendar.type === 'eee') &&
          (calendar.getProperty('imip.identity') === identity);
      })
      .reduce(function(calendarsByUri, calendar) {
        calendarsByUri[calendar.uri.spec] = calendar;

        return calendarsByUri;
      }, {});
  }

  synchronizer.synchronize = synchronize;
  synchronizer.cancel = cancel;
}

const NSGetFactory = XPCOMUtils.generateNSGetFactory([
  calEeeSynchronizationService
]);
