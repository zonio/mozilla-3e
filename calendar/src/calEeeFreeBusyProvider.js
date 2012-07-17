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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://calendar/modules/calUtils.jsm");
Cu.import("resource://calendar/modules/calIteratorUtils.jsm");
Cu.import("resource://calendar/modules/calProviderUtils.jsm");
Cu.import("resource://calendar3e/modules/identities.jsm");
Cu.import("resource://calendar3e/modules/utils.jsm");


function calEeeFreeBusyProvider() {}

calEeeFreeBusyProvider.classInfo = XPCOMUtils.generateCI({
  classID: Components.ID("{310e5872-2101-40cc-8315-a05578f3e5df}"),
  contractID: "@zonio.net/calendar3e/freebusy-provider;1",
  classDescription: "EEE calendar freebusy provider",
  interfaces: [Ci.calEeeIFreeBusyProvider,
               Ci.calIFreeBusyProvider,
               Ci.nsIObserver,
               Ci.nsIClassInfo],
  flags: Ci.nsIClassInfo.SINGLETON
});

calEeeFreeBusyProvider.TYPES = {
  "FREE": Ci.calIFreeBusyInterval.FREE,
  "BUSY": Ci.calIFreeBusyInterval.BUSY,
  "BUSY-UNAVAILABLE": Ci.calIFreeBusyInterval.BUSY_UNAVAILABLE,
  "BUSY-TENTATIVE": Ci.calIFreeBusyInterval.BUSY_TENTATIVE
}

calEeeFreeBusyProvider.prototype = {

  classDescription: calEeeFreeBusyProvider.classInfo.classDescription,
  classID: calEeeFreeBusyProvider.classInfo.classID,
  contractID: calEeeFreeBusyProvider.classInfo.contractID,
  QueryInterface: XPCOMUtils.generateQI(
    calEeeFreeBusyProvider.classInfo.getInterfaces({})),
  classInfo: calEeeFreeBusyProvider.classInfo,

  /**
   * Calls {@link register} when Thunderbird starts.
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
  observe: function calEeeManager_observe(subject, topic, data) {
    switch (topic) {
    case 'profile-after-change':
      this.register();
      break;
    }
  },

  register: function calEeeFreeBusyProvider_register() {
    if (this._registered) {
      return this;
    }

    this._registered = true;
    cal.getFreeBusyService().addProvider(this);
    return this;
  },

  getFreeBusyIntervals: function(calId, start, end, busyTypes, listener) {
    var freeBusyProvider = this;

    var clientListener = cal3e.createOperationListener(
      function calEee_getFreeBusy_onResult(methodQueue, result) {
        if (methodQueue.isFault && !methodQueue.isPending) {
          throw Components.Exception();
        } else if (methodQueue.isPending) {
          return;
        }
        if (Components.results.NS_OK !== methodQueue.status) {
          listener.onResult(null, null);
          return;
        }

        var rawItems;
        try {
          rawItems = result.QueryInterface(Ci.nsISupportsCString);
          rawItems =
            "BEGIN:VCALENDAR\nVERSION:2.0\n" +
            "PRODID:-//Zonio//mozilla-3e//EN\n" +
            rawItems.data +
            "END:VCALENDAR";
        } catch (e) {
          listener.onResult(null, null);
          return;
        }

        var periodsToReturn = [];

        //TODO wrap try over possible exception throwers only
        try {
          for (let component in
               cal.ical.calendarComponentIterator(
                 cal.getIcsService().parseICS(rawItems, null)
               )) {
            let interval;

            if (component.startTime &&
                (start.compare(component.startTime) == -1)) {
              periodsToReturn.push(new cal.FreeBusyInterval(
                calId,
                Ci.calIFreeBusyInterval.UNKNOWN,
                start,
                component.startTime
              ));
            }

            if (component.endTime &&
                (end.compare(component.endTime) == 1)) {
              periodsToReturn.push(new cal.FreeBusyInterval(
                calId,
                Ci.calIFreeBusyInterval.UNKNOWN,
                component.endTime,
                end
              ));
            }

            for (let property in
                 cal.ical.propertyIterator(
                   component, "FREEBUSY"
                 )) {
              periodsToReturn.push(
                freeBusyProvider._buildFreeBusyIntervalFromProperty(
                  calId,
                  property
                )
              );
            }
          }
        } catch (exc) {
          cal.ERROR("3e Calendar: Error parsing free-busy info.");
        }

        listener.onResult(null, periodsToReturn);
      }
    );

    var organizer = this._getEeeOrganizer();
    if (!organizer) {
      listener.onResult(null, null);
      return;
    }

    var attendee = this._parseAttendeeEmail(calId);
    if (!attendee) {
      listener.onResult(null, null);
      return;
    }

    Components.classes[
      "@zonio.net/calendar3e/client-service;1"
    ].getService(Components.interfaces.calEeeIClient).
      freeBusy(
        organizer,
        clientListener,
        attendee,
        start.nativeTime,
        end.nativeTime,
        cal.calendarDefaultTimezone().icalComponent.serializeToICS()
      );
  },

  _getEeeOrganizer: function () {
    var organizerEmail = Components.classes[
      "@mozilla.org/appshell/window-mediator;1"
    ].getService(Components.interfaces.nsIWindowMediator).
      getMostRecentWindow("Calendar:EventDialog:Attendees").
      document.getElementById("attendees-list").
      organizer.id;

    var identities = cal3e.IdentityCollection().
      getEnabled().
      findByEmail(organizerEmail);

    return identities.length > 0 ?
      identities[0] :
      null ;
  },

  _parseAttendeeEmail: function (calId) {
    var parts = calId.split(":", 2);

    return parts[0].toLowerCase() !== "mailto" ?
      parts[1] :
      null ;
  },

  _buildFreeBusyIntervalFromProperty: function (property) {
    var parts = property.value.split("/");
    var begin = cal.createDateTime(parts[0]);
    var end = parts[1].charAt(0) == "P" ?
      begin.clone().addDuration(cal.createDuration(parts[1])) :
      cal.createDateTime(parts[1]) ;

    return new cal.FreeBusyInterval(
      calId,
      property.getParameter("FBTYPE") ?
        calEeeFreeBusyProvider.TYPES[property.getParameter("FBTYPE")] :
        Ci.calIFreeBusyInterval.BUSY,
      begin,
      end
    );
  }

}

const NSGetFactory = XPCOMUtils.generateNSGetFactory([calEeeFreeBusyProvider]);
