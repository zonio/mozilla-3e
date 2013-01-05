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
Components.utils.import('resource://calendar/modules/calUtils.jsm');
Components.utils.import('resource://calendar/modules/calIteratorUtils.jsm');
Components.utils.import('resource://calendar/modules/calProviderUtils.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/object.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');


function calEeeFreeBusyProvider() {
  var freeBusyProvider = this;
  var TYPES = {
    'FREE':
      Components.interfaces.calIFreeBusyInterval.FREE,
    'BUSY':
      Components.interfaces.calIFreeBusyInterval.BUSY,
    'BUSY-UNAVAILABLE':
      Components.interfaces.calIFreeBusyInterval.BUSY_UNAVAILABLE,
    'BUSY-TENTATIVE':
      Components.interfaces.calIFreeBusyInterval.BUSY_TENTATIVE
  };

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
    cal.getFreeBusyService().addProvider(freeBusyProvider);
  }

  function getFreeBusyIntervals(calId, start, end, busyTypes, listener) {
    var clientListener = function calEee_getFreeBusy_onResult(result) {
      if (result instanceof cal3eResponse.EeeError) {
        throw Components.Exception();
      } else if (result instanceof cal3eResponse.TransportError) {
        listener.onResult(null, null);
        return;
      }

      rawItems =
        'BEGIN:VCALENDAR\nVERSION:2.0\n' +
        'PRODID:-//Zonio//mozilla-3e//EN\n' +
        result.data +
        'END:VCALENDAR';

      var periodsToReturn = [];

      //TODO wrap try over possible exception throwers only
      try {
        for (let component in
             cal.ical.calendarComponentIterator(
               cal.getIcsService().parseICS(rawItems, null))) {
          let interval;

          if (component.startTime &&
              (start.compare(component.startTime) == -1)) {
            periodsToReturn.push(new cal.FreeBusyInterval(
              calId,
              Components.interfaces.calIFreeBusyInterval.UNKNOWN,
              start,
              component.startTime
            ));
          }

          if (component.endTime &&
              (end.compare(component.endTime) == 1)) {
            periodsToReturn.push(new cal.FreeBusyInterval(
              calId,
              Components.interfaces.calIFreeBusyInterval.UNKNOWN,
              component.endTime,
              end
            ));
          }

          for (let property in
               cal.ical.propertyIterator(component, 'FREEBUSY')) {
            periodsToReturn.push(
              buildFreeBusyIntervalFromProperty(calId, property)
            );
          }
        }
      } catch (exc) {
        cal.ERROR('3e Calendar: Error parsing free-busy info.');
      }

      listener.onResult(null, periodsToReturn);
    };

    var organizer = getEeeOrganizer();
    if (!organizer) {
      listener.onResult(null, null);
      return;
    }

    var attendee = parseAttendeeEmail(calId);
    if (!attendee) {
      listener.onResult(null, null);
      return;
    }

    cal3eRequest.Client.getInstance().freeBusy(
      organizer,
      clientListener,
      attendee,
      start.nativeTime,
      end.nativeTime,
      cal.calendarDefaultTimezone().icalComponent.serializeToICS()
    );
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

  function parseAttendeeEmail(calId) {
    var parts = calId.split(':', 2);

    return parts[0].toLowerCase() === 'mailto' ? parts[1] : null;
  }

  function buildFreeBusyIntervalFromProperty(calId, property) {
    var parts = property.value.split('/');
    var begin = cal.createDateTime(parts[0]);
    var end = parts[1].charAt(0) == 'P' ?
      begin.clone().addDuration(cal.createDuration(parts[1])) :
      cal.createDateTime(parts[1]);

    return new cal.FreeBusyInterval(
      calId,
      property.getParameter('FBTYPE') ?
        TYPES[property.getParameter('FBTYPE')] :
        Components.interfaces.calIFreeBusyInterval.BUSY,
      begin,
      end
    );
  }

}

const NSGetFactory = cal3eObject.asXpcom(calEeeFreeBusyProvider, {
  classID: Components.ID('{310e5872-2101-40cc-8315-a05578f3e5df}'),
  contractID: '@zonio.net/calendar3e/freebusy-provider;1',
  classDescription: 'EEE calendar freebusy provider',
  interfaces: [Components.interfaces.calEeeIFreeBusyProvider,
               Components.interfaces.calIFreeBusyProvider,
               Components.interfaces.nsIObserver,
               Components.interfaces.nsIClassInfo],
  flags: Components.interfaces.nsIClassInfo.SINGLETON
});
