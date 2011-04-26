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

/**
 * EEE client simplifying server method calls to prepared operations.
 */
function calEeeClient() {
  this._queues = [];
  this._activeQueue = null;
  this._timer = null;
}

calEeeClient.prototype = {

  QueryInterface: XPCOMUtils.generateQI([
    Ci.calEeeIClient,
    Ci.calIGenericOperationListener,
    Ci.nsIObserver
  ]),

  _interface_name: 'ESClient',

  /**
   * Prepares new method queue for operation on EEE server.
   *
   * @param {nsIMsgIdentity} identity
   * @returns {calEeeIMethodQueue}
   */
  _prepareMethodQueue: function calEeeClient_prepareMethodQueue(identity) {
    var methodQueue = Cc["@zonio.net/calendar3e/method-queue;1"].
        createInstance(Ci.calEeeIMethodQueue);
    methodQueue.serverUri = this._uriFromIdentity(identity);

    return methodQueue;
  },

  /**
   * Creates URI to send method queue to.
   *
   * @param {nsIMsgIdentity} identity
   * @returns {nsIURI}
   */
  _uriFromIdentity: function calEeeClient_uriFromIdentity(identity) {
    var domainName = identity.email.substring(identity.email.indexOf("@") + 1);
    //TODO DNS resolve
    var host, port;
    //XXX development
    host = "localhost";
    port = 4444;
    var url = "https://" + host + ":" + port + "/RPC2";
    var ioService = Cc["@mozilla.org/network/io-service;1"].
        getService(Ci.nsIIOService);
    return ioService.newURI(url, null, null);
  },

  /**
   * Conveniently enqueues method and its parameters to method queue.
   *
   * @param {calEeeIMethodQueue} methodQueue
   * @param {String} methodName
   * @param {nsIVariant[]} [parameters] method parameters
   */
  _enqueueMethod: function calEeeClient_enqueueMethod(methodQueue, methodName) {
    var parameters = Array.prototype.slice.call(arguments, 2).map(
      function (parameter) {
        var instance = null;
        switch (typeof parameter) {
        case 'string':
          instance = Cc["@mozilla.org/supports-cstring;1"]
            .createInstance(Ci.nsISupportsCString);
          break;
        case 'number':
          instance = Cc["@mozilla.org/supports-double;1"]
            .createInstance(Ci.nsISupportsDouble);
          break;
        case 'boolean':
          instance = Cc["@mozilla.org/supports-PRBool;1"]
            .createInstance(Ci.nsISupportsPRBool);
          break;
        }
        if (null !== instance) {
          instance.data = parameter;
          return instance;
        }
        return parameter;
      });
    methodQueue.enqueueMethod(this._interface_name + "." + methodName,
                              parameters.length, parameters);
  },

  /**
   * Add method queue to another queue for execution.
   *
   * @param {calEeeIMethodQueue} methodQueue
   * @param {calIGenericOperationListener} listener
   * @returns {calEeeIClient} receiver
   */
  _queueExecution:
  function calEeeClient_queueExecution(methodQueue, listener) {
    this._queues.push([methodQueue, listener]);
    if (null === this._timer) {
      this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      this._timer.init(this, 1, Ci.nsITimer.TYPE_ONE_SHOT);
    }

    return this;
  },

  /**
   * Handles timer callbacks.
   *
   * @param {nsISupports} subject
   * @param {String} topic
   * @param {String} data
   */
  observe: function calEeeSyncService_observe(subject, topic, data) {
    switch (topic) {
    case 'timer-callback':
      this._execute();
      break;
    }
  },

  _execute: function calEeeClient_execute() {
    if (null === this._activeQueue) {
      let listener;
      [this._activeQueue, listener] = this._queues.shift();
      this._activeQueue.execute(this, listener);
    }
    if (0 < this._queues.length) {
      this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      this._timer.init(this, 500, Ci.nsITimer.TYPE_ONE_SHOT);
    } else {
      this._timer = null;
    }
  },

  /**
   * Notified listener if method queue has finished execution of methods.
   *
   * @param {calIOperation} operation can be queried for calEeeIMethodQueue
   * @param {Array} context
   * @todo custom listener with transformation of XML-RPC response to
   * specialized Mozilla instances
   */
  onResult: function calEeeClient_onResult(operation, context) {
    var methodQueue = operation.QueryInterface(Ci.calEeeIMethodQueue),
        methodName = context[0].QueryInterface(Ci.nsISupportsCString),
        listener = context[1].QueryInterface(Ci.calIGenericOperationListener);

    if (!methodQueue.isPending) {
      this._activeQueue = null;
      listener.onResult(methodQueue, methodQueue.lastResponse);
    }
  },

  /**
   * Calls <code>ESClient.authenticate</code> with credentials retrieved from
   * {@link identity}.
   *
   * @param {nsIMsgIdentity} identity
   * @param {calIGenericOperationListener} listener
   * @return {calEeeIMethodQueue} method queue with authenticate being
   * executed on the server
   * @throws {NS_ERROR_NOT_INITIALIZED} if called with no identity set
   */
  authenticate: function cal3eClient_authenticate(identity, listener) {
    var methodQueue = this._prepareMethodQueue(identity);
    this._enqueueAuthenticate(identity, methodQueue);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueAuthenticate:
  function calEeeClient_enqueueAuthenticate(identity, methodQueue) {
    //TODO password manager
    var password = "qwe";

    this._enqueueMethod(methodQueue, 'authenticate', identity.email, password);
  },

  /**
   * Retrieves users matching given query.
   *
   * @param {nsIMsgIdentity} identity
   * @param {calIGenericOperationListener} listener
   * @param {String} query definition according to specification of
   * EEE query language and getUsers method
   * @return {calEeeIMethodQueue} method queue with getUsrs being
   * executed on the server
   * @see authenticate
   */
  getUsers: function cal3eClient_getUsers(identity, listener, query) {
    var methodQueue = this._prepareMethodQueue(identity);
    this._enqueueAuthenticate(identity, methodQueue);
    this._enqueueGetUsers(methodQueue, query);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueGetUsers: function calEeeClient_enqueueGetUsers(methodQueue, query) {
    this._enqueueMethod(methodQueue, 'getUsers', query);
  },

  /**
   * Retrieves calendars matching given query and available to current
   * {@link identity}.
   *
   * @param {nsIMsgIdentity} identity
   * @param {calIGenericOperationListener} listener
   * @param {String} query definition according to specification of EEE query
   * language and getCalendars method
   * @return {calEeeIMethodQueue} method queue with getCalendars being
   * executed on the server
   * @see authenticate
   */
  getCalendars: function cal3eClient_getCalendars(identity, listener, query) {
    var methodQueue = this._prepareMethodQueue(identity);
    this._enqueueAuthenticate(identity, methodQueue);
    this._enqueueGetCalendars(methodQueue, query);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueGetCalendars:
  function calEeeClient_enqueueGetCalendars(methodQueue, query) {
    this._enqueueMethod(methodQueue, 'getCalendars', query);
  },

  /**
   * Retrieves objects from given calendar and in given date-time range.
   *
   * @param {nsIMsgIdentity} identity
   * @param {calIGenericOperationListener} listener
   * @param {calICalendar} calendar queried calendar
   * @param {Number} from beggining of the range as a UNIX timestamp
   * @param {Number} from end of the range as a UNIX timestamp
   * @return {calEeeIMethodQueue} method queue with queryObjects being
   * executed on the server
   * @see authenticate
   */
  queryObjects:
  function cal3eClient_queryObjects(identity, listener, calendar, from, to) {
    var methodQueue = this._prepareMethodQueue(identity);
    this._enqueueAuthenticate(identity, methodQueue);
    this._enqueueQueryObjects(methodQueue, calendar, from, to);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueQueryObjects: function(methodQueue, calendar, from, to) {
    var query = "";
    if (null !== from) {
      query += "date_from('" + xpcomToEeeDate(from) + "')";
    }
    if (null !== to) {
      if ('' !== query) {
        query += ' AND ';
      }
      query += "date_to('" + xpcomToEeeDate(to) + "')";
    }
    if ('' !== query) {
      query += ' AND ';
    }
    query += "NOT deleted()";
    
    this._enqueueMethod(methodQueue, 'queryObjects', calendar.calspec, query);
  },

  addObject:
  function cal3eClient_addObject(identity, listener, calendar, item) {
    var methodQueue = this._prepareMethodQueue(identity);
    this._enqueueAuthenticate(identity, methodQueue);
    this._enqueueAddObject(methodQueue, calendar, item);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueAddObject: function(methodQueue, calendar, item) {
    var count = { value: 0 };
    var timezones = item.icalComponent.getReferencedTimezones(count);
    var idx = count.value;
    while (idx--) {
      this._enqueueMethod(methodQueue, 'addObject',
                          calendar.calspec,
			  timezones[idx].icalComponent.serializeToICS());
    }

    this._enqueueMethod(methodQueue, 'addObject',
                        calendar.calspec,
			item.icalComponent.serializeToICS());
  },

  deleteObject:
  function cal3eClient_deleteObject(identity, listener, calendar, item) {
    var methodQueue = this._prepareMethodQueue(identity);
    this._enqueueAuthenticate(identity, methodQueue);
    this._enqueueDeleteObject(methodQueue, calendar, item);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueDeleteObject: function(methodQueue, calendar, item) {
    this._enqueueMethod(methodQueue, 'deleteObject',
                        calendar.calspec,
			item.id);
  }

};

/**
 * Converts XPCOM date which is UNIX timestamp to date formatted according to
 * EEE specification which is <code>yyyy-MM-dd HH:mm:ss</code> as defined in
 * ISO 8601 in UTC timezone.
 *
 * This is not covered by ISO8601DateUtils.
 *
 * @param {Number} xpcomDate UNIX timestamp
 * @returns {String} <code>yyyy-MM-dd HH:mm:ss</code> ISO 8601
 */
function xpcomToEeeDate(xpcomDate) {
  function zeropad(number, length) {
    var string = "" + number;
    while (string.length < length) {
      string = '0' + string;
    }

    return string;
  }

  var jsDate = new Date(xpcomDate / 1000),
      eeeDate = "";
  eeeDate += zeropad(jsDate.getUTCFullYear(), 4) + '-' +
             zeropad(jsDate.getUTCMonth() + 1, 2) + '-' +
             zeropad(jsDate.getUTCDate(), 2) + ' ' +
             zeropad(jsDate.getUTCHours(), 2) + ':' +
             zeropad(jsDate.getUTCMinutes(), 2) + ':' +
             zeropad(jsDate.getUTCSeconds(), 2);

  return eeeDate;
}
