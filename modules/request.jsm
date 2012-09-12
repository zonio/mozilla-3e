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
Components.utils.import("resource://calendar3e/modules/feature.jsm");
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');
Components.utils.import('resource://calendar3e/modules/synchronization.jsm');
Components.utils.import('resource://calendar3e/modules/xml-rpc.jsm');

function Client(authenticationDelegate) {
  var client = this;
  var queue = new cal3eSynchronization.Queue();
  var dns;
  var lastUserErrors;

  function validateQueue(queue, listener, errorCode) {
    var error = findLastUserError(
      queue.serverUri().spec, errorCode
    );
    var threshold = new Date(
      Date.now() - Services.prefs.getIntPref('calendar.eee.user_error_timeout')
    );
    if (error && error.timestamp > threshold) {
      queue.setError(Components.Exception("User error '" + errorCode + "'"));
      listener(queue, error);
    } else if (error) {
      cleanLastUserError(queue.serverUri().spec, errorCode);
      error = null;
    }

    return queue;
  }

  function setLastUserError(queue, errorCode) {
    prepareLastUserErrorMap(queue.serverUri().spec, errorCode);

    lastUserErrors[queue.serverUri().spec][errorCode] =
      new cal3eResponse.UserError(errorCode);

    queue.setError(Components.Exception("User error '" + errorCode + "'"));

    return lastUserErrors[queue.serverUri().spec][errorCode];
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
    var allArguments = Array.prototype.slice.apply(arguments);
    allArguments.unshift('getUsers');

    return queryNonCalendarObjects.apply(null, allArguments);
  }
  getUsers = queue.extend(getUsers, prepareQueue);

  function getCalendars(identity, listener, query) {
    var allArguments = Array.prototype.slice.apply(arguments);
    allArguments.unshift('getCalendars');

    return queryNonCalendarObjects.apply(null, allArguments);
  }
  getCalendars = queue.extend(getCalendars, prepareQueue);

  function getSharedCalendars(identity, listener, query) {
    var allArguments = Array.prototype.slice.apply(arguments);
    allArguments.unshift('getSharedCalendars');

    return queryNonCalendarObjects.apply(null, allArguments);
  }
  getSharedCalendars = queue.extend(getSharedCalendars, prepareQueue);

  function queryNonCalendarObjects(procedure, identity, listener, query) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    queue.waitUntilFinished();
    authenticationDelegate.authenticate(identity, future, function(future) {
      queue.finished();

      if (!Components.isSuccessCode(future.status())) {
        onResult(future, listener);
        return;
      }

      future
        .push('ESClient.' + procedure, [query])
        .call(onResult, listener)
    });

    return future;
  }

  function createCalendar(identity, listener, calendar) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    queue.waitUntilFinished();
    authenticationDelegate.authenticate(identity, future, function(future) {
      queue.finished();

      if (!Components.isSuccessCode(future.status())) {
        onResult(future, listener);
        return;
      }

      future.push('ESClient.createCalendar', [calendar.calname]);
      if (calendar.calname != calendar.name) {
        future.push('ESClient.setCalendarAttribute', [
          getCalendarCalspec(calendar),
          'title',
          calendar.name,
          true
        ]);
      }
      if (calendar.getProperty('color')) {
        future.push('ESClient.setCalendarAttribute', [
          getCalendarCalspec(calendar),
          'color',
          calendar.getProperty('color'),
          true
        ]);
      }

      future.call(onResult, listener);
    });

    return future;
  }
  createCalendar = queue.extend(createCalendar, prepareQueue);

  function deleteCalendar(identity, listener, calendar) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    queue.waitUntilFinished();
    authenticationDelegate.authenticate(identity, future, function(future) {
      queue.finished();

      if (!Components.isSuccessCode(future.status())) {
        onResult(future, listener);
        return;
      }

      future
        .push('ESClient.deleteCalendar', [calendar.calname])
        .call(onResult, listener);
    });

    return future;
  }
  deleteCalendar = queue.extend(deleteCalendar, prepareQueue);

  function subscribeCalendar(identity, listener, calspec) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    queue.waitUntilFinished();
    authenticationDelegate.authenticate(identity, future, function(future) {
      queue.finished();

      if (!Components.isSuccessCode(future.status())) {
        onResult(future, listener);
        return;
      }
      future
        .push('ESClient.subscribeCalendar', [calspec])
        .call(onResult, listener);
    });

    return future;
  }
  subscribeCalendar = queue.extend(subscribeCalendar, prepareQueue);

  function setCalendarAttribute(identity, listener, calendar, name, value,
                                isPublic) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    queue.waitUntilFinished();
    authenticationDelegate.authenticate(identity, future, function(future) {
      queue.finished();

      if (!Components.isSuccessCode(future.status())) {
        onResult(future, listener);
        return;
      }

      future
        .push('ESClient.setCalendarAttribute', [
          getCalendarCalspec(calendar),
          name,
          value,
          isPublic])
        .call(onResult, listener);
    });

    return future;
  }
  setCalendarAttribute = queue.extend(setCalendarAttribute, prepareQueue);

  function queryObjects(identity, listener, calendar, id, from, to) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    queue.waitUntilFinished();
    authenticationDelegate.authenticate(identity, future, function(future) {
      queue.finished();

      if (!Components.isSuccessCode(future.status())) {
        onResult(future, listener);
        return;
      }

      future.push(
        'ESClient.queryObjects', [
          getCalendarCalspec(calendar),
          getQueryFromQueryObjectsArguments(id, from, to)])
        .call(onResult, listener);
    });

    return future;
  }
  queryObjects = queue.extend(queryObjects, prepareQueue);

  function getQueryFromQueryObjectsArguments(id, from, to) {
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

    return query;
  }

  function addObject(identity, listener, calendar, item) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    queue.waitUntilFinished();
    authenticationDelegate.authenticate(identity, future, function(future) {
      queue.finished();

      if (!Components.isSuccessCode(future.status())) {
        onResult(future, listener);
        return;
      }

      enqueueItemTimezones(future, item);

      future
        .push('ESClient.addObject', [
          getCalendarCalspec(calendar),
          item.icalComponent.serializeToICS()])
        .call(onResult, listener);
    });

    return future;
  }
  addObject = queue.extend(addObject, prepareQueue);

  function updateObject(identity, listener, calendar, item) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    queue.waitUntilFinished();
    authenticationDelegate.authenticate(identity, future, function(future) {
      queue.finished();

      if (!Components.isSuccessCode(future.status())) {
        onResult(future, listener);
        return;
      }

      enqueueItemTimezones(future, item);

      future
        .push('ESClient.updateObject', [
          getCalendarCalspec(calendar),
          item.icalComponent.serializeToICS()])
        .call(onResult, listener);
    });
  }
  updateObject = queue.extend(updateObject, prepareQueue);

  function enqueueItemTimezones(future, item) {
    item.icalComponent.getReferencedTimezones({}).forEach(function(timezone) {
      future.push('ESClient.addObject', [
        getCalendarCalspec(calendar),
        timezone.icalComponent.serializeToICS()
      ]);
    });

    return future;
  }

  function deleteObject(identity, listener, calendar, item) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    queue.waitUntilFinished();
    authenticationDelegate.authenticate(identity, future, function(future) {
      queue.finished();

      if (!Components.isSuccessCode(future.status())) {
        onResult(future, listener);
        return;
      }

      future
        .push('ESClient.deleteObject', [getCalendarCalspec(calendar), item.id])
        .call(onResult, listener);
    });

    return future;
  }
  deleteObject = queue.extend(deleteObject, prepareQueue);

  function freeBusy(identity, listener, attendee, from, to, defaultTimezone) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    queue.waitUntilFinished();
    authenticationDelegate.authenticate(identity, future, function(future) {
      queue.finished();

      if (!Components.isSuccessCode(future.status())) {
        onResult(future, listener);
        return;
      }

      future
        .push('ESClient.deleteObject', [
          attendee,
          xpcomToEeeDate(from),
          xpcomToEeeDate(to),
          defaultTimezone])
        .call(onResult, listener);
    });

    return future;
  }
  freeBusy = queue.extend(freeBusy, prepareQueue);

  function prepareQueue(identity, listener) {
    var queue = new Queue();
    queue.setServerUri(uriFromIdentity(identity));

    return validateQueue(
      queue, listener, cal3eResponse.userErrors.BAD_CERT
    );
  }

  function uriFromIdentity(identity) {
    var host, port;
    if (cal3eFeature.isSupported('dns')) {
      [host, port] = dns.resolveServer(
        identity.email.substring(identity.email.indexOf('@') + 1)
      );
    } else {
      host = identity.getCharAttribute('eee_host');
      port = identity.getIntAttribute('eee_port');
    }

    return Services.io.newURI(
      'https://' + host + ':' + port + '/RPC2', null, null
    );
  }

  function onResult(methodQueue, listener) {
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
    } else if (!methodQueue.isPending()) {
      result = cal3eResponse.fromMethodQueue(methodQueue);
    } else if (methodQueue.isPending()) {
      return;
    }

    listener(methodQueue, result);
  }

  function getCalendarCalspec(calendar) {
    var uriParts = calendar.uri.spec.split('/', 5);

    return uriParts[2] + ':' + (uriParts[4] || uriParts[3]);
  }

  function init() {
    if (cal3eFeature.isSupported('dns')) {
      dns = new cal3eDns();
    }

    lastUserErrors = null;
  }

  client.getUsers = getUsers;
  client.getCalendars = getCalendars;
  client.getSharedCalendars = getSharedCalendars;
  client.createCalendar = createCalendar;
  client.deleteCalendar = deleteCalendar;
  client.subscribeCalendar = subscribeCalendar;
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
    clientInstance = new Client(
      new AuthenticationDelegate()
    );
  }

  return clientInstance;
};

