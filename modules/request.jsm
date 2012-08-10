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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
//Components.utils.import("resource://calendar3e/modules/dns.jsm");
Components.utils.import("resource://calendar3e/modules/response.jsm");
Components.utils.import("resource://calendar3e/modules/xml-rpc.jsm");

function calEeeClient() {
  this._queues = [];
  this._activeQueue = null;
  this._timer = null;
  if (typeof cal3eDns !== 'undefined') {
    this._dns = new cal3eDns();
  }
}

calEeeClient.prototype = {

  _interface_name: 'ESClient',

  _prepareMethodQueueAndAuthenticate:
  function calEeeClient_prepareMethodQueueAndAuthenticate(identity, listener) {
    var methodQueue = this._prepareMethodQueue(identity, listener);
    if (!methodQueue) {
      return null;
    }

    methodQueue = this._enqueueAuthenticate(identity, methodQueue, listener);
    if (!methodQueue) {
      return null;
    }

    return methodQueue;
  },

  _prepareMethodQueue:
  function calEeeClient_prepareMethodQueue(identity, listener) {
    var methodQueue = Queue(this._uriFromIdentity(identity));

    return this._validateMethodQueue(
      methodQueue, listener, cal3eResponse.userErrors.BAD_CERT
    );
  },

  _uriFromIdentity: function calEeeClient_uriFromIdentity(identity) {
    if (!this._dns) {
      var host = identity.email.substring(identity.email.indexOf("@") + 1);
      var port = 4444;
    } else {
      var [host, port] = this._dns.resolveServer(
        identity.email.substring(identity.email.indexOf("@") + 1));
    }
    var url = "https://" + host + ":" + port + "/RPC2";
    var ioService = Components.classes["@mozilla.org/network/io-service;1"].
        getService(Components.interfaces.nsIIOService);
    return ioService.newURI(url, null, null);
  },

  _enqueueMethod: function calEeeClient_enqueueMethod(methodQueue,
                                                      methodName) {
    var parameters = Array.prototype.slice.call(arguments, 2).map(
      function (parameter) {
        var instance = null;
        switch (typeof parameter) {
        case 'string':
          instance = Components.classes["@mozilla.org/supports-cstring;1"]
            .createInstance(Components.interfaces.nsISupportsCString);
          break;
        case 'number':
          instance = Components.classes["@mozilla.org/supports-double;1"]
            .createInstance(Components.interfaces.nsISupportsDouble);
          break;
        case 'boolean':
          instance = Components.classes["@mozilla.org/supports-PRBool;1"]
            .createInstance(Components.interfaces.nsISupportsPRBool);
          break;
        }
        if (null !== instance) {
          instance.data = parameter;
          return instance;
        }
        return parameter;
      });

    return methodQueue.push(
      this._interface_name + "." + methodName, parameters.length, parameters
    );
  },

  _queueExecution:
  function calEeeClient_queueExecution(methodQueue, listener) {
    this._queues.push([methodQueue, listener]);
    if (null === this._timer) {
      this._timer = Components.classes[
        "@mozilla.org/timer;1"
      ].createInstance(Components.interfaces.nsITimer);
      this._timer.init(this, 1, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
    }

    return methodQueue;
  },

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
      this._activeQueue.send(this, listener);
    }
    if (0 < this._queues.length) {
      this._timer = Components.classes[
        "@mozilla.org/timer;1"
      ].createInstance(Components.interfaces.nsITimer);
      this._timer.init(this, 500, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
    } else {
      this._timer = null;
    }
  },

  onResult: function calEeeClient_onResult(methodQueue, context) {
    if (methodQueue.isPending()) {
      return;
    }

    this._activeQueue = null;

    var listener = context.QueryInterface(
      Components.interfaces.calIGenericOperationListener
    );
    var result;
    if (methodQueue.error() &&
        (methodQueue.error().result === Components.results.NS_ERROR_FAILURE) &&
        (methodQueue.error().message ===
         "Server certificate exception not added")) {
      result = this._setLastUserError(
        methodQueue, cal3eResponse.userErrors.BAD_CERT
      );
    } else {
      result = cal3eResponse.fromMethodQueue(methodQueue);
    }
    listener(methodQueue, result);
  },

  authenticate: function calEeeClient_authenticate(identity, listener) {
    var methodQueue = this._prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueAuthenticate:
  function calEeeClient_enqueueAuthenticate(identity, methodQueue, listener) {
    //XXX move the whole password prompt/store/... functionality to
    // separate class

    if (!this._validateMethodQueue(methodQueue, listener,
                                   cal3eResponse.userErrors.NO_PASSWORD)) {
      return null;
    }

    var password = this._findPassword(identity)
    if (null === password) {
      var [password, didEnterPassword, savePassword] =
        this._promptForPassword();

      //TODO store unsaved password temporarily
      if (didEnterPassword && savePassword) {
        this._storePassword(identity, password);
      } else if (!didEnterPassword) {
        listener(
          methodQueue,
          this._setLastUserError(
            methodQueue, cal3eResponse.userErrors.NO_PASSWORD
          )
        );
      }
    }

    return this._enqueueMethod(
      methodQueue, 'authenticate', identity.email, password
    );
  },

  _passwordUri: function calEeeClient_passwordUri(identity) {
    //XXX not DRY - somehow use EeeProtocol class
    return "eee://" +
      identity.email.substring(identity.email.indexOf("@") + 1);
  },

  _findPassword: function calEeeClient_findPassword(identity) {
    var logins = Components.classes["@mozilla.org/login-manager;1"]
      .getService(Components.interfaces.nsILoginManager)
      .findLogins({}, this._passwordUri(identity), this._passwordUri(identity),
                  null);

    return logins.length > 0 ? logins[0].password : null ;
  },

  _promptForPassword: function calEeeClient_promptForPassword() {
    var password = { value: "" }; // default the password to empty string
    var savePassword = { value: true }; // default the checkbox to true

    var stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
      .getService(Components.interfaces.nsIStringBundleService)
      .createBundle("chrome://calendar3e/locale/cal3eCalendar.properties");

    var didEnterPassword = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
      .getService(Components.interfaces.nsIPromptService)
      .promptPassword(
        null,
        stringBundle.GetStringFromName('cal3ePasswordDialog.title'),
        stringBundle.GetStringFromName('cal3ePasswordDialog.content'),
        password,
        stringBundle.GetStringFromName('cal3ePasswordDialog.save'),
        savePassword
      );

    return [password.value, didEnterPassword, savePassword.value];
  },

  _storePassword: function calEeeClient_storePassword(identity, password) {
    var loginInfo = Components.classes["@mozilla.org/login-manager/loginInfo;1"]
      .createInstance(Components.interfaces.nsILoginInfo);
    loginInfo.init(this._passwordUri(identity), this._passwordUri(identity),
                   null, identity.email, password, "", "")

    Components.classes["@mozilla.org/login-manager;1"]
      .getService(Components.interfaces.nsILoginManager)
      .addLogin(loginInfo);
  },

  _validateMethodQueue:
  function calEeeClient_validateMethodQueue(methodQueue, listener, errorCode) {
    var error = this._findLastUserError(
      methodQueue.serverUri().spec, errorCode
    );
    //TODO move such constants to preferences
    var threshold = new Date(Date.now() - 5 * 60 * 1000);
    if (error && error.timestamp > threshold) {
      listener(methodQueue, error);
    } else if (error) {
      this._cleanLastUserError(methodQueue.serverUri().spec, errorCode);
      error = null;
    }

    return !error ? methodQueue : null ;
  },

  _setLastUserError:
  function calEeeClient_setLastUserError(methodQueue, errorCode) {
    this._prepareLastUserErrorMap(methodQueue.serverUri().spec, errorCode);

    this._lastUserErrors[methodQueue.serverUri().spec][errorCode] =
      new cal3eResponse.UserError(errorCode);

    return this._lastUserErrors[methodQueue.serverUri().spec][errorCode];
  },

  _findLastUserError:
  function calEeeClient_findLastUserError(errorsId, errorCode) {
    return this._lastUserErrors &&
        this._lastUserErrors[errorsId] &&
        this._lastUserErrors[errorsId][errorCode] ?
      this._lastUserErrors[errorsId][errorCode] :
      null ;
  },

  _prepareLastUserErrorMap:
  function calEeeClient_prepareLastUserErrorMap(errorsId, errorCode) {
    if (!this._lastUserErrors) {
      this._lastUserErrors = {};
      this._lastUserErrors.length = 0;
    }
    if (!this._lastUserErrors[errorsId]) {
      this._lastUserErrors[errorsId] = {};
      this._lastUserErrors[errorsId].length = 0;
      this._lastUserErrors.length += 1;
    }

    this._lastUserErrors[errorsId].length += 1;
  },

  _cleanLastUserError:
  function calEeeClient_cleanLastUserError(errorsId, errorCode) {
    delete this._lastUserErrors[errorsId][errorCode];
    this._lastUserErrors[errorsId].length -= 1;
    if (this._lastUserErrors[errorsId].length === 0) {
      delete this._lastUserErrors[errorsId];
      this._lastUserErrors.length -= 1;
    }
    if (this._lastUserErrors.length === 0) {
      delete this._lastUserErrors;
    }
  },

  getUsers: function calEeeClient_getUsers(identity, listener, query) {
    var methodQueue = this._prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
    this._enqueueGetUsers(methodQueue, query);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueGetUsers: function calEeeClient_enqueueGetUsers(methodQueue, query) {
    return this._enqueueMethod(methodQueue, 'getUsers', query);
  },

  getCalendars: function calEeeClient_getCalendars(identity, listener, query) {
    var methodQueue = this._prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
    this._enqueueGetCalendars(methodQueue, query);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueGetCalendars:
  function calEeeClient_enqueueGetCalendars(methodQueue, query) {
    return this._enqueueMethod(methodQueue, 'getCalendars', query);
  },

  createCalendar:
  function calEeeClient_createCalendar(identity, listener, calendar) {
    var methodQueue = this._prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
    this._enqueueCreateCalendar(methodQueue, calendar);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueCreateCalendar:
  function calEeeClient_enqueueCreateCalendar(methodQueue, calendar) {
    this._enqueueMethod(methodQueue, 'createCalendar', calendar.calname);
    if (calendar.calname != calendar.name) {
      this._enqueueSetCalendarAttribute(
        methodQueue, calendar, 'title', calendar.name, true
      );
    }
    if (calendar.getProperty('color')) {
      this._enqueueSetCalendarAttribute(
        methodQueue, calendar, 'color', calendar.getProperty('color'), true
      );
    }

    return methodQueue;
  },

  deleteCalendar:
  function calEeeClient_deleteCalendar(identity, listener, calendar) {
    var methodQueue = this._prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
    this._enqueueDeleteCalendar(methodQueue, calendar);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueDeleteCalendar:
  function calEeeClient_enqueueDeleteCalendar(methodQueue, calendar) {
    return this._enqueueMethod(
      methodQueue, 'deleteCalendar', calendar.calname
    );
  },

  setCalendarAttribute:
  function calEeeClient_setCalendarAttribute(
    identity, listener, calendar, name, value, isPublic) {
    var methodQueue = this._prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
    this._enqueueSetCalendarAttribute(methodQueue, calendar, name, value,
                                      isPublic);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueSetCalendarAttribute:
  function calEeeClient_enqueueSetCalendarAttribute(methodQueue, calendar,
                                                    name, value, isPublic) {
    return this._enqueueMethod(
      methodQueue, 'setCalendarAttribute', calendar.calspec, name, value,
      isPublic
    );
  },

  queryObjects:
  function calEeeClient_queryObjects(identity, listener, calendar, from, to) {
    var methodQueue = this._prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
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

    return this._enqueueMethod(
      methodQueue, 'queryObjects', calendar.calspec, query
    );
  },

  addObject:
  function calEeeClient_addObject(identity, listener, calendar, item) {
    var methodQueue = this._prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
    this._enqueueAddObject(methodQueue, calendar, item);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueAddObject: function(methodQueue, calendar, item) {
    var count = { value: 0 };
    var timezones = item.icalComponent.getReferencedTimezones(count);
    var idx = count.value;
    while (idx--) {
      this._enqueueMethod(
        methodQueue, 'addObject', calendar.calspec,
        timezones[idx].icalComponent.serializeToICS()
      );
    }

    return this._enqueueMethod(
      methodQueue, 'addObject', calendar.calspec,
      item.icalComponent.serializeToICS()
    );
  },

  updateObject:
  function calEeeClient_updateObject(identity, listener, calendar, item) {
    var methodQueue = this._prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
    this._enqueueUpdateObject(methodQueue, calendar, item);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueUpdateObject: function(methodQueue, calendar, item) {
    var count = { value: 0 };
    var timezones = item.icalComponent.getReferencedTimezones(count);
    var idx = count.value;
    while (idx--) {
      this._enqueueMethod(
        methodQueue, 'addObject', calendar.calspec,
        timezones[idx].icalComponent.serializeToICS()
      );
    }

    return this._enqueueMethod(
      methodQueue, 'updateObject', calendar.calspec,
      item.icalComponent.serializeToICS()
    );
  },

  deleteObject:
  function calEeeClient_deleteObject(identity, listener, calendar, item) {
    var methodQueue = this._prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
    this._enqueueDeleteObject(methodQueue, calendar, item);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueDeleteObject: function(methodQueue, calendar, item) {
    return this._enqueueMethod(
      methodQueue, 'deleteObject', calendar.calspec, item.id
    );
  },

  freeBusy:
  function calEeeClient_getFreebusy(identity, listener, attendee, from, to,
                                    defaultTimezone) {
    var methodQueue = this._prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
    this._enqueueGetFreeBusy(methodQueue, attendee, from, to, defaultTimezone);
    this._queueExecution(methodQueue, listener);

    return methodQueue;
  },

  _enqueueGetFreeBusy:
  function(methodQueue, attendee, from, to, defaultTimezone) {
    var fromEee = xpcomToEeeDate(from);
    var toEee = xpcomToEeeDate(to);

    return this._enqueueMethod(
      methodQueue, 'freeBusy', attendee, fromEee, toEee, defaultTimezone
    );
  }

}

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

function Queue(serverUri) {
  var queue = this;
  var methodCalls;
  var sending;
  var pending;
  var status;
  var error;
  var timestamp;

  function push(methodName, parameters) {
    if (sending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }

    var server = new cal3eXmlRpc.Client();
    server
      .setUri(serveUri)
      .setListener({
        "onResult": onResult,
        "onFault": onFault,
        "onError": onError
      });
    methodCalls.push([methodName, parameters]);
    status = Components.results.NS_OK;

    return queue;
  }

  function send(listener, context) {
    if (sending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }
    if ('undefined' === typeof serverUri) {
      throw Components.results.NS_ERROR_NOT_INITIALIZED;
    }

    sending = true;
    listener = listener;
    context = context;
    methodIdx = 0;
    sendNext();
  }

  function sendNext() {
    server.send.call(server, methodCalls[methodIdx]);
  }

  function onResult(resultServer, result) {
    // skip handling of responses from canceled requests
    if (resultServer !== server) {
      return;
    }

    passToListenerGoNext(result);
  }

  function onFault(resultServer, fault) {
    // skip handling of responses from canceled requests
    if (resultServer !== server) {
      return;
    }

    passToListenerGoNext(fault);
  }

  function passToListenerGoNext(response) {
    methodIdx += 1;
    lastResponse = response;
    pending = methodCalls.length > methodIdx;
    listener.onResult(queue, context);

    if (pending) {
      sendNext();
    }
  }

  function onError(resultServer, serverError) {
    // skip handling of responses from canceled requests
    if (resultServer !== server) {
      return;
    }

    lastResponse = null;
    pending = false;
    status = status;
    error = serverError;
    listener.onResult(queue, context);
  }

  function getId() {
    var lastMethod = methodCalls.length > 0 ?
      methodCalls[methodCalls.length - 1][0] :
      "-- not initialized --" ;

    return serverUri.spec + ':' + lastMethod + '.' + timestamp;
  }

  function isPending() {
    return pending;
  }

  function getStatus() {
    return status;
  }

  function getError() {
    return error;
  }

  function cancel() {
    server.abort();
    sending = false;
    server = null;
    lastResponse = undefined;
  }

  function setServerUri(newServerUri) {
    if (sending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }

    serverUri = newServerUri;
    status = Components.results.NS_OK;
  }

  function getServerUri() {
    return serverUri;
  }

  function getLastResponse() {
    if ('undefined' === typeof lastResponse) {
      throw Components.results.NS_ERROR_NOT_AVAILABLE;
    }

    return lastResponse;
  }

  function isFault() {
    return lastResponse() && lastResponse().isFault();
  }

  function getComponent() {
    if (getComponent.component) {
      return getComponent.component;
    }

    getComponent.component = Object.create({
      "QueryInterface": XPCOMUtils.generateQI([
        Components.interfaces.calIOperation
      ]),
      "cancel": abort();
    }, {
      "id": {"get": getId},
      "isPending": {"get": isPending},
      "status": {"get": getStatus},
    });

    return getComponent.component;
  }

  function init() {
    methodCalls = [];
    sending = false;
    pending = false;
    status = Components.results.NS_OK;
    error = null;
    timestamp = 1 * (new Date());
  }

  queue.component = getComponent;
  queue.id = getId;
  queue.isPending = isPending;
  queue.status = getStatus;
  queue.setServerUri = setServerUri;
  queue.serverUri = getServerUri;
  queue.lastResponse = lastResponse;
  queue.error = getError;
  queue.push = push;
  queue.send = send;
  queue.onResult = onResult;
  queue.onFault = onFault;
  queue.onError = onError;

  init();
}

var cal3eRequest = {
  "Client": Client
};
EXPORTED_SYMBOLS = [
  "cal3eRequest"
];
