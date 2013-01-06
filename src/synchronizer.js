/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2011-2013  Zonio s.r.o.
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

Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://calendar/modules/calUtils.jsm');
Components.utils.import('resource://calendar3e/modules/feature.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/logger.jsm');
Components.utils.import('resource://calendar3e/modules/model.jsm');
Components.utils.import('resource://calendar3e/modules/object.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');
Components.utils.import('resource://calendar3e/modules/synchronization.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function calEeeSynchronizationService() {
  var synchronizationService = this;
  var timersByIdentity;
  var synchronizersByIdentity;
  var identityObserver;
  var isSyncing;
  var logger;

  function onIdentityChange() {
    logger.info('Identity change - initializing');

    var knownIdentities = getSyncedIdentities();

    cal3eIdentity.Collection()
      .getDisabled()
      .filter(function(identity) {
        return knownIdentities.indexOf(identity) >= 0;
      })
      .forEach(removeIdentity);

    cal3eIdentity.Collection()
      .getEnabled()
      .filter(function(identity) {
        return knownIdentities.indexOf(identity) < 0;
      })
      .forEach(addIdentity)
      .forEach(runSynchronizer);
  }

  function observe(subject, topic, data) {
    switch (topic) {
    case 'profile-after-change':
      logger.info('Registration - initializing');
      registerAfterMainWindowOpen();
      break;
    case 'timer-callback':
      runSynchronizer(findIdentityOfTimer(subject));
      break;
    case 'network:offline-about-to-go-offline':
      stopSyncing();
      break;
    case 'network:offline-status-changed':
      startSyncingIfOnline();
      stopSyncingIfOffline();
      break;
    }
  }
  cal3eObject.exportMethod(this, observe);

  function registerAfterMainWindowOpen() {
    //XXX WindowMediator nor WindowWatcher don't work and
    // final-ui-startup startup category isn't what we want
    var timer = Components.classes['@mozilla.org/timer;1']
      .createInstance(Components.interfaces.nsITimer);
    if (!mainWindowObserver(timer)) {
      logger.info('Registration - waiting for mail window');
      timer.init(
        cal3eObject.asXpcomObserver(mainWindowObserver),
        100,
        Components.interfaces.nsITimer.TYPE_REPEATING_SLACK
      );
    }
  }

  function mainWindowObserver(timer) {
    var mailWindow = Services.wm.getMostRecentWindow('mail:3pane');
    if (!mailWindow) {
      return false;
    }
    logger.info('Registration - mail window found');

    timer.cancel();
    registerOnReady(mailWindow.document);

    return true;
  }

  function registerOnReady(document) {
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
          logger.info('Registration - mail window ready');
          register();
        },
        false
      );
    } else {
      logger.info('Registration - mail window ready');
      register();
    }
  }

  function register() {
    if (register.registered) {
      return synchronizationService;
    }
    register.registered = true;
    logger.info('Registration - done');

    if (cal3eFeature.isSupported('offline_mode')) {
      Services.obs.addObserver(
        synchronizationService,
        'network:offline-about-to-go-offline',
        false
      );
      Services.obs.addObserver(
        synchronizationService,
        'network:offline-status-changed',
        false
      );
    }

    identityObserver = cal3eIdentity.Observer();
    identityObserver.addObserver(onIdentityChange);
    checkSyncing();
    onIdentityChange();

    return synchronizationService;
  }

  function unregister() {
    if (!register.registered) {
      return synchronizationService;
    }
    identityObserver.destroy();

    if (cal3eFeature.isSupported('offline_mode')) {
      Services.obs.removeObserver(
        synchronizationService,
        'network:offline-about-to-go-offline'
      );
      Services.obs.removeObserver(
        synchronizationService,
        'network:offline-status-changed'
      );
    }

    register.registered = false;

    return synchronizationService;
  }

  function addIdentity(identity) {
    logger.info('Identity change - adding "' + identity.key + '"');

    synchronizersByIdentity[identity.key] = new Synchronizer(identity, logger);
    timersByIdentity[identity.key] = Components.classes[
      '@mozilla.org/timer;1'
    ].createInstance(Components.interfaces.nsITimer);
  }

  function removeIdentity(identity) {
    logger.info('Identity change - removing "' + identity.key + '"');

    stopSynchronizer(identity);
    delete timersByIdentity[identity.key];
    delete synchronizersByIdentity[identity.key];
    unregisterCalendarsOfIdentity(identity);
  }

  function runSynchronizer(identity) {
    if (!isSyncing || !isSyncedIdentity(identity)) {
      return;
    }

    synchronizersByIdentity[identity.key]
      .synchronize()
      .whenDone(function() {
        timersByIdentity[identity.key].init(
          synchronizationService,
          Services.prefs.getIntPref(
            'extensions.calendar3e.calendar_sync_interval'),
          Components.interfaces.nsITimer.TYPE_ONE_SHOT
        );
      });
  }

  function stopSynchronizer(identity) {
    timersByIdentity[identity.key].cancel();
    synchronizersByIdentity[identity.key].cancel();
  }

  function checkSyncing() {
    isSyncing = !Services.io.offline;

    return isSyncing;
  }

  function startSyncingIfOnline() {
    if (!checkSyncing()) {
      return;
    }

    getSyncedIdentities().forEach(runSynchronizer);
  }

  function stopSyncingIfOffline() {
    var wasSyncing = isSyncing;
    if (checkSyncing() || (wasSyncing === isSyncing)) {
      return;
    }

    stopSyncing();
  }

  function stopSyncing(identities) {
    //XXX Stop syncing can be called before Services.io.offline is
    // changed to true, so it is benefitial to set our internal state
    // to not syncing even now.
    isSyncing = false;
    getSyncedIdentities().forEach(stopSynchronizer);
  }

  function findIdentityOfTimer(timer) {
    timer = timer.QueryInterface(Components.interfaces.nsITimer);

    var identityKey;
    var found = false;
    for (identityKey in timersByIdentity) {
      if (!timersByIdentity.hasOwnProperty(identityKey)) {
        continue;
      }

      if (timer === timersByIdentity[identityKey]) {
        found = true;
        break;
      }
    }

    return found ?
      Components.classes['@mozilla.org/messenger/account-manager;1']
      .getService(Components.interfaces.nsIMsgAccountManager)
      .getIdentity(identityKey) :
      null;
  }

  function unregisterCalendarsOfIdentity(identity) {
    getIdentityCalendars(identity).forEach(function(calendar) {
      Components.classes['@mozilla.org/calendar/manager;1']
        .getService(Components.interfaces.calICalendarManager)
        .unregisterCalendar(calendar);
    });
  }

  function getIdentityCalendars(identity) {
    return Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .getCalendars({})
      .filter(function(calendar) {
        return (calendar.type === 'eee') &&
          (calendar.getProperty('imip.identity.key') === identity.key);
      });
  }

  function getSyncedIdentities() {
    return cal3eIdentity.Collection().filter(isSyncedIdentity);
  }

  function isSyncedIdentity(identity) {
    return synchronizersByIdentity[identity.key] &&
      timersByIdentity[identity.key];
  }

  function init() {
    timersByIdentity = {};
    synchronizersByIdentity = {};
    identityObserver = null;
    isSyncing = false;
    logger = cal3eLogger.create('extensions.calendar3e.log.synchronizer');
  }

  init();
}

