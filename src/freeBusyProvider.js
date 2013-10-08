/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2012 - 2013  Zonio s.r.o.
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
Components.utils.import('resource://calendar/modules/calIteratorUtils.jsm');
Components.utils.import('resource://calendar/modules/calProviderUtils.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/logger.jsm');
Components.utils.import('resource://calendar3e/modules/object.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');


function calEeeFreeBusyProvider() {
  var freeBusyProvider = this;
  var ICAL_TO_MOZ_TYPES = {
    'FREE':
      Components.interfaces.calIFreeBusyInterval.FREE,
    'BUSY':
      Components.interfaces.calIFreeBusyInterval.BUSY,
    'BUSY-UNAVAILABLE':
      Components.interfaces.calIFreeBusyInterval.BUSY_UNAVAILABLE,
    'BUSY-TENTATIVE':
      Components.interfaces.calIFreeBusyInterval.BUSY_TENTATIVE,
    'UNKNOWN':
      Components.interfaces.calIFreeBusyInterval.UNKNOWN
  };
  var MOZ_TO_ICAL_TYPES = {};
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
    cal.getFreeBusyService().addProvider(freeBusyProvider);

    logger.info('Registration - done');
  }

  function getFreeBusyIntervals(calId, start, end, busyTypes, listener) {
    var clientListener = function calEee_getFreeBusy_onResult(result,
                                                              operation) {
      if (result instanceof cal3eResponse.EeeError) {
        logger.warn('[' + operation.id() + '] Cannot retrieve free/busy ' +
                    'as "' + organizer.email + '" for "' + attendee + '" ' +
                    'because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');
        throw Components.Exception();
      } else if (result instanceof cal3eResponse.TransportError) {
        logger.warn('[' + operation.id() + '] Cannot retrieve free/busy ' +
                    'as "' + organizer.email + '" for "' + attendee + '" ' +
                    'because of error ' +
                    result.constructor.name + '(' + result.errorCode + ')');
        listener.onResult(null, null);
        return;
      }

      logger.info('[' + operation.id() + '] Free/busy received');

      rawItems =
        'BEGIN:VCALENDAR\nVERSION:2.0\n' +
        'PRODID:-//Zonio//mozilla-3e//EN\n' +
        result.data +
        'END:VCALENDAR';

      var intervalsToReturn = [];

      //TODO wrap try over possible exception throwers only
      try {
        for (let component in
             cal.ical.calendarComponentIterator(
               cal.getIcsService().parseICS(rawItems, null))) {
          let interval;

          if (component.startTime &&
              (start.compare(component.startTime) == -1)) {
            intervalsToReturn.push(new cal.FreeBusyInterval(
              calId,
              Components.interfaces.calIFreeBusyInterval.UNKNOWN,
              start,
              component.startTime
            ));
          }

          if (component.endTime &&
              (end.compare(component.endTime) == 1)) {
            intervalsToReturn.push(new cal.FreeBusyInterval(
              calId,
              Components.interfaces.calIFreeBusyInterval.UNKNOWN,
              component.endTime,
              end
            ));
          }

          for (let property in
               cal.ical.propertyIterator(component, 'FREEBUSY')) {
            intervalsToReturn.push(
              buildFreeBusyIntervalFromProperty(calId, property)
            );
          }
        }
      } catch (e) {
        logger.error('[' + operation.id() + '] Invalid free/busy ' +
                     'as "' + organizer.email + '" for "' + attendee + '" ' +
                     'because of ' + e);
      }

      logger.info('[' + operation.id() + '] Free/busy parsed');
      logger.debug('[' + operation.id() + '] ' + intervalsToReturn.length +
                   ' free/busy intervals parsed');
      intervalsToReturn.forEach(function(interval, idx) {
        logger.debug('[' + operation.id() + '] Interval #' + idx + ': ' +
                     interval.calId +
                     ' is ' + MOZ_TO_ICAL_TYPES[interval.freeBusyType] +
                     ' from ' +
                     cal3eUtils.calDateTimeToIsoDate(interval.interval.start) +
                     ' to ' +
                     cal3eUtils.calDateTimeToIsoDate(interval.interval.end));
      });

      listener.onResult(null, intervalsToReturn);
    };

    var organizer = getEeeOrganizer() || getCalendarSubscriber();
    if (!organizer) {
      listener.onResult(null, null);
      return;
    }

    var attendee = parseAttendeeEmail(calId);
    if (!attendee) {
      listener.onResult(null, null);
      return;
    }

    var operation = cal3eRequest.Client.getInstance().freeBusy(
      organizer,
      clientListener,
      attendee,
      start.nativeTime,
      end.nativeTime,
      cal.calendarDefaultTimezone().icalComponent.serializeToICS()
    );
    logger.info('[' + operation.id() + '] Retriving free/busy ' +
                'as "' + organizer.email + '" for "' + attendee + '"');
  }
  cal3eObject.exportMethod(this, getFreeBusyIntervals);

  function getEeeOrganizer() {
    var organizerEmail = parseAttendeeEmail(
      Services.wm.getMostRecentWindow('Calendar:EventDialog:Attendees')
        .document.getElementById('attendees-list')
        .organizer.id
    );

    var identities = cal3eIdentity.Collection()
      .getEnabled()
      .findByEmail(organizerEmail);

    return identities.length > 0 ? identities[0] : null;
  }

  function getCalendarSubscriber() {
    var calendar = Services.wm.getMostRecentWindow('Calendar:EventDialog')
      .getCurrentCalendar();
    var key = calendar.getProperty('imip.identity.key');

    var identities = cal3eIdentity.Collection().getEnabled();
    for (var i = 0; i < identities.length; i++) {
      if (identities[i].key === key) {
        return identities[i];
      }
    }
    return null;
  }

  function parseAttendeeEmail(calId) {
    var parts = calId.split(':', 2);

    return parts[0].toLowerCase() === 'mailto' ? parts[1] : null;
  }

  function buildFreeBusyIntervalFromProperty(calId, property) {
    var period = Components.classes['@mozilla.org/calendar/period;1']
      .createInstance(Components.interfaces.calIPeriod);
    period.icalString = property.value;

    return new cal.FreeBusyInterval(
      calId,
      property.getParameter('FBTYPE') ?
        ICAL_TO_MOZ_TYPES[property.getParameter('FBTYPE')] :
        Components.interfaces.calIFreeBusyInterval.BUSY,
      period.start,
      period.end
    );
  }

  function init() {
    for (let icalType in ICAL_TO_MOZ_TYPES) {
      if (!ICAL_TO_MOZ_TYPES.hasOwnProperty(icalType)) {
        continue;
      }
      MOZ_TO_ICAL_TYPES[ICAL_TO_MOZ_TYPES[icalType]] = icalType;
    }

    logger = cal3eLogger.create('extensions.calendar3e.log.freeBusy');
  }

  init();
}

const NSGetFactory = cal3eObject.asXpcom(calEeeFreeBusyProvider, {
  classID: Components.ID('{310e5872-2101-40cc-8315-a05578f3e5df}'),
  contractID: '@zonio.net/calendar3e/freebusy-provider;1',
  classDescription: 'EEE calendar freebusy provider',
  interfaces: [Components.interfaces.calEeeIFreeBusyProvider,
               Components.interfaces.calIFreeBusyProvider,
               Components.interfaces.nsIObserver],
  flags: Components.interfaces.nsIClassInfo.SINGLETON
});
