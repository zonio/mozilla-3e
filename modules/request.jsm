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
Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
//Components.utils.import('resource://calendar3e/modules/dns.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');
Components.utils.import('resource://calendar3e/modules/xml-rpc.jsm');

function Client() {
  var client = this;
  var queues;
  var activeQueue;
  var timer;
  var dns;
  var lastUserErrors;

  function prepareMethodQueueAndAuthenticate(identity, listener) {
    var methodQueue = prepareMethodQueue(identity, listener);
    if (!methodQueue) {
      return null;
    }

    methodQueue = enqueueAuthenticate(identity, methodQueue, listener);
    if (!methodQueue) {
      return null;
    }

    return methodQueue;
  }

  function prepareMethodQueue(identity, listener) {
    var methodQueue = new Queue();
    methodQueue
      .setServerUri(uriFromIdentity(identity))
      .setListener(onResult)
      .setContext(listener);

    return validateMethodQueue(
      methodQueue, listener, cal3eResponse.userErrors.BAD_CERT
    );
  }

  function uriFromIdentity(identity) {
    if (!dns) {
      //XXX dev only
      host = identity.getCharAttribute('eee_host');
      port = identity.getIntAttribute('eee_port');
    } else {
      [host, port] = dns.resolveServer(
        identity.email.substring(identity.email.indexOf("@") + 1)
      );
    }
    var url = 'https://' + host + ':' + port + '/RPC2';

    return Services.io.newURI(url, null, null);
  }

  function enqueueMethod(methodQueue, methodName) {
    return methodQueue.push(
      'ESClient.' + methodName, Array.prototype.slice.call(arguments, 2)
    );
  }

  function queueExecution(methodQueue) {
    queues.push(methodQueue);
    if (null === timer) {
      timer = Components.classes['@mozilla.org/timer;1']
        .createInstance(Components.interfaces.nsITimer);
      timer.init(
        getTimerObserver(), 1, Components.interfaces.nsITimer.TYPE_ONE_SHOT
      );
    }

    return methodQueue;
  }

  function getTimerObserver() {
    return {
      QueryInterface: XPCOMUtils.generateQI([
        Components.interfaces.nsIObserver
      ]),
      observe: execute
    };
  }

  function execute() {
    if (null === activeQueue) {
      activeQueue = queues.shift();
      activeQueue.send();
    }
    if (0 < queues.length) {
      timer = Components.classes['@mozilla.org/timer;1']
        .createInstance(Components.interfaces.nsITimer);
      timer.init(
        getTimerObserver(), 500, Components.interfaces.nsITimer.TYPE_ONE_SHOT
      );
    } else {
      timer = null;
    }
  }

  function onResult(methodQueue, listener) {
    if (methodQueue.isPending()) {
      return;
    }

    activeQueue = null;
    var result;
    //XXX There's no result code for SSL error available so we must
    // check error code and message to distinguish bad certificate
    if (methodQueue.error() &&
        (methodQueue.error().result === Components.results.NS_ERROR_FAILURE) &&
        (methodQueue.error().message ===
         'Server certificate exception not added')) {
      result = setLastUserError(
        methodQueue, cal3eResponse.userErrors.BAD_CERT
      );
    } else {
      result = cal3eResponse.fromMethodQueue(methodQueue);
    }
    listener(methodQueue, result);
  }

  function authenticate(identity, listener) {
    var methodQueue = prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
    queueExecution(methodQueue);

    return methodQueue;
  }

  function enqueueAuthenticate(identity, methodQueue, listener) {
    //XXX move the whole password prompt/store/... functionality to
    // separate class

    if (!validateMethodQueue(methodQueue, listener,
                             cal3eResponse.userErrors.NO_PASSWORD)) {
      return null;
    }

    var password = findPassword(identity);
    if (null === password) {
      var [password, didEnterPassword, savePassword] =
        promptForPassword();

      //TODO store unsaved password temporarily
      if (didEnterPassword && savePassword) {
        storePassword(identity, password);
      } else if (!didEnterPassword) {
        listener(
          methodQueue,
          setLastUserError(
            methodQueue, cal3eResponse.userErrors.NO_PASSWORD
          )
        );
      }
    }

    return enqueueMethod(
      methodQueue, 'authenticate', identity.email, password
    );
  }

  function passwordUri(identity) {
    //XXX not DRY - somehow use EeeProtocol class
    return 'eee://' +
      identity.email.substring(identity.email.indexOf('@') + 1);
  }

  function findPassword(identity) {
    var logins = Services.logins.findLogins(
      {}, passwordUri(identity), passwordUri(identity), null
    );

    return logins.length > 0 ? logins[0].password : null;
  }

  function promptForPassword() {
    var password = { value: '' }; // default the password to empty string
    var savePassword = { value: true }; // default the checkbox to true

    var stringBundle = Services.strings.createBundle(
      'chrome://calendar3e/locale/cal3eCalendar.properties'
    );

    var didEnterPassword = Services.prompt.promptPassword(
      null,
      stringBundle.GetStringFromName('cal3ePasswordDialog.title'),
      stringBundle.GetStringFromName('cal3ePasswordDialog.content'),
      password,
      stringBundle.GetStringFromName('cal3ePasswordDialog.save'),
      savePassword
    );

    return [password.value, didEnterPassword, savePassword.value];
  }

  function storePassword(identity, password) {
    var loginInfo =
      Components.classes['@mozilla.org/login-manager/loginInfo;1']
      .createInstance(Components.interfaces.nsILoginInfo);
    loginInfo.init(
      passwordUri(identity), passwordUri(identity), null, identity.email,
      password, '', ''
    );

    Services.logins.addLogin(loginInfo);
  }

  function validateMethodQueue(methodQueue, listener, errorCode) {
    var error = findLastUserError(
      methodQueue.serverUri().spec, errorCode
    );
    //TODO move such constants to preferences
    var threshold = new Date(Date.now() - 5 * 60 * 1000);
    if (error && error.timestamp > threshold) {
      listener(methodQueue, error);
    } else if (error) {
      cleanLastUserError(methodQueue.serverUri().spec, errorCode);
      error = null;
    }

    return !error ? methodQueue : null;
  }

  function setLastUserError(methodQueue, errorCode) {
    prepareLastUserErrorMap(methodQueue.serverUri().spec, errorCode);

    lastUserErrors[methodQueue.serverUri().spec][errorCode] =
      new cal3eResponse.UserError(errorCode);

    return lastUserErrors[methodQueue.serverUri().spec][errorCode];
  }

  function findLastUserError(errorsId, errorCode) {
    return lastUserErrors && lastUserErrors[errorsId] &&
        lastUserErrors[errorsId][errorCode] ?
      lastUserErrors[errorsId][errorCode] :
      null;
  }

  function prepareLastUserErrorMap(errorsId, errorCode) {
    if (!lastUserErrors) {
      lastUserErrors = {};
      lastUserErrors.length = 0;
    }
    if (!lastUserErrors[errorsId]) {
      lastUserErrors[errorsId] = {};
      lastUserErrors[errorsId].length = 0;
      lastUserErrors.length += 1;
    }

    lastUserErrors[errorsId].length += 1;
  }

  function cleanLastUserError(errorsId, errorCode) {
    delete lastUserErrors[errorsId][errorCode];
    lastUserErrors[errorsId].length -= 1;
    if (lastUserErrors[errorsId].length === 0) {
      delete lastUserErrors[errorsId];
      lastUserErrors.length -= 1;
    }
    if (lastUserErrors.length === 0) {
      lastUserErrors = null;
    }
  }

  function getUsers(identity, listener, query) {
    var methodQueue = prepareMethodQueueAndAuthenticate(identity, listener);
    if (!methodQueue) {
      return null;
    }
    enqueueGetUsers(methodQueue, query);
    queueExecution(methodQueue);

    return methodQueue;
  }

  function enqueueGetUsers(methodQueue, query) {
    return enqueueMethod(methodQueue, 'getUsers', query);
  }

  function getCalendars(identity, listener, query) {
    var methodQueue = prepareMethodQueueAndAuthenticate(identity, listener);
    if (!methodQueue) {
      return null;
    }
    enqueueGetCalendars(methodQueue, query);
    queueExecution(methodQueue);

    return methodQueue;
  }

  function enqueueGetCalendars(methodQueue, query) {
    return enqueueMethod(methodQueue, 'getCalendars', query);
  }

  function createCalendar(identity, listener, calendar) {
    var methodQueue = prepareMethodQueueAndAuthenticate(identity, listener);
    if (!methodQueue) {
      return null;
    }
    enqueueCreateCalendar(methodQueue, calendar);
    queueExecution(methodQueue);

    return methodQueue;
  }

  function enqueueCreateCalendar(methodQueue, calendar) {
    enqueueMethod(methodQueue, 'createCalendar', calendar.calname);
    if (calendar.calname != calendar.name) {
      enqueueSetCalendarAttribute(
        methodQueue, calendar, 'title', calendar.name, true
      );
    }
    if (calendar.getProperty('color')) {
      enqueueSetCalendarAttribute(
        methodQueue, calendar, 'color', calendar.getProperty('color'), true
      );
    }

    return methodQueue;
  }

  function deleteCalendar(identity, listener, calendar) {
    var methodQueue = prepareMethodQueueAndAuthenticate(identity, listener);
    if (!methodQueue) {
      return null;
    }
    enqueueDeleteCalendar(methodQueue, calendar);
    queueExecution(methodQueue);

    return methodQueue;
  }

  function enqueueDeleteCalendar(methodQueue, calendar) {
    return enqueueMethod(methodQueue, 'deleteCalendar', calendar.calname);
  }

  function setCalendarAttribute(identity, listener, calendar, name, value,
                                isPublic) {
    var methodQueue = prepareMethodQueueAndAuthenticate(identity, listener);
    if (!methodQueue) {
      return null;
    }
    enqueueSetCalendarAttribute(methodQueue, calendar, name, value, isPublic);
    queueExecution(methodQueue);

    return methodQueue;
  }

  function enqueueSetCalendarAttribute(methodQueue, calendar, name, value,
                                       isPublic) {
    return enqueueMethod(
      methodQueue, 'setCalendarAttribute', getCalendarCalspec(calendar), name,
      value, isPublic
    );
  }

  function queryObjects(identity, listener, calendar, id, from, to) {
    var methodQueue = prepareMethodQueueAndAuthenticate(identity, listener);
    if (!methodQueue) {
      return null;
    }
    enqueueQueryObjects(methodQueue, calendar, id, from, to);
    queueExecution(methodQueue);

    return methodQueue;
  }

  function enqueueQueryObjects(methodQueue, calendar, id, from, to) {
    var query = '';
    if (id === null) {
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
    } else {
      query += "match_uid('" + id + "') AND ";
    }
    query += 'NOT deleted()';

    return enqueueMethod(
      methodQueue, 'queryObjects', getCalendarCalspec(calendar), query
    );
  }

  function addObject(identity, listener, calendar, item) {
    var methodQueue = prepareMethodQueueAndAuthenticate(identity, listener);
    if (!methodQueue) {
      return null;
    }
    enqueueAddObject(methodQueue, calendar, item);
    queueExecution(methodQueue);

    return methodQueue;
  }

  function enqueueAddObject(methodQueue, calendar, item) {
    var count = { value: 0 };
    var timezones = item.icalComponent.getReferencedTimezones(count);
    var idx = count.value;
    while (idx--) {
      enqueueMethod(
        methodQueue, 'addObject', getCalendarCalspec(calendar),
        timezones[idx].icalComponent.serializeToICS()
      );
    }

    return enqueueMethod(
      methodQueue, 'addObject', getCalendarCalspec(calendar),
      item.icalComponent.serializeToICS()
    );
  }

  function updateObject(identity, listener, calendar, item) {
    var methodQueue = prepareMethodQueueAndAuthenticate(identity, listener);
    if (!methodQueue) {
      return null;
    }
    enqueueUpdateObject(methodQueue, calendar, item);
    queueExecution(methodQueue);

    return methodQueue;
  }

  function enqueueUpdateObject(methodQueue, calendar, item) {
    var count = { value: 0 };
    var timezones = item.icalComponent.getReferencedTimezones(count);
    var idx = count.value;
    while (idx--) {
      enqueueMethod(
        methodQueue, 'addObject', getCalendarCalspec(calendar),
        timezones[idx].icalComponent.serializeToICS()
      );
    }

    return enqueueMethod(
      methodQueue, 'updateObject', getCalendarCalspec(calendar),
      item.icalComponent.serializeToICS()
    );
  }

  function deleteObject(identity, listener, calendar, item) {
    var methodQueue = prepareMethodQueueAndAuthenticate(identity, listener);
    if (!methodQueue) {
      return null;
    }
    enqueueDeleteObject(methodQueue, calendar, item);
    queueExecution(methodQueue);

    return methodQueue;
  }

  function enqueueDeleteObject(methodQueue, calendar, item) {
    return enqueueMethod(
      methodQueue, 'deleteObject', getCalendarCalspec(calendar), item.id
    );
  }

  function freeBusy(identity, listener, attendee, from, to, defaultTimezone) {
    var methodQueue = prepareMethodQueueAndAuthenticate(
      identity, listener
    );
    if (!methodQueue) {
      return null;
    }
    enqueueGetFreeBusy(methodQueue, attendee, from, to, defaultTimezone);
    queueExecution(methodQueue);

    return methodQueue;
  }

  function enqueueGetFreeBusy(methodQueue, attendee, from, to,
                              defaultTimezone) {
    var fromEee = xpcomToEeeDate(from);
    var toEee = xpcomToEeeDate(to);

    return enqueueMethod(
      methodQueue, 'freeBusy', attendee, fromEee, toEee, defaultTimezone
    );
  }

  function getCalendarCalspec(calendar) {
    var uriParts = calendar.uri.spec.split('/', 5);

    return uriParts[2] + ":" + (uriParts[4] || uriParts[3]);
  }

  function init() {
    queues = [];
    activeQueue = null;
    timer = null;
    if (typeof cal3eDns !== 'undefined') {
      dns = new cal3eDns();
    }

    lastUserErrors = null;
  }

  client.authenticate = authenticate;
  client.getUsers = getUsers;
  client.getCalendars = getCalendars;
  client.createCalendar = createCalendar;
  client.deleteCalendar = deleteCalendar;
  client.setCalendarAttribute = setCalendarAttribute;
  client.queryObjects = queryObjects;
  client.addObject = addObject;
  client.updateObject = updateObject;
  client.deleteObject = deleteObject;
  client.freeBusy = freeBusy;

  init();
}
var clientInstance;
Client.getInstance = function Client_getInstance() {
  if (!clientInstance) {
    clientInstance = new Client();
  }

  return clientInstance;
};

