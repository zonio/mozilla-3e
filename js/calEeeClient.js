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

/*
const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.result;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

EXPORTED_SYMBOLS = [
  "calEeeClient"
];
 */

/**
 * EEE client simplifying server method calls to prepared operations.
 */
function calEeeClient() {}

calEeeClient.prototype = {

  QueryInterface: XPCOMUtils.generateQI([
    Ci.calEeeIClient,
    Ci.calIGenericOperationListener
  ]),

  _interface_name: 'ESClient',

  /**
   * Sets identity used for authorization.
   *
   * @param {nsIMsqIdentity} identity used to resolve how to connect to server
   */
  set identity calEeeClient_set_identitity(identity) {
    this._identity = identity;
    var username = identity.email;
    //TODO DNS resolve
    var host = username.substring(username.indexOf("@") + 1),
        port = 4444;
    //XXX development
    host = "localhost";
    var url = "https://" + host + ":" + port + "/RPC2";
    var ioService = Cc["@mozilla.org/network/io-service;1"].
        getService(Ci.nsIIOService);
    this._uri = ioService.newURI(url, null, null);
  },

  /**
   * Identity used for authorization.
   *
   * @property {nsIMsqIdentity}
   */
  get identity calEeeClient_get_identity() {
    return this._identity;
  },

  /**
   * Prepares new method queue for operation on EEE server.
   *
   * @returns {calEeeIMethodQueue}
   */
  _prepareMethodQueue: function calEeeClient_prepareMethodQueue() {
    var methodQueue = Cc["@zonio.net/calendar3e/method-queue;1"].
        createInstance(Ci.calEeeIMethodQueue);
    methodQueue.serverUri = this._uri;

    return methodQueue;
  },

  /**
   * Conveniently enqueues method and its parameters to method queue.
   *
   * @param {calEeeIMethodQueue} methodQueue
   * @param {String} methodName
   * @param {nsIVariant[]} [var_args] method parameters
   */
  _enqueueMethod: function calEeeClient_enqueueMethod(methodQueue, methodName,
      var_args) {
    var parameters = Array.prototype.slice.call(arguments, 2);
    methodQueue.enqueueMethod(this._interface_name + "." + methodName,
                              parameters.length, parameters);
  },

  /**
   * Notified listener if method queue has finished execution of methods.
   *
   * @param {calEeeIMethodQueue} methodQueue
   * @param {Array} context
   * @todo custom listener with transformation of XML-RPC response to
   * specialized Mozilla instances
   */
  onResult: function calEeeClient_onResult(methodQueue, context) {
    var listener = context[0].QueryInterface(Ci.calIGenericOperationListener),
        methodName = context[1];

    if (!methodQueue.isPending) {
      listener.onResult(methodQueue, methodQueue.lastResponse);
    }
  },

  /**
   * Calls <code>ESClient.authenticate</code> with credentials retrieved from
   * {@link identity}.
   *
   * @param {calIGenericOperationListener} listener
   * @return {calEeeIMethodQueue} method queue with authenticate being
   * executed on the server
   * @throws {NS_ERROR_NOT_INITIALIZED} if called with no identity set
   */
  authenticate: function cal3eClient_authenticate(listener) {
    var methodQueue = this._prepareMethodQueue();
    this._enqueueAuthenticate(methodQueue);
    methodQueue.execute(this, listener);

    return methodQueue;
  },

  _enqueueAuthenticate: function calEeeClient_enqueueAuthenticate(
      methodQueue) {
    if ('undefined' === typeof this._identity) {
      throw Cr.NS_ERROR_NOT_INITIALIZED;
    }

    //TODO password manager
    var password = "qwe";

    this._enqueueMethod(methodQueue, 'authenticate', this._identity.email,
                        password);
  },

  /**
   * Retrieves users matching given query.
   *
   * @param {calIGenericOperationListener} listener
   * @param {String} query definition according to specification of
   * EEE query language and getUsers method
   * @return {calEeeIMethodQueue} method queue with getUsrs being
   * executed on the server
   * @see authenticate
   */
  getUsers: function cal3eClient_getUsers(listener, query) {
    var methodQueue = this._prepareMethodQueue();
    this._enqueueAuthenticate(methodQueue);
    this._enqueueGetUsers(methodQueue, query);
    methodQueue.execute(this, listener);

    return methodQueue;
  },

  _enqueueGetUsers: function calEeeClient_enqueueGetUsers(
      methodQueue, query) {
    this._enqueueMethod(methodQueue, 'getUsers', query);
  },

  /**
   * Retrieves calendars matching given query and available to current
   * {@link identity}.
   *
   * @param {calIGenericOperationListener} listener
   * @param {String} query definition according to specification of EEE query
   * language and getCalendars method
   * @return {calEeeIMethodQueue} method queue with getCalendars being
   * executed on the server
   * @see authenticate
   */
  getCalendars: function cal3eClient_getCalendars(listener, query) {
    var methodQueue = this._prepareMethodQueue();
    this._enqueueAuthenticate(methodQueue);
    this._enqueueGetCalendars(methodQueue, query);
    methodQueue.execute(this, listener);

    return methodQueue;
  },

  _enqueueGetCalendars: function calEeeClient_enqueueGetCalendars(
      methodQueue, query) {
    this._enqueueMethod(methodQueue, 'getCalendars', query);
  },

  /**
   * Retrieves objects from given calendar and in given date-time range.
   *
   * @param {calIGenericOperationListener} listener
   * @param {calICalendar} calendar queried calendar
   * @param {Number} from beggining of the range as a UNIX timestamp
   * @param {Number} from end of the range as a UNIX timestamp
   * @return {calEeeIMethodQueue} method queue with queryObjects being
   * executed on the server
   * @see authenticate
   */
  queryObjects: function cal3eClient_queryObjects(listener, calendar, from,
      to) {
    var methodQueue = this._prepareMethodQueue();
    this._enqueueAuthenticate(methodQueue);
    this._enqueueQueryObjects(methodQueue, calendar, from, to);
    methodQueue.execute(this, listener);

    return methodQueue;
  },

  _enqueueQueryObjects: function(methodQueue, calspec, from, to) {
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
    
    this._enqueueMethod(methodQueue, 'queryObjects', calspec, query);
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
