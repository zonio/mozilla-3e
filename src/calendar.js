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

Components.utils.import('resource://calendar/modules/calProviderUtils.jsm');
Components.utils.import('resource://calendar/modules/calUtils.jsm');
Components.utils.import('resource://calendar3e/modules/feature.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/logger.jsm');
Components.utils.import('resource://calendar3e/modules/model.jsm');
Components.utils.import('resource://calendar3e/modules/object.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function calEeeCalendar() {
  var calendar = this;
  var uri;
  var identity;
  var logger;

  function getProperty(name) {
    switch (name) {
    case 'cache.supported':
      if (cal3eFeature.isSupported('offline_mode')) {
        return true;
      }
      return false;
    case 'cache.enabled':
      if (cal3eFeature.isSupported('offline_mode')) {
        return true;
      }
      return false;
    case 'cache.always':
      if (cal3eFeature.isSupported('offline_mode')) {
        return true;
      }
      return false;
    case 'itip.transport':
      return Components.classes['@zonio.net/calendar3e/itip-transport;1']
        .createInstance(Components.interfaces.calIItipTransport);
    }

    return calendar.__proto__.__proto__.getProperty.apply(calendar, arguments);
  }
  cal3eObject.exportMethod(this, getProperty);

  function addItem(item, listener) {
    logger.info('Adding item "' + item.title + '" ' +
                'to calendar "' + uri.spec + '"');

    return adoptItem(item.clone(), listener);
  }
  cal3eObject.exportMethod(this, addItem);

  function adoptItem(item, listener) {
    logger.info('Adopting item "' + item.title + '" ' +
                'to calendar "' + uri.spec + '"');

    if (!identity) {
      logger.error('Calendar "' + uri.spec + '" has unknown identity');
      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_NOT_INITIALIZED,
        Components.interfaces.calIOperationListener.ADD,
        item.id,
        'Unknown identity'
      );
      return null;
    }
    if (calendar.readOnly) {
      logger.warn('Calendar is "' + uri.spec + '" read-only');
      calendar.notifyOperationComplete(
        listener,
        Components.interfaces.calIErrors.CAL_IS_READONLY,
        Components.interfaces.calIOperationListener.ADD,
        item.id,
        'Read-only calendar'
      );
      return null;
    }

    item = filterOutAttendees(item);
    item = fixOrganizerAttendee(item);
    item = addSentByParameter(item);
    item = ensureIdentity(item);
    item = setAlarmsDefaultDescriptions(item);

    var clientListener = function calEee_adoptItem_onResult(result,
                                                            operation) {
      if ((result instanceof cal3eResponse.EeeError) &&
          (cal3eResponse['eeeErrors']['COMPONENT_EXISTS'] !==
           result.errorCode)) {
        logger.error('[' + operation.id() + '] Cannot add ' +
                     'item "' + item.title + '" to ' +
                     'calendar "' + uri.spec + '" ' +
                     'because of error ' +
                     result.constructor.name + '(' + result.errorCode + ')');
        throw Components.Exception();
      } else if (result instanceof cal3eResponse.TransportError) {
        logger.warn('[' + operation.id() + '] Cannot add ' +
                    'item "' + item.title + '" to ' +
                    'calendar "' + uri.spec + '" ' +
                    'because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');
        calendar.notifyOperationComplete(
          listener,
          Components.results.NS_ERROR_FAILURE,
          Components.interfaces.calIOperationListener.ADD,
          item.id,
          'Object addition to EEE server failed'
        );
        return;
      }

      logger.info('[' + operation.id() + '] Item "' + item.title + '" added ' +
                  'to calendar "' + uri.spec + '"');

      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_OK,
        Components.interfaces.calIOperationListener.ADD,
        item.id,
        item
      );

      var itemWithoutOrganizerAmongAttendees = organizerLightningHack(item);

      calendar.mObservers.notify('onAddItem',
        [itemWithoutOrganizerAmongAttendees]);
    };

    var operation = cal3eRequest.Client.getInstance()
      .addObject(identity, clientListener, calendar, item);
    logger.info('[' + operation.id() + '] Adopting ' +
                'item "' + item.title + '" ' +
                'to calendar "' + uri.spec + '"');

    return operation.component();
  }
  cal3eObject.exportMethod(this, adoptItem);

  function modifyItem(newItem, oldItem, listener) {
    logger.info('Modifying item "' + newItem.title + '" ' +
                'in calendar "' + uri.spec + '"');

    if (!identity) {
      logger.error('Calendar "' + uri.spec + '" has unknown identity');
      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_NOT_INITIALIZED,
        Components.interfaces.calIOperationListener.MODIFY,
        newItem.id,
        'Unknown identity'
      );
      return null;
    }
    if (calendar.readOnly) {
      logger.warn('Calendar is "' + uri.spec + '" read-only');
      calendar.notifyOperationComplete(
        listener,
        Components.interfaces.calIErrors.CAL_IS_READONLY,
        Components.interfaces.calIOperationListener.MODIFY,
        newItem.id,
        'Read-only calendar'
      );
      return null;
    }

    if (!newItem.id) {
      logger.error('Unidentified item "' + newItem.title + '" to modify');
      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_FAILURE,
        Components.interfaces.calIOperationListener.MODIFY,
        newItem.id,
        'Unknown ID of modified item'
      );
      return null;
    }

    newItem = fixOrganizerAttendee(newItem);
    newItem = addSentByParameter(newItem);
    newItem = setAlarmsDefaultDescriptions(newItem);

    var clientListener = function calEee_modifyItem_onResult(result,
                                                             operation) {
      if ((result instanceof cal3eResponse.EeeError) &&
          (cal3eResponse['eeeErrors']['COMPONENT_EXISTS'] !==
           result.errorCode)) {
        logger.error('[' + operation.id() + '] Cannot modify ' +
                     'item "' + newItem.title + '" in ' +
                     'calendar "' + uri.spec + '" ' +
                     'because of error ' +
                     result.constructor.name + '(' + result.errorCode + ')');
        throw Components.Exception();
      } else if (result instanceof cal3eResponse.TransportError) {
        logger.warn('[' + operation.id() + '] Cannot modify ' +
                    'item "' + newItem.title + '" in ' +
                    'calendar "' + uri.spec + '" ' +
                    'because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');
        calendar.notifyOperationComplete(
          listener,
          Components.results.NS_ERROR_FAILURE,
          Components.interfaces.calIOperationListener.MODIFY,
          newItem.id,
          'Object addition to EEE server failed'
        );
        return;
      }

      logger.info('[' + operation.id() + '] Item "' + newItem.title + '" ' +
                  'modified in calendar "' + uri.spec + '"');

      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_OK,
        Components.interfaces.calIOperationListener.MODIFY,
        newItem.id,
        newItem
      );

      var newItemWithoutOrganizerAmongAttendees = organizerLightningHack(
        newItem
      );

      calendar.mObservers.notify('onModifyItem',
        [newItemWithoutOrganizerAmongAttendees, oldItem]
      );
    };

    var operation = cal3eRequest.Client.getInstance()
      .updateObject(identity, clientListener, calendar, newItem, oldItem);
    logger.info('[' + operation.id() + '] Modifying ' +
                'item "' + newItem.title + '" ' +
                'in calendar "' + uri.spec + '"');

    return operation.component();
  }
  cal3eObject.exportMethod(this, modifyItem);

  function deleteItem(item, listener) {
    logger.info('Deleting item "' + item.title + '" ' +
                'from calendar "' + uri.spec + '"');

    if (!identity) {
      logger.error('Calendar "' + uri.spec + '" has unknown identity');
      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_NOT_INITIALIZED,
        Components.interfaces.calIOperationListener.DELETE,
        item.id,
        'Unknown identity'
      );
      return null;
    }
    if (calendar.readOnly) {
      logger.warn('Calendar is "' + uri.spec + '" read-only');
      calendar.notifyOperationComplete(
        listener,
        Components.interfaces.calIErrors.CAL_IS_READONLY,
        Components.interfaces.calIOperationListener.DELETE,
        item.id,
        'Read-only calendar'
      );
      return null;
    }

    if (!item.id) {
      logger.error('Unidentified item "' + item.title + '" to delete');
      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_FAILURE,
        Components.interfaces.calIOperationListener.DELETE,
        item.id,
        'Unknown ID of deleted item'
      );
      return null;
    }

    item = item.QueryInterface(Components.interfaces.calIEvent);

    var clientListener = function calEee_deleteItem_onResult(result,
                                                             operation) {
      if (result instanceof cal3eResponse.EeeError) {
        logger.error('[' + operation.id() + '] Cannot delete ' +
                     'item "' + item.title + '" from ' +
                     'calendar "' + uri.spec + '" ' +
                     'because of error ' +
                     result.constructor.name + '(' + result.errorCode + ')');
        throw Components.Exception();
      } else if (result instanceof cal3eResponse.TransportError) {
        logger.warn('[' + operation.id() + '] Cannot delete ' +
                    'item "' + item.title + '" from ' +
                    'calendar "' + uri.spec + '" ' +
                    'because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');
        calendar.notifyOperationComplete(
          listener,
          Components.results.NS_ERROR_FAILURE,
          Components.interfaces.calIOperationListener.DELETE,
          item.id,
          'Object deletion to EEE server failed'
        );
        return;
      }

      logger.info('[' + operation.id() + '] Item "' + item.title + '" ' +
                  'deleted from calendar "' + uri.spec + '"');

      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_OK,
        Components.interfaces.calIOperationListener.DELETE,
        item.id,
        item
      );
      calendar.mObservers.notify('onDeleteItem', [item]);
    };

    var operation = cal3eRequest.Client.getInstance()
      .deleteObject(identity, clientListener, calendar, item);
    logger.info('[' + operation.id() + '] Deleting ' +
                'item "' + item.title + '" ' +
                'from calendar "' + uri.spec + '"');

    return operation.component();
  }
  cal3eObject.exportMethod(this, deleteItem);

  function getQueryObjectsListener(listener, rangeStart, rangeEnd) {
    return function calEee_getItems_onResult(result, operation) {
      if (result instanceof cal3eResponse.EeeError) {
        logger.error('[' + operation.id() + '] Cannot query items in ' +
                     'calendar "' + uri.spec + '" ' +
                     'because of error ' +
                     result.constructor.name + '(' + result.errorCode + ')');
        throw Components.Exception();
      } else if (result instanceof cal3eResponse.TransportError) {
        logger.warn('[' + operation.id() + '] Cannot query items in ' +
                    'calendar "' + uri.spec + '" ' +
                    'because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');
        calendar.notifyOperationComplete(
          listener,
          Components.results.NS_ERROR_FAILURE,
          Components.interfaces.calIOperationListener.GET,
          null,
          'Objects retrieval from EEE server failed'
        );
        return;
      }

      logger.info('[' + operation.id() + '] Query result from calendar ' +
                  '"' + uri.spec + '" received');

      var parser = Components.classes['@mozilla.org/calendar/ics-parser;1']
        .createInstance(Components.interfaces.calIIcsParser);
      try {
        logger.info('[' + operation.id() + '] Parsing items from query ' +
                    'result from calendar "' + uri.spec + '"');
        parser.parseString(result.data);
      } catch (e) {
        logger.error('[' + operation.id() + '] Cannot parse items from query ' +
                     'result from calendar "' + uri.spec + '" ' +
                     'because of error ' + e);
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
        /* Don't show unprocessed event invitations in subscribed calendars
         * as processed. */
        if (!cal3eModel.isOwnedCalendar(calendar.superCalendar)) {
          var attendee = item.getAttendeeById('mailto:' +
            cal3eModel.calendarUser(calendar.superCalendar));

          if (attendee) {
            var partstat = attendee.participationStatus ||
                           attendee.getProperty('PARTSTAT');
            if (partstat === 'NEEDS-ACTION') {
              return;
            }
          }
        }

        cal3eUtils
          .getExpandedItems(item.clone(), rangeStart, rangeEnd)
          .forEach(function(item) {
            item = organizerLightningHack(item);
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

      logger.info('[' + operation.id() + '] Queried items from calendar ' +
                  '"' + uri.spec + '" processed');

      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_OK,
        Components.interfaces.calIOperationListener.GET,
        null,
        null
      );
    };
  }

  function getItem(uid, listener) {
    logger.info('Querying item identified by "' + uid + '" ' +
                'in calendar "' + uri.spec + '"');

    if (!identity) {
      logger.error('Calendar "' + uri.spec + '" has unknown identity');
      calendar.notifyOperationComplete(
        listener,
        Components.results.NS_ERROR_NOT_INITIALIZED,
        Components.interfaces.calIOperationListener.GET,
        null,
        'Unknown identity'
      );
      return null;
    }

    var operation = cal3eRequest.Client.getInstance()
      .queryObjects(
        identity,
        getQueryObjectsListener(listener, null, null),
        calendar,
        "match_id('" + uid + "') and not deleted()");
    logger.info('[' + operation.id() + '] Querying item with ' +
                '"match_id(' + uid + ') and not deleted()" in calendar "' +
                uri.spec + '"');

    return operation.component();
  }
  cal3eObject.exportMethod(this, getItem);

  function getItems(itemFilter, count, rangeStart, rangeEnd, listener) {
    logger.info('Querying items between "' +
                (rangeStart ? rangeStart.nativeTime : '(no start)') +
                '" and "' +
                (rangeEnd ? rangeEnd.nativeTime : '(no end)') + '" ' +
                'and in calendar "' + uri.spec + '"');

    if (!identity) {
      logger.error('Calendar "' + uri.spec + '" has unknown identity');
      calendar.notifyOperationComplete(
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
      calendar.notifyOperationComplete(
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
          (new Date(rangeStart.nativeTime / 1000)).toISOString() +
          "')"
      );
    }
    if (rangeEnd) {
      query.push(
        "date_to('" +
          (new Date(rangeEnd.nativeTime / 1000)).toISOString() +
          "')"
      );
    }
    query.push("NOT deleted()");

    var operation = cal3eRequest.Client.getInstance()
      .queryObjects(
        identity,
        getQueryObjectsListener(listener, rangeStart, rangeEnd),
        calendar,
        query.join(' AND '));
    logger.info('[' + operation.id() + '] Querying items with ' +
                '"' + query.join(' AND ') + '" ' +
                'in calendar "' + uri.spec + '"');

    return operation.component();
  }
  cal3eObject.exportMethod(this, getItems);

  function refresh() {
    calendar.mObservers.notify('onLoad', [calendar]);
  }
  cal3eObject.exportMethod(this, refresh);

  function canNotify(method, item) {
    return true;
  }
  cal3eObject.exportMethod(this, canNotify);

  function getUri() {
    return uri;
  }
  function setUri(newUri) {
    uri = newUri;
    findAndSetIdentity();

    return uri;
  }
  cal3eObject.exportProperty(this, 'uri', getUri, setUri);

  function getIdentity() {
    return identity;
  }
  cal3eObject.exportProperty(this, 'identity', getIdentity);

  function getType() {
    return 'eee';
  }
  cal3eObject.exportProperty(this, 'type', getType);

  function getProviderID() {
    return 'calendar3e@zonio.net';
  }
  cal3eObject.exportProperty(this, 'providerID', getProviderID);

  function canRefresh() {
    return true;
  }
  cal3eObject.exportProperty(this, 'canRefresh', canRefresh);

  function getCalspec() {
    var uriParts = uri.spec.split('/', 5);

    return uriParts[2] + ':' + (uriParts[4] || uriParts[3]);
  }
  cal3eObject.exportProperty(this, 'calspec', getCalspec);

  function getCalname() {
    var uriParts = uri.spec.split('/', 5);

    return uriParts[4] || uriParts[3];
  }
  cal3eObject.exportProperty(this, 'calname', getCalname);

  function findAndSetIdentity() {
    var identities = cal3eIdentity.Collection()
      .getEnabled()
      .findByEmail(cal3eModel.calendarUser(calendar));

    identity = identities.length > 0 ? identities[0] : null;
  }

  function ensureIdentity(item) {
    var newItem = item.clone();
    if (newItem.calendar !== calendar.superCalendar) {
      newItem.calendar = calendar.superCalendar;
    }
    if (!newItem.id) {
      newItem.id = cal.getUUID();
    }

    return newItem;
  }

  function filterOutAttendees(item) {
    var newItem = item.clone();
    item.getAttendees({}).forEach(function(attendee) {
      var newAttendee = newItem.getAttendeeById(attendee.id);
      if (newAttendee) {
        newItem.removeAttendee(newAttendee);
        newAttendee = newAttendee.clone();
        newAttendee.participationStatus = attendee.participationStatus;
        newItem.addAttendee(newAttendee);
      }
    });

    return newItem;
  }

  function fixOrganizerAttendee(item) {
    var newItem = item.clone();

    if (item.organizer === null) {
      return newItem;
    }

    addOrganizerAsAttendee(newItem);
    fixOrganizer(newItem);

    return newItem;
  }

  function addOrganizerAsAttendee(item) {
    var attendees = item.getAttendees({});
    var organizer = attendees.filter(function(attendee) {
      return item.organizer.id === attendee.id;
    })[0];

    if (organizer) {
      return;
    }

    var newAttendee = item.organizer.clone();
    newAttendee.isOrganizer = false;
    attendees.unshift(newAttendee);
    item.removeAllAttendees();
    attendees.forEach(function(attendee) {
      item.addAttendee(attendee);
    });
  }

  function fixOrganizer(item) {
    ['CUTYPE', 'MEMBER', 'ROLE', 'PARTSTAT', 'RSVP', 'DELEGATED-TO',
     'DELEGATED-FROM'].forEach(function(property) {
        item.organizer.deleteProperty(property);
    });
    item.organizer.participationStatus = null;
    item.organizer.role = null;
    item.organizer.rsvp = null;
  }

  function organizerLightningHack(item) {
    var newItem = item.clone();

    if (newItem.organizer === null) {
      return newItem;
    }

    var organizerAttendees = newItem.getAttendees({})
      .filter(function(attendee) {
        return attendee.id === newItem.organizer.id;
      });

    if (organizerAttendees.length <= 0) {
      return newItem;
    }

    var organizerAttendee = organizerAttendees[0];

    ['CUTYPE', 'MEMBER', 'ROLE', 'PARTSTAT', 'RSVP', 'DELEGATED-TO',
     'DELEGATED-FROM'].forEach(function(property) {

      if (organizerAttendee.getProperty(property) != null) {
        newItem.organizer.setProperty(
          organizerAttendee.getProperty(property).clone());
      }
    });

    newItem.organizer.participationStatus = organizerAttendee.participationStatus;
    newItem.organizer.role = organizerAttendee.role;
    newItem.organizer.rsvp = organizerAttendee.rsvp;

    newItem.removeAttendee(organizerAttendee);

    return newItem;
  }

  function addSentByParameter(item) {
    if (!item.organizer ||
        (item.organizer.id !== calendar.getProperty('organizerId')) ||
        (item.organizer.id === ('mailto:' + identity.email))) {
      return item;
    }

    var newItem = item.clone();
    newItem.organizer.setProperty('SENT-BY', 'mailto:' + identity.email);

    newItem.getAttendees({})
      .filter(function(attendee) {
        return attendee.id === item.organizer.id;
      })
      .forEach(function(attendee) {
        attendee.setProperty('SENT-BY', 'mailto:' + identity.email);
      });

    return newItem;
  }

  function setAlarmsDefaultDescriptions(item) {
    var defaultDescription = "Reminder";
    var newItem = item.clone();
    var alarms = newItem.getAlarms({});

    alarms.forEach(function(alarm) {
      alarm.description = defaultDescription;
    });

    newItem.clearAlarms();

    alarms.forEach(function(alarm) {
      newItem.addAlarm(alarm);
    });

    return newItem;
  }

  function init() {
    calendar.initProviderBase();
    logger = cal3eLogger.create('extensions.calendar3e.log.calendar');
  }

  init();
}

calEeeCalendar.prototype = { __proto__: cal.ProviderBase.prototype };

const NSGetFactory = cal3eObject.asXpcom(calEeeCalendar, {
  classID: Components.ID('{e2b342d0-6119-43d0-8fc6-6116876d2fdb}'),
  contractID: '@mozilla.org/calendar/calendar;1?type=eee',
  classDescription: 'EEE calendar provider',
  interfaces: [Components.interfaces.calICalendar,
               Components.interfaces.calISchedulingSupport,
               Components.interfaces.nsIObserver]
});
