/* ***** BEGIN LICENSE BLOCK *****
 * Mozilla 3e Calendar Extension
 * Copyright © 2010  Zonio s.r.o.
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

Components.utils.import("resource://calendar3e/cal3eUtils.jsm");

/**
 * Synchronizer of calendars present in Mozilla client application
 * (i.e. Lightning) with those on EEE server.
 */
function calEeeSynchronizer() {}

calEeeSynchronizer.prototype = {

  QueryInterface: XPCOMUtils.generateQI([
    Ci.calEeeISynchronizer
  ]),

  /**
   * Synchronizes calendars of client's identity with those on EEE
   * server.
   *
   * @param {calEeeIClient} client
   * @returns {calEeeISynchronizer} receiver
   */
  synchronize: function calEeeSynchronizer_synchronize(client) {
    var synchronizer = this;
    client.getCalendars(cal3e.createOperationListener(
      function calEeeSynchronizer_onGetCalendars(methodQueue, result) {
        if (Components.results.NS_OK !== methodQueue.status) {
          throw Components.Exception("Cannot retrieve calendar",
                                     methodQueue.status);
        }

        var knownCalendars = synchornizer._loadEeeCalendarsByUri(
          client.identity);
        calendars = result.QueryInterface(Ci.nsISupportsArray);
        var idx = calendars.Count(), data, uri;
        while (idx--) {
          data = calendars.QueryElementAt(idx, Ci.nsIDictionary);
          uri = synchronizer._buildCalendarUri(data);
          if ('undefined' === typeof knownCalendars[uri]) {
            synchronizer._addCalendar(data);
          } else {
            synchronizer._updateCalendar(knownCalendars[uri], data);
          }
          delete knownCalendars[uri];
        }

        for (uri in knownCalendars) {
          if (!knownCalendars.hasOwnProperty(uri)) {
            continue;
          }

          this._deleteCalendar(knownCalendars[uri]);
        }
      }), "owned()");
  },

  /**
   * Builds calendar URI specifiacation from data retrieved from
   * 'getCalendar' method call.
   *
   * @param {nsIDictionary} data
   * @returns {String}
   */
  _buildCalendarUri: function calEeeSynchronizer_buildCalendarUri(data) {
    return 'eee://' +
      data.getValue('owner').
      QueryInterface(Ci.nsISupportsCString) +
      '/' +
      data.getValue('name').
      QueryInterface(Ci.nsISupportsCString);
  },

  /**
   * Adds given calendar build from given data.
   *
   * @param {nsIDictionary} data
   */
  _addCalendar:
  function calEeeSynchronizer_synchronizeCalendar(data) {
    var manager = Cc["@mozilla.org/calendar/manager;1"].
      getService(Ci.calICalendarManager);

    var calendar = manager.createCalendar('eee', this._buildCalendarUri(data));
    manager.registerCalendar(calendar);

    var attrs = !data.hasKey('attrs') ?
      data.getValue('attrs').QueryInterface(Ci.nsIDictionary) :
      null ;

    if (attrs && attrs.hasKey('title')) {
      calendar.name = '' + attrs.getValue('title').
        QueryInterface(Ci.nsISupportsCString);
    } else {
      calendar.name = '' + data.getValue('name').
        QueryInterface(Ci.nsISupportsCString);
    }

    if (attrs && attrs.hasKey('color')) {
      calendar.setProperty(
        'color',
        '' + data.getValue('name').
          QueryInterface(Ci.nsISupportsCString));
    }
  },

  /**
   * Updates given calendar with given data.
   *
   * @param {calEeeICalendar} calendar
   * @param {nsIDictionary} data
   */
  _updateCalendar:
  function calEeeSynchronizer_synchronizeCalendar(calendar, data) {
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
  },

  /**
   * Removes given calendar.
   *
   * @param {calEeeICalendar} calendar
   */
  _deleteCalendar:
  function calEeeSynchronizer_synchronizeCalendar(calendar) {
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;    
  },

  /**
   * Loads calendars of given identity and maps them to their URI.
   *
   * @param {nsIMsgIdentity} identity
   * @returns {Object}
   */
  _loadEeeCalendarsByUri:
  function calEeeSynchronizer_loadEeeCalendars(identity) {
    var eeeCalendars = Cc["@mozilla.org/calendar/manager;1"].
      getService(Ci.calICalendarManager).
      getCalendars({}).
      filter(function calEeeSynchronizer_filterEeeCalendars(calendar) {
        return 'eee' == calendar.type;
      }).
      map(function calEeeSynchronizer_mapEeeCalendars(calendar) {
        return calendar.QueryInterfaces(Ci.calEeeICalendar);
      });
    var calendarsByUri = {};
    var calendar;
    for each (calendar in eeeCalendars) {
      calendarsByUri[calendar.uri.spec] = calendar;
    }

    return calendarsByUri;
  }

};
