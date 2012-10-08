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
Components.utils.import('resource://calendar/modules/calProviderUtils.jsm');
Components.utils.import('resource://calendar/modules/calUtils.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function calEeeCalendar() {
  this.initProviderBase();
}

calEeeCalendar.prototype = {

  __proto__: cal.ProviderBase.prototype,

  classDescription: 'EEE calendar provider',

  classID: Components.ID('{e2b342d0-6119-43d0-8fc6-6116876d2fdb}'),

  contractID: '@mozilla.org/calendar/calendar;1?type=eee',

  QueryInterface: XPCOMUtils.generateQI([
    Components.interfaces.calEeeICalendar,
    Components.interfaces.calICalendar,
    Components.interfaces.nsIObserver
  ]),

  getProperty: function calEee_getProperty(name) {
    switch (name) {
    case 'cache.supported':
      return false;
    case 'itip.transport':
      return Components.classes['@zonio.net/calendar3e/itip;1']
        .createInstance(Components.interfaces.calIItipTransport);
    }

    return this.__proto__.__proto__.getProperty.apply(this, arguments);
  },

  addItem: function calEee_addItem(item, listener) {
    return this.adoptItem(item.clone(), listener);
  },

  adoptItem: function calEee_adoptItem(item, listener) {
    if (!this._identity) {
      this.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_NOT_INITIALIZED,
        Components.interfaces.calIOperationListener.ADD,
        item.id,
        'Unknown identity'
      );
      return null;
    }
    if (this.readOnly) {
      this.notifyOperationComplete(
        listener,
        Components.interfaces.calIErrors.CAL_IS_READONLY,
        Components.interfaces.calIOperationListener.ADD,
        item.id,
        'Read-only calendar'
      );
      return null;
    }

    try {
      item = item.QueryInterface(Components.interfaces.calIEvent);
    } catch (e) {
      this.notifyOperationComplete(
        listener,
        e.result,
        Components.interfaces.calIOperationListener.ADD,
        null,
        e.message
      );
      return null;
    }

    var newItem = item.clone();
    if (newItem.isMutable && (this.superCalendar !== newItem.calendar)) {
      newItem.calendar = this.superCalendar;
    }
    if (newItem.isMutable && (null == newItem.id)) {
      newItem.id = cal.getUUID();
    }

    // We only care about last occurrence of ATTENDEE property for
    // each attendee.
    item.getAttendees({}).forEach(function(attendee) {
      var newAttendee = newItem.getAttendeeById(attendee.id);
      if (newAttendee) {
        newItem.removeAttendee(newAttendee);
        newAttendee = newAttendee.clone();
        newAttendee.participationStatus = attendee.participationStatus;
        newItem.addAttendee(newAttendee);
      }
    });

    var calendar = this;
    var clientListener = function calEee_adoptItem_onResult(result) {
      if ((result instanceof cal3eResponse.EeeError) &&
          (cal3eResponse['eeeErrors']['COMPONENT_EXISTS'] !==
           result.errorCode)) {
        throw Components.Exception();
      } else if (result instanceof cal3eResponse.TransportError) {
        calendar.notifyOperationComplete(
          listener,
          Components.results.NS_ERROR_FAILURE,
          Components.interfaces.calIOperationListener.ADD,
          item.id,
          'Object addition to EEE server failed'
        );
        return;
      }

      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_OK,
        Components.interfaces.calIOperationListener.ADD,
        item.id,
        item
      );
      calendar.mObservers.notify('onAddItem', [item]);
    };

    return cal3eRequest.Client.getInstance()
      .addObject(this._identity, clientListener, this, newItem)
      .component();
  },

  modifyItem: function calEee_modifyItem(newItem, oldItem, listener) {
    if (!this._identity) {
      this.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_NOT_INITIALIZED,
        Components.interfaces.calIOperationListener.MODIFY,
        newItem.id,
        'Unknown identity'
      );
      return null;
    }
    if (this.readOnly) {
      this.notifyOperationComplete(
        listener,
        Components.interfaces.calIErrors.CAL_IS_READONLY,
        Components.interfaces.calIOperationListener.MODIFY,
        newItem.id,
        'Read-only calendar'
      );
      return null;
    }

    if (!newItem.id) {
      this.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_FAILURE,
        Components.interfaces.calIOperationListener.MODIFY,
        newItem.id,
        'Unknown ID of modified item'
      );
      return null;
    }

    try {
      newItem = newItem.QueryInterface(Components.interfaces.calIEvent);
    } catch (e) {
      this.notifyOperationComplete(
        listener,
        e.result,
        Components.interfaces.calIOperationListener.MODIFY,
        null,
        e.message
      );
      return null;
    }

    var calendar = this;
    var clientListener = function calEee_modifyItem_onResult(result) {
      if ((result instanceof cal3eResponse.EeeError) &&
          (cal3eResponse['eeeErrors']['COMPONENT_EXISTS'] !==
           result.errorCode)) {
        throw Components.Exception();
      } else if (result instanceof cal3eResponse.TransportError) {
        calendar.notifyOperationComplete(
          listener,
          Components.results.NS_ERROR_FAILURE,
          Components.interfaces.calIOperationListener.MODIFY,
          newItem.id,
          'Object addition to EEE server failed'
        );
        return;
      }

      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_OK,
        Components.interfaces.calIOperationListener.MODIFY,
        newItem.id,
        newItem
      );
      calendar.mObservers.notify('onModifyItem', [newItem, oldItem]);
    };

    return cal3eRequest.Client.getInstance()
      .updateObject(this._identity, clientListener, this, newItem, oldItem)
      .component();
  },

  deleteItem: function calEee_deleteItem(item, listener) {
    if (!this._identity) {
      this.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_NOT_INITIALIZED,
        Components.interfaces.calIOperationListener.DELETE,
        item.id,
        'Unknown identity'
      );
      return null;
    }
    if (this.readOnly) {
      this.notifyOperationComplete(
        listener,
        Components.interfaces.calIErrors.CAL_IS_READONLY,
        Components.interfaces.calIOperationListener.DELETE,
        item.id,
        'Read-only calendar'
      );
      return null;
    }

    if (!item.id) {
      this.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_FAILURE,
        Components.interfaces.calIOperationListener.DELETE,
        item.id,
        'Unknown ID of deleted item'
      );
      return null;
    }

    try {
      item = item.QueryInterface(Components.interfaces.calIEvent);
    } catch (e) {
      this.notifyOperationComplete(
        listener,
        e.result,
        Components.interfaces.calIOperationListener.DELETE,
        null,
        e.message
      );
      return null;
    }

    var calendar = this;
    var clientListener = function calEee_deleteItem_onResult(result) {
      if (result instanceof cal3eResponse.EeeError) {
        throw Components.Exception();
      } else if (result instanceof cal3eResponse.TransportError) {
        calendar.notifyOperationComplete(
          listener,
          Components.results.NS_ERROR_FAILURE,
          Components.interfaces.calIOperationListener.DELETE,
          item.id,
          'Object deletion to EEE server failed'
        );
        return;
      }

      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_OK,
        Components.interfaces.calIOperationListener.DELETE,
        item.id,
        item
      );
      calendar.mObservers.notify('onDeleteItem', [item]);
    };

    return cal3eRequest.Client.getInstance()
      .deleteObject(this._identity, clientListener, this, item)
      .component();
  },

  _getQueryObjectsListener:
  function calEee_getQueryObjectsListener(listener, rangeStart, rangeEnd) {
    var calendar = this;
    return function calEee_getItems_onResult(result) {
      if (result instanceof cal3eResponse.EeeError) {
        throw Components.Exception();
      } else if (result instanceof cal3eResponse.TransportError) {
        calendar.notifyOperationComplete(
          listener,
          Components.results.NS_ERROR_FAILURE,
          Components.interfaces.calIOperationListener.GET,
          null,
          'Objects retrieval from EEE server failed'
        );
        return;
      }

      var parser = Components.classes['@mozilla.org/calendar/ics-parser;1']
        .createInstance(Components.interfaces.calIIcsParser);
      try {
        parser.parseString(result.data);
      } catch (e) {
        calendar.notifyOperationComplete(
          listener,
          e.result,
          Components.interfaces.calIOperationListener.GET,
          null,
          e.message
        );
        return;
      }

      parser.getItems({}).forEach(function(item) {
        cal3eUtils.getExpandedItems(
          item.clone(), rangeStart, rangeEnd
        ).forEach(function(item) {
          item.calendar = calendar.superCalendar;
          item.parentItem.calendar = calendar.superCalendar;
          item.makeImmutable();
          listener.onGetResult(
            calendar.superCalendar,
            Components.results.NS_OK,
            Components.interfaces.calIEvent,
            null,
            1,
            [item]
          );
        });
      });

      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_OK,
        Components.interfaces.calIOperationListener.GET,
        null,
        null
      );
    };
  },

  getItem: function calEee_getItem(id, listener) {
    if (!this._identity) {
      this.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_NOT_INITIALIZED,
        Components.interfaces.calIOperationListener.GET,
        null,
        'Unknown identity'
      );
      return null;
    }

    return cal3eRequest.Client.getInstance()
      .queryObjects(
        this._identity,
        this._getQueryObjectsListener(listener, null, null),
        this,
        "match_uid('" + id + "')")
      .component();
  },

  getItems: function calEee_getItems(itemFilter, count, rangeStart, rangeEnd,
                                     listener) {
    if (!this._identity) {
      this.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_NOT_INITIALIZED,
        Components.interfaces.calIOperationListener.GET,
        null,
        'Unknown identity'
      );
      return null;
    }

    var wantEvents =
      (itemFilter &
       Components.interfaces.calICalendar.ITEM_FILTER_TYPE_EVENT) !==
      0;
    var wantInvitations =
      (itemFilter &
       Components.interfaces.calICalendar.ITEM_FILTER_REQUEST_NEEDS_ACTION) !==
      0;

    if (!wantEvents) {
      // Events are not wanted, nothing to do.
      this.notifyOperationComplete(
        listener,
        Components.results.NS_OK,
        Components.interfaces.calIOperationListener.GET,
        null,
        'Bad item filter passed to getItems'
      );
      return null;
    }

    var query = [];
    if (rangeStart) {
      query.push(
        "date_from('" +
          cal3eUtils.nsprTimeToEeeDate(rangeStart.nativeTime) +
          "')"
      );
    }
    if (rangeEnd) {
      query.push(
        "date_to('" +
          cal3eUtils.nsprTimeToEeeDate(rangeEnd.nativeTime) +
          "')"
      );
    }

    /* -- */
    var iCalendarString = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//ZONIO//3E//EN\nBEGIN:VTIMEZONE\nTZID:/freeassociation.sourceforge.net/Tzfile/Europe/Prague\nX-LIC-LOCATION:Europe/Prague\nBEGIN:STANDARD\nTZNAME:CET\nDTSTART:19701028T020000\nRRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0100\nEND:STANDARD\nBEGIN:DAYLIGHT\nTZNAME:CEST\nDTSTART:19700331T030000\nRRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0200\nEND:DAYLIGHT\nEND:VTIMEZONE\nBEGIN:VEVENT\nUID:20120917T154551Z-6618-500-1-2@centos6\nDTSTAMP:20120917T154551Z\nDTSTART;TZID=/freeassociation.sourceforge.net/Tzfile/Europe/Prague:\n 20120917T180000\nDTEND;TZID=/freeassociation.sourceforge.net/Tzfile/Europe/Prague:\n 20120917T183000\nTRANSP:OPAQUE\nSEQUENCE:2\nSUMMARY:Simple\nLOCATION:Prague\nCLASS:PUBLIC\nORGANIZER;CN=Bob Beta:MAILTO:bob@beta.zonio.net\nATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;\n RSVP=TRUE;CN=Bob Beta;LANGUAGE=en:MAILTO:bob@beta.zonio.net\nEND:VEVENT\nBEGIN:VEVENT\nUID:20120917T154640Z-6618-500-1-4@centos6\nDTSTAMP:20120917T154640Z\nDTSTART;TZID=/freeassociation.sourceforge.net/Tzfile/Europe/Prague:\n 20120924T090000\nDTEND;TZID=/freeassociation.sourceforge.net/Tzfile/Europe/Prague:\n 20120924T093000\nTRANSP:OPAQUE\nSEQUENCE:2\nSUMMARY:Recur3\nLOCATION:Wien\nCLASS:PUBLIC\nORGANIZER;CN=Bob Beta:MAILTO:bob@beta.zonio.net\nATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;\n RSVP=TRUE;CN=Bob Beta;LANGUAGE=en:MAILTO:bob@beta.zonio.net\nRRULE:FREQ=DAILY;COUNT=3\nEND:VEVENT\nEND:VCALENDAR\n';

    /* -- */

    return cal3eRequest.Client.getInstance()
      .queryObjects(
        this._identity,
        this._getQueryObjectsListener(listener, rangeStart, rangeEnd),
        this,
        query.join(' AND '))
      .component();
  },

  refresh: function calEee_refresh() {
    this.mObservers.notify('onLoad', [this]);
  },

  _findAndSetIdentity: function calEee_findAndSetIdentity() {
    var eeeUser = this._uri.spec.split('/', 4)[2];
    var identities = cal3eIdentity.Collection()
      .getEnabled()
      .findByEmail(eeeUser);

    this._identity = identities.length > 0 ? identities[0] : null;
  },

  set uri(uri) {
    this._uri = uri;
    this._findAndSetIdentity();

    return uri;
  },

  get uri() {
    return this._uri;
  },

  get identity() {
    return this._identity;
  },

  get type() {
    return 'eee';
  },

  get providerID() {
    return 'calendar3e@zonio.net';
  },

  get canRefresh() {
    return true;
  },

  get calspec() {
    var uriParts = this._uri.spec.split('/', 5);

    return uriParts[2] + ':' + (uriParts[4] || uriParts[3]);
  },

  get calname() {
    var uriParts = this._uri.spec.split('/', 5);

    return uriParts[4] || uriParts[3];
  }

};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([calEeeCalendar]);
