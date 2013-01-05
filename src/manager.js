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
Components.utils.import('resource://calendar3e/modules/model.jsm');
Components.utils.import('resource://calendar3e/modules/object.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function calEeeManager() {
  var manager = this;

  function observe(subject, topic, data) {
    switch (topic) {
    case 'profile-after-change':
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
        calendar.addObserver(manager);
      });
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

    calendar.addObserver(manager);

    // calendar already is registered if it has calname set
    if (cal3eModel.calendarName(calendar)) {
      return;
    }

    generateUniqueUri(calendar);

    var createListener = function calEeeManager_create_onResult(result) {
      if (!(result instanceof cal3eResponse.Success)) {
        throw Components.Exception();
      }

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
    var listener = function calEeeManager_create_onResult(result) {
      if (!(result instanceof cal3eResponse.Success)) {
        throw Components.Exception();
      }
    };

    cal3eRequest.Client.getInstance().createCalendar(
      getIdentity(calendar),
      createListener,
      calendar
    );
  }
  cal3eObject.exportMethod(this, onCalendarRegistered);

  cal3eObject.exportMethod(this, function onCalendarUnregistering() {});

  function onCalendarDeleting(calendar) {
    if (calendar.type !== 'eee') {
      return;
    }

    calendar.removeObserver(manager);

    // calendar is not registered if it has no calname set
    if (!cal3eModel.calendarName(calendar)) {
      return;
    }

    var listener = function calEeeManager_delete_onResult(result) {
      if (!(result instanceof cal3eResponse.Success)) {
        throw Components.Exception();
      }
    };

    if (cal3eModel.isOwnedCalendar(calendar)) {
      cal3eRequest.Client.getInstance().deleteCalendar(
        getIdentity(calendar),
        listener,
        calendar
      );
    } else {
      cal3eRequest.Client.getInstance().unsubscribeCalendar(
        getIdentity(calendar),
        listener,
        calendar
      );
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

    var listener = function calEeeManager_update_onResult(result) {
      if (!(result instanceof cal3eResponse.Success)) {
        throw Components.Exception();
      }
    };

    cal3eRequest.Client.getInstance().setCalendarAttribute(
      getIdentity(calendar),
      listener,
      calendar,
      attrName,
      attrValue,
      isPublic
    );
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