function AuthenticationDelegate() {
  var authenticationDelegate = this;
  var promptLimit;
  var sessionStorage;

  function authenticate(identity, queue, callback) {
    var tries = 0;
    var login = null;
    while (!login && (tries < promptLimit)) {
      login = findInStorages(identity) || findByPrompt(identity);
      validate(login, queue, callback);
    }
  }

  function findInStorages(identity) {
    var logins = [];
    [sessionStorage, Services.logins].forEach(function(storage) {
      if (logins.length > 0) {
        return;
      }

      logins = storage.findLogins(
        {}, loginUri(identity), loginUri(identity), null
      );
    });

    return logins.length > 0 ? logins[0] : null;
  }

  function findByPrompt(identity) {
    var [login, didEnterPassword, savePassword] = prompt(identity);

    var storage = savePassword ? Services.logins : sessionStorage;
    if (didEnterPassword && !findInStorages(identity)) {
      storage.addLogin(login);
    } else if (didEnterPassword) {
      storage.modifyLogin(findInStorages(identity), login);
    }

    return login;
  }

  function prompt(identity) {
    var stringBundle = Services.strings.createBundle(
      'chrome://calendar3e/locale/cal3eCalendar.properties'
    );

    var password = { value: '' };
    var savePassword = { value: true };
    var didEnterPassword = Services.prompt.promptPassword(
      null,
      stringBundle.GetStringFromName('cal3ePasswordDialog.title'),
      stringBundle.GetStringFromName('cal3ePasswordDialog.content'),
      password,
      stringBundle.GetStringFromName('cal3ePasswordDialog.save'),
      savePassword
    );

    var login =
      Components.classes['@mozilla.org/login-manager/loginInfo;1']
      .createInstance(Components.interfaces.nsILoginInfo);
    login.init(
      loginUri(identity), loginUri(identity), null,
      identity.email, password.value,
      '', ''
    );

    return [login, didEnterPassword, savePassword.value];
  }

  function validate(login, queue, callback) {
    if (!login) {
      queue.setError(Components.Exception(
        "User error '" + cal3eResponse.userErrors.NO_PASSWORD + "'"
      ));
      callback(queue);
      return;
    }

    queue
      .push('ESClient.authenticate', [login.username, login.password])
      .call(didValidate, callback);
  }

  function didValidate(queue, callback) {
    if (queue.isPending()) {
      return;
    }

    callback(queue);
  }

  function loginUri(identity) {
    //XXX not DRY - somehow use EeeProtocol class
    return 'eee://' +
      identity.email.substring(identity.email.indexOf('@') + 1);
  }

  function init() {
    sessionStorage = new LoginInfoSessionStorage();
    promptLimit = Services.prefs.getIntPref(
      'calendar.eee.password_prompt_limit'
    );
  }

  authenticationDelegate.authenticate = authenticate;

  init();
}

