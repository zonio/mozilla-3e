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

const Ci = Components.interfaces;
const Cc = Components.classes;

EXPORTED_SYMBOLS = [
  "cal3eClient"
];

/**
 * Simplifies EEE method execution by server resolution and stacking necessary
 * mehotds to convenient operations.
 *
 * @param identity used to resolve how to connect to server
 */
function cal3eClient() {}

cal3eClient.prototype = {

  _interfaceName: 'ESClient',

  _identity: null,

  _autoExecute: true,

  /**
   * Returns 3e client identity.
   *
   * @return
   */
  get identity cal3eClient_get_identity() {
    return this._identity;
  },

  /**
   * Returns EEE interface name.
   *
   * @return <code>"ESClient"</code>
   */
  get interfaceName cal3eClient_get_interfaceName() {
    return this._interfaceName;
  },

  /**
   * Sets identity which is used with this client.
   *
   * @param identity used to resolve how to connect to server
   * @return receiver
   */
  setIdentity: function cal3eClient_set_identity(identity) {
    this._identity = identity;
    var username = identity.email;
    //TODO DNS resolve
    var host = username.substring(username.indexOf("@") + 1),
        port = 4444;
    //XXX development
    var host = "localhost";
    var url = "https://" + host + ":" + port + "/RPC2";
    var ioService = Cc["@mozilla.org/network/io-service;1"]
      .getService(Ci.nsIIOService);
    this._uri = ioService.newURI(url, null, null);
    this._methodStack = new cal3eMethodStack(this._uri);
  },

  /**
   * Executes current method stack and prepares new one.
   *
   * @param listener
   * @return receiver
   * @todo listener should be server as context parameter to method stack
   *  execution and not remembered here
   */
  executeMethodStack: function cal3eClient_execute(listener) {
    this._listener = (null !== listener) ? listener : null ;
    this._methodStack.execute(this);
    this._methodStack = new cal3eMethodStack(this._uri);
    return this;
  },

  /**
   * Calls appropriate listener's methods according to method stack state.
   *
   * @param methodStack
   * @see executeMethodStack
   */
  methodStackDidChange: function cal3eClient_methodStackDidChange(methodStack) {
    var success = methodStack.areResponsesSuccessful(),
        listener = this._listener;
    if (success &&
        (null !== listener) && ('function' === typeof listener.onSuccess)) {
      listener.onSuccess.call(listener, methodStack.lastResponse.value, methodStack);
    } else if ((null !== listener) && ('function' === typeof listener.onError)) {
      listener.onError.call(listener, methodStack);
    }
  },

  /**
   * Calls <code>ESClient.authenticate</code> with credentials retrieved from
   * client's identity.
   *
   * @param listener
   * @param execute if defined, overrides auto execute setting
   * @return receiver
   */
  authenticate: function cal3eClient_authenticate(listener, execute) {
    if (null === this._identity) {
      throw new Error("Identity must be set");
    }
    execute = undefined === execute ? this._autoExecute : execute ;
    var authenticateMethod = new cal3eMethod(this, 'authenticate');
    //TODO password manager
    var password = "qwe";
    authenticateMethod
      .addParam(this._identity.email) // username
      .addParam(password); // password
    this._methodStack
      .addMethod(authenticateMethod);
    if (execute) {
      this.executeMethodStack(listener);
    }
    return this;
  },

  /**
   * Calls {@link authenticate} and <code>ESClient.getCalendars</code> with
   * given query.
   *
   * @param query string according EEE query specification and specification of
   *  getCalendars method
   * @param listener
   * @param execute if defined, overrides auto execute setting
   * @return receiver
   */
  getCalendars: function cal3eClient_getCalendars(query, listener, execute) {
    execute = undefined === execute ? this._autoExecute : execute ;
    this.authenticate(null, false);
    var getCalendarsMethod = new cal3eMethod(this, 'getCalendars');
    getCalendarsMethod
      .addParam(query); // query
    this._methodStack
      .addMethod(getCalendarsMethod);
    if (execute) {
      this.executeMethodStack(listener);
    }
    return this;
  },

  /**
   * Calls {@link authenticate} and <code>ESClient.queryObjects</code> on
   * given calendar.
   *
   * @param calendar calendar queried calendar
   * @param from beginning date of the date range, can be null
   * @param to last date of the date range, can be null
   * @param listener
   * @param execute if defined, overrides auto execute setting
   * @return receiver
   */
  queryObjects: function cal3eClient_queryObjects(calendar, from, to,
      listener, execute) {
    execute = undefined === execute ? this._autoExecute : execute ;
    this.authenticate(null, false);
    var queryObjectsMethod = new cal3eMethod(this, 'queryObjects');
    
    function zeropad (s, l) {
      s = s.toString(); // force it to a string
      while (s.length < l) {
        s = '0' + s;
      }
      return s;
    }

    var query = '', date;
    if (null !== from) {
      date = new Date(from.nativeTime / 1000);
      query += "date_from('" +
          zeropad(date.getUTCFullYear(), 4) + '-' +
          zeropad(date.getUTCMonth() + 1, 2) + '-' +
          zeropad(date.getUTCDate(), 2) + ' ' +
          zeropad(date.getUTCHours(), 2) + ':' +
          zeropad(date.getUTCMinutes(), 2) + ':' +
          zeropad(date.getUTCSeconds(), 2) +
        "')";
    }
    if (null !== to) {
      if ('' !== query) {
        query += ' AND ';
      }
      date = new Date(to.nativeTime / 1000);
      query += "date_to('" +
          zeropad(date.getUTCFullYear(), 4) + '-' +
          zeropad(date.getUTCMonth() + 1, 2) + '-' +
          zeropad(date.getUTCDate(), 2) + ' ' +
          zeropad(date.getUTCHours(), 2) + ':' +
          zeropad(date.getUTCMinutes(), 2) + ':' +
          zeropad(date.getUTCSeconds(), 2) +
      "')";
    }
    if ('' !== query) {
      query += ' AND ';
    }
    query += "NOT deleted()";
    
    queryObjectsMethod
      .addParam(calendar.calspec)
      .addParam(query);
    this._methodStack
      .addMethod(queryObjectsMethod);
    if (execute) {
      this.executeMethodStack(listener);
    }
    return this;
  }

}