function Synchronizer(identity, logger) {
  var synchronizer = this;
  var operation;
  var future;

  function synchronize() {
    logger.info('Synchronization - syncing calendars of identity "' +
                identity.key + '"');

    future = new cal3eSynchronization.Future();
    operation = cal3eRequest.Client.getInstance().getCalendars(
      identity,
      function Synchronizer_onGetCalendars(result) {
        operation = null;

        if (result instanceof cal3eResponse.UserError) {
          logger.warn("Synchronization - can't sync calendars of identity " +
                      identity.key + '" because of error ' +
                      result.constructor.name + '(' + result.errorCode + ')');

          future.done();
          return;
        } else if (!(result instanceof cal3eResponse.Success)) {
          logger.warn("Synchronization - can't sync calendars of identity " +
                      identity.key + '" because of error ' +
                      result.constructor.name + '(' + result.errorCode + ')');

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

        logger.info('Synchronization - received calendars of identity "' +
                    identity.key + '"');
        synchronizeCalendarsFromResult(result);

        future.done();
      },
      'owned() OR subscribed()'
    );

    return future.returnValue();
  }

  function synchronizeCalendarsFromResult(result) {
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
  }

  function cancel() {
    if (!operation) {
      return;
    }

    logger.info('Synchronization - canceling syncing of calendars of ' +
                'identity "' + identity.key + '"');

    operation.cancel();
    future.done();
  }

  function buildCalendarUri(data) {
    return cal3eModel.buildUri({
      'protocol': 'eee',
      'user': identity.email,
      'owner': data['owner'],
      'name': data['name']
    });
  }

  function addCalendar(data) {
    logger.info('Synchronization - adding the calendar "' +
                buildCalendarUri(data) + '"');

    var manager = Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager);

    var calendar = manager.createCalendar('eee', buildCalendarUri(data));
    manager.registerCalendar(calendar);

    calendar.setProperty('imip.identity.key', identity.key);
    setCalendarProperties(calendar, data);
  }

  function updateCalendar(calendar, data) {
    logger.info('Synchronization - updating the calendar "' +
                calendar.uri.spec + '"');

    setCalendarProperties(calendar, data);
  }

  function deleteCalendar(calendar) {
    logger.info('Synchronization - deleting the calendar "' +
                calendar.uri.spec + '"');

    Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .unregisterCalendar(calendar);
  }

  function setCalendarProperties(calendar, data) {
    calendar.name = cal3eModel.calendarLabel(data);
    calendar.readOnly = data['perm'] === 'read';

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
          (calendar.getProperty('imip.identity.key') === identity.key);
      })
      .reduce(function(calendarsByUri, calendar) {
        calendarsByUri[calendar.uri.spec] = calendar;

        return calendarsByUri;
      }, {});
  }

  synchronizer.synchronize = synchronize;
  synchronizer.cancel = cancel;
}

const NSGetFactory = cal3eObject.asXpcom(calEeeSynchronizationService, {
  classID: Components.ID('{d7a08a5f-46ad-4a84-ad66-1cc27e9f388e}'),
  contractID: '@zonio.net/calendar3e/synchronization-service;1',
  classDescription: 'EEE calendar synchronization service',
  interfaces: [Components.interfaces.nsIObserver],
  flags: Components.interfaces.nsIClassInfo.SINGLETON
});
