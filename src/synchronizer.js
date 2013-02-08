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

    timer.QueryInterface(Components.interfaces.nsITimer).cancel();
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
      logger.info('Registration - mail window already ready');
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
    logger.info('Identity change - adding "' + identity.email + '"');

    synchronizersByIdentity[identity.key] = new Synchronizer(identity, logger);
    timersByIdentity[identity.key] = Components.classes[
      '@mozilla.org/timer;1'
    ].createInstance(Components.interfaces.nsITimer);
  }

  function removeIdentity(identity) {
    logger.info('Identity change - removing "' + identity.email + '"');

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
  var currentOperation;
  var future;
  var lastAttemptWasSuccessful;

  function synchronize() {
    future = new cal3eSynchronization.Future();
    loadCalendars(future);

    return future.returnValue();
  }

  function loadCalendars(future) {
    currentOperation = cal3eRequest.Client.getInstance().getCalendars(
      identity, getDidLoadCalendars(future), 'owned() OR subscribed()'
    );
    logger.info('Synchronization [' + currentOperation.id() + '] - syncing ' +
                'calendars of identity "' + identity.email + '"');
  }

  function getDidLoadCalendars(future) {
    return function didLoadCalendars(result, operation) {
      currentOperation = null;

      if (result instanceof cal3eResponse.UserError) {
        logger.warn('Synchronization [' + operation.id() + '] - cannot ' +
                    'sync calendars of identity "' + identity.email + '" ' +
                    'because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');

        lastAttemptWasSuccessful = false;
        future.done();
        return;
      } else if (!(result instanceof cal3eResponse.Success)) {
        logger.warn('Synchronization [' + operation.id() + '] - cannot ' +
                    'sync calendars of identity "' + identity.email + '" ' +
                    'because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');

        if (!Services.io.offline) {
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
        }

        lastAttemptWasSuccessful = false;
        future.done();
        return;
      }

      loadOwners(result.data, future);
    }
  };

  function loadOwners(calendars, future) {
    var query = calendars
      .map(function(calendar) {
        return calendar['owner'];
      })
      .filter(function(owner, idx, owners) {
        return owners.indexOf(owner) === idx;
      })
      .map(function(owner) {
        return "match_username('" + owner + "')";
      });

    if (query.length > 0) {
      currentOperation = cal3eRequest.Client.getInstance().getUsers(
        identity, getDidLoadOwners(calendars, future), query.join(' OR ')
      );
      logger.info('Synchronization [' + currentOperation.id() + '] - ' +
                  'syncing calendar owners');
    } else {
      didLoadEverything([], calendars, future);
    }
  }

  function getDidLoadOwners(calendars, future) {
    return function didLoadOwners(result, operation) {
      currentOperation = null;

      if (!(result instanceof cal3eResponse.Success)) {
        logger.warn('Synchronization [' + operation.id() + '] - cannot ' +
                    'retrieve calendar owners because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');
      } else {
       logger.info('Synchronization [' + operation.id() + '] - received ' +
                   'calendar owners');
      }

      didLoadEverything(
        (result instanceof cal3eResponse.Success) ? result.data : [],
        calendars,
        future
      );
    }
  }

  function didLoadEverything(owners, calendars, future) {
    var ownersByUsername = owners
      .reduce(function(ownersByUsername, owner) {
        ownersByUsername[owner['username']] = owner;

        return ownersByUsername;
      }, {});

    synchronizeCalendarsFromResult(ownersByUsername, calendars);

    lastAttemptWasSuccessful = true;
    future.done();
  }

  function synchronizeCalendarsFromResult(owners, calendars) {
    var knownCalendars = loadEeeCalendarsByUri();

    calendars.forEach(function(calendarData, idx) {
      var uri = buildCalendarUri(calendarData);
      if (!knownCalendars.hasOwnProperty(uri.spec)) {
        addCalendar(
          owners[calendarData['owner']],
          calendarData
        );
      } else {
        updateCalendar(
          knownCalendars[uri.spec],
          owners[calendarData['owner']],
          calendarData
        );
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
    if (!currentOperation) {
      return;
    }

    logger.info('Synchronization [' + currentOperation.id() + '] - ' +
                'canceling syncing of calendars of identity "' +
                identity.email + '"');

    currentOperation.cancel();
    future.done();
  }

  function buildCalendarUri(calendarData) {
    return cal3eModel.buildUri({
      'protocol': 'eee',
      'user': identity.email,
      'owner': calendarData['owner'],
      'name': calendarData['name']
    });
  }

  function addCalendar(ownerData, calendarData) {
    logger.info('Synchronization - adding the calendar "' +
                buildCalendarUri(calendarData) + '"');

    var manager = Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager);

    var calendar = manager.createCalendar(
      'eee', buildCalendarUri(calendarData)
    );
    manager.registerCalendar(calendar);

    calendar.setProperty('imip.identity.key', identity.key);
    setCalendarProperties(calendar, ownerData, calendarData);
  }

  function updateCalendar(calendar, ownerData, calendarData) {
    logger.info('Synchronization - updating the calendar "' +
                calendar.uri.spec + '"');

    setCalendarProperties(calendar, ownerData, calendarData);

    if (!lastAttemptWasSuccessful) {
      calendar.refresh();
    }
  }

  function deleteCalendar(calendar) {
    logger.info('Synchronization - deleting the calendar "' +
                calendar.uri.spec + '"');

    Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .unregisterCalendar(calendar);
  }

  function setCalendarProperties(calendar, ownerData, calendarData) {
    calendar.name = cal3eModel.calendarLabel(calendarData);
    calendar.readOnly = calendarData['perm'] === 'read';

    //TODO validation
    if (cal3eModel.attribute(calendarData, 'color')) {
      calendar.setProperty(
        'color', cal3eModel.attribute(calendarData, 'color')
      );
    }

    if (ownerData && ownerData['username']) {
      calendar.setProperty(
        'organizerId', 'mailto:' + ownerData['username']
      );
      calendar.setProperty(
        'organizerCN', cal3eModel.attribute(ownerData, 'realname')
      );
    } else if (calendarData['owner'] === identity.email) {
      calendar.setProperty(
        'organizerId', 'mailto:' + identity.email
      );
      calendar.setProperty(
        'organizerCN', identity.fullName
      );
    } else {
      calendar.setProperty(
        'organizerId', null
      );
      calendar.setProperty(
        'organizerCN', null
      );
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

  function init() {
    lastAttemptWasSuccessful = true;
  }

  synchronizer.synchronize = synchronize;
  synchronizer.cancel = cancel;

  init();
}

const NSGetFactory = cal3eObject.asXpcom(calEeeSynchronizationService, {
  classID: Components.ID('{d7a08a5f-46ad-4a84-ad66-1cc27e9f388e}'),
  contractID: '@zonio.net/calendar3e/synchronization-service;1',
  classDescription: 'EEE calendar synchronization service',
  interfaces: [Components.interfaces.nsIObserver],
  flags: Components.interfaces.nsIClassInfo.SINGLETON
});
