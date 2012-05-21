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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://calendar/modules/calUtils.jsm");
Cu.import("resource://calendar/modules/calIteratorUtils.jsm");
Cu.import("resource://calendar/modules/calProviderUtils.jsm");
Cu.import("resource://calendar3e/modules/cal3eUtils.jsm");


function calEeeFreeBusyProvider() {}

calEeeFreeBusyProvider.classInfo = XPCOMUtils.generateCI({
    classID: Components.ID("{310e5872-2101-40cc-8315-a05578f3e5df}"),
    contractID: "@zonio.net/calendar3e/freebusy-provider;1",
    classDescription: "EEE calendar freebusy provider",
    interfaces: [Ci.calEeeIFreeBusyProvider,
                 Ci.calIFreeBusyProvider,
                 Ci.nsIClassInfo],
    flags: Ci.nsIClassInfo.SINGLETON
});

calEeeFreeBusyProvider.prototype = {
    classDescription: calEeeFreeBusyProvider.classInfo.classDescription,
    classID: calEeeFreeBusyProvider.classInfo.classID,
    contractID: calEeeFreeBusyProvider.classInfo.contractID,
    QueryInterface: XPCOMUtils.generateQI(
        calEeeFreeBusyProvider.classInfo.getInterfaces({})),
    classInfo: calEeeFreeBusyProvider.classInfo,
    
    register: function calEeeFreeBusyProvider_register() {
        if (this._registered) {
            return this;
        }
        
        this._registered = true;
        cal.getFreeBusyService().addProvider(this);
        return this;
    },
    
    _getClient: function calEeeFreeBusyProvider_getClient() {
        return Cc["@zonio.net/calendar3e/client-service;1"]
                .getService(Ci.calEeeIClient);
    },
    
    getFreeBusyIntervals: function(aCalId, aRangeStart, aRangeEnd, aBusyTypes, aListener) {
        
        var clientListener = cal3e.createOperationListener(
            function calEee_getFreeBusy_onResult(methodQueue, result) {
                if (methodQueue.isFault && !methodQueue.isPending) {
                    throw Component.Exception();
                } else if (methodQueue.isPending) {
                    return;
                }
                if (Cr.NS_OK !== methodQueue.status) {
                    aListener.onResult(null, null);
                    return;
                }
                
                var rawItems;
                try {
                    rawItems = result.QueryInterface(Ci.nsISupportsCString);
                    rawItems = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Zonio//mozilla-3e//EN\n" + rawItems.data + "END:VCALENDAR";
                } catch (e) {
                    aListener.onResult(null, null);
                    return;
                }
                
                var periodsToReturn = [];
                var fbTypeMap = {};
                fbTypeMap["FREE"] = Ci.calIFreeBusyInterval.FREE;
                fbTypeMap["BUSY"] = Ci.calIFreeBusyInterval.BUSY;
                fbTypeMap["BUSY-UNAVAILABLE"] = Ci.calIFreeBusyInterval.BUSY_UNAVAILABLE;
                fbTypeMap["BUSY-TENTATIVE"] = Ci.calIFreeBusyInterval.BUSY_TENTATIVE;
                try {
                     let calComp = cal.getIcsService().parseICS(rawItems, null);
                     for (let fbComp in cal.ical.calendarComponentIterator(calComp)) {
                         let interval;
                         let replyRangeStart = fbComp.startTime;
                         if (replyRangeStart && (aRangeStart.compare(replyRangeStart) == -1)) {
                             interval = new cal.FreeBusyInterval(aCalId,
                                                                 Ci.calIFreeBusyInterval.UNKNOWN,
                                                                 aRangeStart,
                                                                 replyRangeStart);
                             periodsToReturn.push(interval);
                         }
                         let replyRangeEnd = fbComp.endTime;
                         if (replyRangeEnd && (aRangeEnd.compare(replyRangeEnd) == 1)) {
                             interval = new cal.FreeBusyInterval(aCalId,
                                                                 Ci.calIFreeBusyInterval.UNKNOWN,
                                                                 replyRangeEnd,
                                                                 aRangeEnd);
                             periodsToReturn.push(interval);
                         }
 
                         for (let fbProp in cal.ical.propertyIterator(fbComp, "FREEBUSY")) {
                             let fbType = fbProp.getParameter("FBTYPE");
                             if (fbType) {
                                 fbType = fbTypeMap[fbType];
                             } else {
                                 fbType = Ci.calIFreeBusyInterval.BUSY;
                             }
                             let parts = fbProp.value.split("/");
                             let begin = cal.createDateTime(parts[0]);
                             let end;
                             if (parts[1].charAt(0) == "P") { // this is a duration
                                 end = begin.clone();
                                 end.addDuration(cal.createDuration(parts[1]));
                             } else {
                                 // This is a date string
                                 end = cal.createDateTime(parts[1]);
                             }
                             interval = new cal.FreeBusyInterval(aCalId,
                                                                 fbType,
                                                                 begin,
                                                                 end);
                             periodsToReturn.push(interval);
                         }
                     }
                 } catch (exc) {
                     cal.ERROR("CalDAV: Error parsing free-busy info.");
                 }
                 aListener.onResult(null, periodsToReturn);
                
            }
        );
        
        // obtaining attendee-list element from calendar-event-dialog-attendees dialog
        var wm = Cc["@mozilla.org/appshell/window-mediator;1"]  
                  .getService(Ci.nsIWindowMediator);
        var winAttendees = wm.getMostRecentWindow("Calendar:EventDialog:Attendees");
        var attendeesList = winAttendees.document.getElementById("attendees-list");

        // get from "user <user@domain.tld>" this "user@domain.tld"
        var organizer = String(attendeesList.organizer);
        organizer = organizer.split(" ")[1];
        organizer = organizer.replace("<", "").replace(">", "");
        
        var accountCollection = new cal3e.AccountCollection();
        var accounts = accountCollection.filter(function (a) {
            return a.defaultIdentity.email == organizer;
        });
        
        var identity;
        if (accounts.length > 0) {
            identity = accounts[0].defaultIdentity;
        } else {
            aListener.onResult(null, null);
            return;
        }
        
        // getting attendee's name
        var aCalIdParts = aCalId.split(":", 2);
        aCalIdParts[0] = aCalIdParts[0].toLowerCase();
        if (aCalIdParts[0] != "mailto") {
            aListener.onResult(null, null);
            return;
        }
        var attendee = aCalIdParts[1];
        
        var defaultTimezone = cal.calendarDefaultTimezone().icalComponent.serializeToICS();

        // is organizer of eee type has 3e calendar enabled?
        if (identity.getBoolAttribute(cal3e.EEE_ENABLED_KEY)) {
            var client = this._getClient();
            client.freeBusy(identity, clientListener, attendee, aRangeStart.nativeTime,
                                    aRangeEnd.nativeTime, defaultTimezone);
        } else {
            aListener.onResult(null, null);
        }
    }
}

const NSGetFactory = XPCOMUtils.generateNSGetFactory([calEeeFreeBusyProvider]);
