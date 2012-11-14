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

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/model.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function calEeeManager() {
}

calEeeManager.classInfo = XPCOMUtils.generateCI({
  classID: Components.ID('{b65ddbd7-c4f0-46fe-9a36-f2bc8ffe113b}'),
  contractID: '@zonio.net/calendar3e/manager;1',
  classDescription: 'EEE calendar manager',
  interfaces: [
    Components.interfaces.calEeeIManager,
    Components.interfaces.calICalendarManagerObserver,
    Components.interfaces.calIObserver,
    Components.interfaces.nsIObserver,
    Components.interfaces.nsIClassInfo
  ],
  flags: Components.interfaces.nsIClassInfo.SINGLETON
});

calEeeManager.prototype = {

  classDescription: calEeeManager.classInfo.classDescription,

  classID: calEeeManager.classInfo.classID,

  contractID: calEeeManager.classInfo.contractID,

  QueryInterface: XPCOMUtils.generateQI(
    calEeeManager.classInfo.getInterfaces({})
  ),

  classInfo: calEeeManager.classInfo,

  observe: function calEeeManager_observe(subject, topic, data) {
    switch (topic) {
    case 'profile-after-change':
      this.register();
      break;
    }
  },

  register: function calEeeManager_register() {
    if (this._registered) {
      return this;
    }

    this._registered = true;
    Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .addObserver(this);

    var manager = this;
    Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .getCalendars({})
      .filter(function(calendar) {
        return 'eee' === calendar.type;
      })
      .forEach(function(calendar) {
        calendar.addObserver(manager);
      });

    return this;
  },

  unregister: function calEeeManager_unregister() {
    if (!this._registered) {
      return this;
    }

    Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .removeObserver(this);
    this._registered = false;

    return this;
  },

  onCalendarRegistered: function calEeeManager_registered(calendar) {
    if ('eee' !== calendar.type) {
      return;
    }

    calendar.addObserver(this);

    // calendar already is registered if it has calname set
    if (cal3eModel.calendarName(calendar)) {
      return;
    }

    this._generateUniqueUri(calendar);

    var manager = this;
    var createListener = function calEeeManager_create_onResult(result) {
      if (!(result instanceof cal3eResponse.Success)) {
        throw Components.Exception();
      }

      Services.prefs.setCharPref(
        'calendar.registry.' + calendar.id + '.uri',
        calendar.uri.spec
      );

      cal3eRequest.Client.getInstance().setCalendarAttribute(
        manager._getIdentity(calendar),
        listener,
        calendar,
        'title',
        calendar.name,
        true
      );
      cal3eRequest.Client.getInstance().setCalendarAttribute(
        manager._getIdentity(calendar),
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
      this._getIdentity(calendar),
      createListener,
      calendar
    );
  },

  onCalendarUnregistering: function calEeeManager_unregistering(calendar) {
  },

  onCalendarDeleting: function calEeeManager_deleting(calendar) {
    if ('eee' !== calendar.type) {
      return;
    }

    calendar.removeObserver(this);

    // calendar is not registered if it has no calname set
    if (!cal3eModel.calendarName(calendar)) {
      return;
    }

    var listener = function calEeeManager_delete_onResult(result) {
      if (!(result instanceof cal3eResponse.Success)) {
        throw Components.Exception();
      }
    };

    cal3eRequest.Client.getInstance().deleteCalendar(
      this._getIdentity(calendar),
      listener,
      calendar
    );
  },

  onPropertyChanged:
  function calEeeManager_onPropertyChanged(calendar, name, value, oldValue) {
    if ('eee' !== calendar.type) {
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
      this._getIdentity(calendar),
      listener,
      calendar,
      attrName,
      attrValue,
      isPublic
    );
  },

  onStartBatch: function() {},
  onEndBatch: function() {},
  onLoad: function() {},
  onAddItem: function() {},
  onModifyItem: function() {},
  onDeleteItem: function() {},
  onError: function() {},
  onPropertyDeleting: function() {},

  _generateUniqueUri: function calEeeManager_generateUniqueUri(calendar) {
    calendar.uri = Services.io.newURI(
      'eee://' + this._getIdentity(calendar).email + '/' +
        Components.classes['@mozilla.org/uuid-generator;1']
        .getService(Components.interfaces.nsIUUIDGenerator)
        .generateUUID().toString().substring(1, 36),
      null,
      null
    );
  },

  _getIdentity: function calEeeManager_getIdentity(calendar) {
    var identities = cal3eIdentity.Collection()
      .getEnabled()
      .findByEmail(cal3eModel.calendarUser(calendar));

    return identities.length > 0 ? identities[0] : null;
  }

};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([calEeeManager]);