function xpcomToEeeDate(xpcomDate) {
  function zeropad(number, length) {
    var string = '' + number;
    while (string.length < length) {
      string = '0' + string;
    }

    return string;
  }

  var jsDate = new Date(xpcomDate / 1000),
      eeeDate = '';
  eeeDate += zeropad(jsDate.getUTCFullYear(), 4) + '-' +
             zeropad(jsDate.getUTCMonth() + 1, 2) + '-' +
             zeropad(jsDate.getUTCDate(), 2) + ' ' +
             zeropad(jsDate.getUTCHours(), 2) + ':' +
             zeropad(jsDate.getUTCMinutes(), 2) + ':' +
             zeropad(jsDate.getUTCSeconds(), 2);

  return eeeDate;
}

function Queue() {
  var queue = this;
  var server;
  var methodCalls;
  var listener;
  var context;
  var sending;
  var pending;
  var status;
  var error;
  var timestamp;

  function push(methodName, parameters) {
    if (sending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }

    methodCalls.push([methodName, parameters]);
    status = Components.results.NS_OK;

    return queue;
  }

  function send() {
    if (sending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }
    if ('undefined' === typeof serverUri) {
      throw Components.results.NS_ERROR_NOT_INITIALIZED;
    }

    sending = true;
    methodIdx = 0;
    sendNext();
  }

  function sendNext() {
    server.send.apply(server, methodCalls[methodIdx]);
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
    listener(queue, context);

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
    status = serverError.result;
    error = serverError;
    listener(queue, context);
  }

  function getId() {
    var lastMethod = methodCalls.length > 0 ?
      methodCalls[methodCalls.length - 1][0] :
      '-- not initialized --';

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
    lastResponse = null;
  }

  function setServerUri(newServerUri) {
    if (sending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }

    serverUri = newServerUri;
    server.setUri(serverUri);
    status = Components.results.NS_OK;

    return queue;
  }

  function getServerUri() {
    return serverUri;
  }

  function setListener(newListener) {
    if (sending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }

    listener = newListener;

    return queue;
  }

  function setContext(newContext) {
    if (sending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }

    context = newContext;

    return queue;
  }

  function getLastResponse() {
    return lastResponse;
  }

  function isFault() {
    return lastResponse && lastResponse.isFault();
  }

  function getComponent() {
    if (getComponent.component) {
      return getComponent.component;
    }

    getComponent.component = Object.create({
      QueryInterface: XPCOMUtils.generateQI([
        Components.interfaces.calIOperation
      ]),
      cancel: cancel
    }, {
      id: {get: getId},
      isPending: {get: isPending},
      status: {get: getStatus}
    });

    return getComponent.component;
  }

  function init() {
    server = new cal3eXmlRpc.Client();
    server.setListener({
      onResult: onResult,
      onFault: onFault,
      onError: onError
    });

    methodCalls = [];
    listener = function() {};
    context = null;
    sending = false;
    pending = false;
    status = Components.results.NS_OK;
    error = null;
    timestamp = 1 * (new Date());
  }

  queue.component = getComponent;
  queue.id = getId;
  queue.isPending = isPending;
  queue.isFault = isFault;
  queue.status = getStatus;
  queue.setServerUri = setServerUri;
  queue.serverUri = getServerUri;
  queue.setListener = setListener;
  queue.setContext = setContext;
  queue.lastResponse = getLastResponse;
  queue.error = getError;
  queue.push = push;
  queue.send = send;

  init();
}

var cal3eRequest = {
  Client: Client
};
EXPORTED_SYMBOLS = [
  'cal3eRequest'
];
