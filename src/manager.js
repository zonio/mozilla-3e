/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2012  Zonio s.r.o.
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
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/logger.jsm');
Components.utils.import('resource://calendar3e/modules/model.jsm');
Components.utils.import('resource://calendar3e/modules/object.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function calEeeManager() {
  var manager = this;
  var logger;

  function observe(subject, topic, data) {
    switch (topic) {
    case 'profile-after-change':
      logger.info('Registration - initializing');
      register();
      break;
    }
  }
  cal3eObject.exportMethod(this, observe);

  function register() {
    if (register.registered) {
      return;
    }

    register.registered = true;
    Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .addObserver(manager);

    Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .getCalendars({})
      .filter(function(calendar) {
        return calendar.type === 'eee';
      })
      .forEach(function(calendar) {
        logger.info('Registration - starting to observe calendar "' +
                    calendar.uri.spec + '"');
        calendar.addObserver(manager);
      });

    logger.info('Registration - done');
  }

  function unregister() {
    if (!register.registered) {
      return;
    }

    Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .removeObserver(manager);
    register.registered = false;
  }

  function onCalendarRegistered(calendar) {
    if (calendar.type !== 'eee') {
      return;
    }

    logger.info('Create calendar - starting to observe calendar "' +
                calendar.uri.spec + '"');
    calendar.addObserver(manager);

    // calendar already is registered if it has calname set
    if (cal3eModel.calendarName(calendar)) {
      return;
    }

    generateUniqueUri(calendar);
    logger.info('Create calendar - ID generated for calendar "' +
                calendar.uri.spec + '"');

    var createListener = function calEeeManager_create_onResult(result,
                                                                operation) {
      if (!(result instanceof cal3eResponse.Success)) {
        logger.warn('Create calendar [' + operation.id() + '] - cannot ' +
                    'create calendar "' + calendar.uri.spec + '" ' +
                    'because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');

        throw Components.Exception();
      }

      logger.info('Create calendar [' + operation.id() + '] - calendar "' +
                  calendar.uri.spec + '" created');

      Services.prefs.setCharPref(
        'calendar.registry.' + calendar.id + '.uri',
        calendar.uri.spec
      );

      cal3eRequest.Client.getInstance().setCalendarAttribute(
        getIdentity(calendar),
        listener,
        calendar,
        'title',
        calendar.name,
        true
      );
      cal3eRequest.Client.getInstance().setCalendarAttribute(
        getIdentity(calendar),
        listener,
        calendar,
        'color',
        calendar.getProperty('color'),
        true
      );
    };
    var listener = function calEeeManager_create_onResult(result, operation) {
      if (!(result instanceof cal3eResponse.Success)) {
        logger.warn('Create calendar [' + operation.id() + '] - cannot set ' +
                    'attributes of calendar "' + calendar.uri.spec + '" ' +
                    'because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');
        throw Components.Exception();
      }
    };

    var operation = cal3eRequest.Client.getInstance().createCalendar(
      getIdentity(calendar),
      createListener,
      calendar
    );
    logger.info('Create calendar [' + operation.id() + '] - creating ' +
                'calendar "' + calendar.uri.spec + '"');
  }
  cal3eObject.exportMethod(this, onCalendarRegistered);

  cal3eObject.exportMethod(this, function onCalendarUnregistering() {});

  function onCalendarDeleting(calendar) {
    if (calendar.type !== 'eee') {
      return;
    }

    calendar.removeObserver(manager);
    logger.info('Delete calendar - observing calendar "' +
                calendar.uri.spec + '" stopped');

    // calendar is not registered if it has no calname set
    if (!cal3eModel.calendarName(calendar)) {
      return;
    }

    var listener = function calEeeManager_delete_onResult(result, operation) {
      if (!(result instanceof cal3eResponse.Success)) {
        logger.warn('Delete calendar [' + operation.id() + '] - cannot ' +
                    'delete calendar "' + calendar.uri.spec + '" ' +
                    'because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');
        throw Components.Exception();
      }
    };

    var operation;
    if (cal3eModel.isOwnedCalendar(calendar)) {
      operation = cal3eRequest.Client.getInstance().deleteCalendar(
        getIdentity(calendar),
        listener,
        calendar
      );
      logger.info('Delete calendar [' + operation.id() + '] - deleting ' +
                  'calendar "' + calendar.uri.spec + '"');
    } else {
      operation = cal3eRequest.Client.getInstance().unsubscribeCalendar(
        getIdentity(calendar),
        listener,
        calendar
      );
      logger.info('Delete calendar [' + operation.id() + '] - unsubscribing ' +
                  'calendar "' + calendar.uri.spec + '"');
    }
  }
  cal3eObject.exportMethod(this, onCalendarDeleting);

  function onPropertyChanged(calendar, name, value, oldValue) {
    if (calendar.type !== 'eee') {
      return;
    }

    // calendar is not registered if it has no calname set
    if (!cal3eModel.calendarName(calendar)) {
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

    var listener = function calEeeManager_update_onResult(result, operation) {
      if (!(result instanceof cal3eResponse.Success)) {
        logger.warn('Update calendar [' + operation.id() + '] - cannot set ' +
                    (isPublic ? 'public' : 'private') + ' attribute ' +
                    '"' + attrName + '" to value "' + attrValue + '" ' +
                    'on calendar "' + calendar.uri.spec + '" ' +
                    'because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');
        throw Components.Exception();
      }
    };

    var operation = cal3eRequest.Client.getInstance().setCalendarAttribute(
      getIdentity(calendar),
      listener,
      calendar,
      attrName,
      attrValue,
      isPublic
    );
    logger.info('Update calendar [' + operation.id() + '] - setting ' +
                (isPublic ? 'public' : 'private') + ' attribute ' +
                '"' + attrName + '" to value "' + attrValue + '" ' +
                'on calendar "' + calendar.uri.spec + '"');
  }
  cal3eObject.exportMethod(this, onPropertyChanged);

  cal3eObject.exportMethod(this, function onStartBatch() {});
  cal3eObject.exportMethod(this, function onEndBatch() {});
  cal3eObject.exportMethod(this, function onLoad() {});
  cal3eObject.exportMethod(this, function onAddItem() {});
  cal3eObject.exportMethod(this, function onModifyItem() {});
  cal3eObject.exportMethod(this, function onDeleteItem() {});
  cal3eObject.exportMethod(this, function onError() {});
  cal3eObject.exportMethod(this, function onPropertyDeleting() {});

  function generateUniqueUri(calendar) {
    calendar.uri = Services.io.newURI(
      'eee://' + getIdentity(calendar).email + '/' +
        Components.classes['@mozilla.org/uuid-generator;1']
        .getService(Components.interfaces.nsIUUIDGenerator)
        .generateUUID().toString().substring(1, 36),
      null,
      null
    );
  }

  function getIdentity(calendar) {
    var identities = cal3eIdentity.Collection()
      .getEnabled()
      .findByEmail(cal3eModel.calendarUser(calendar));

    return identities.length > 0 ? identities[0] : null;
  }

  function init() {
    logger = cal3eLogger.create('extensions.calendar3e.log.manager');
  }

  init();
}

const NSGetFactory = cal3eObject.asXpcom(calEeeManager, {
  classID: Components.ID('{b65ddbd7-c4f0-46fe-9a36-f2bc8ffe113b}'),
  contractID: '@zonio.net/calendar3e/manager;1',
  classDescription: 'EEE calendar manager',
  interfaces: [Components.interfaces.calICalendarManagerObserver,
               Components.interfaces.calIObserver,
               Components.interfaces.nsIObserver],
  flags: Components.interfaces.nsIClassInfo.SINGLETON
});