function LoginInfoSessionStorage() {
  var loginInfoSessionStorage = this;
  var storage;

  function addLogin(login) {
    prepareStorageForHostname(login.hostname)

    storage[login.hostname][login.username] = login;
  }

  function modifyLogin(oldLogin, newLogin) {
    removeLogin(oldLogin);
    addLogin(newLogin);
  }

  function removeLogin(login) {
    if (!storage[login.hostname]) {
      return;
    }

    if (storage[login.hostname][login.username]) {
      delete storage[login.hostname][login.username];
    }

    cleanupStorageForHostname(login.hostname);
  }

  function findLogins(count, hostname, url, realm) {
    var logins = [];

    if (!storage[hostname]) {
      count['value'] = logins.length;
      return logins;
    }

    prepareStorageForHostname(hostname);

    var username;
    for (username in storage[hostname]) {
      if (!storage[hostname].hasOwnProperty(username)) {
        continue;
      }

      logins.push(storage[hostname][username]);
    }

    count['value'] = logins.length;
    return logins;
  }

  function prepareStorageForHostname(hostname) {
    if (!storage[hostname]) {
      storage[hostname] = {};
    }
  }

  function cleanupStorageForHostname(hostname) {
    if (!storage[hostname]) {
      return
    }

    var empty = true;
    var username;
    for (username in storage[hostname]) {
      empty = !storage[hostname].hasOwnProperty(username);
      if (!empty) break;
    }

    if (empty) {
      delete storage[hostname][username];
    }
  }

  function init() {
    storage = {};
  }

  loginInfoSessionStorage.addLogin = addLogin;
  loginInfoSessionStorage.modifyLogin = modifyLogin;
  loginInfoSessionStorage.removeLogin = removeLogin;
  loginInfoSessionStorage.findLogins = findLogins;

  init();
}

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
  var methodIdx;
  var methodCalls;
  var pending;
  var status;
  var error;
  var id;

  function push(methodName, parameters) {
    if (pending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }

    methodCalls.push([methodName, parameters]);
    status = Components.results.NS_OK;

    return queue;
  }

  function call(listener, context) {
    if (pending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }
    if (serverUri === undefined) {
      throw Components.results.NS_ERROR_NOT_INITIALIZED;
    }

    pending = methodCalls.length > methodIdx;
    callNext({
      'listener': listener,
      'context': context
    });

    return queue;
  }

  function callNext(context) {
    if (!pending) {
      return;
    }

    var callArguments = methodCalls[methodIdx].slice();
    callArguments.push(context);
    server.call.apply(server, callArguments);
  }

  function onResult(resultServer, result, context) {
    // skip handling of responses from canceled requests
    if (resultServer !== server) {
      return;
    }

    passToListenerGoNext(result, context);
  }

  function onFault(resultServer, fault, context) {
    // skip handling of responses from canceled requests
    if (resultServer !== server) {
      return;
    }

    passToListenerGoNext(fault, context);
  }

  function passToListenerGoNext(response, context) {
    lastResponse = response;
    methodIdx += 1;
    pending = methodCalls.length > methodIdx;
    callNext(context);
    context['listener'](queue, context['context']);
  }

  function onError(resultServer, serverError, context) {
    // skip handling of responses from canceled requests
    if (resultServer !== server) {
      return;
    }

    setError(serverError);
    context['listener'](queue, context['context']);
  }

  function getId() {
    return id;
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

  function setError(newError) {
    lastResponse = null;
    pending = false;
    status = newError.result;
    error = newError;

    return queue;
  }

  function cancel() {
    server.abort();
    pending = false;
  }

  function setServerUri(newServerUri) {
    if (pending) {
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
    queueSequence += 1;
    id = 'cal3eRequest.Queue.' + queueSequence;

    server = new cal3eXmlRpc.Client();
    server.setListener({
      onResult: onResult,
      onFault: onFault,
      onError: onError
    });

    methodIdx = 0;
    methodCalls = [];
    pending = false;
    status = Components.results.NS_OK;
    error = null;
  }

  queue.component = getComponent;
  queue.id = getId;
  queue.isPending = isPending;
  queue.isFault = isFault;
  queue.status = getStatus;
  queue.setServerUri = setServerUri;
  queue.serverUri = getServerUri;
  queue.lastResponse = getLastResponse;
  queue.error = getError;
  queue.setError = setError;
  queue.cancel = cancel;
  queue.push = push;
  queue.call = call;

  init();
}
var queueSequence = 0;

var cal3eRequest = {
  Client: Client
};
EXPORTED_SYMBOLS = [
  'cal3eRequest'
];
