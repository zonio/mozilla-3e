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
Components.utils.import('resource://calendar3e/modules/dns.jsm');
Components.utils.import('resource://calendar3e/modules/feature.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');
Components.utils.import('resource://calendar3e/modules/synchronization.jsm');
Components.utils.import('resource://calendar3e/modules/xml-rpc.jsm');

function Client(serverBuilder, authenticationDelegate) {
  var client = this;
  var synchronizedMethod = new cal3eSynchronization.Method();
  var lastUserErrors;

  function validateQueue(queue, listener, errorCode) {
    var error = findLastUserError(
      queue.server().uri().spec, errorCode
    );
    var threshold = new Date(
      Date.now() - Services.prefs.getIntPref('calendar.eee.user_error_timeout')
    );
    if (error && error.timestamp > threshold) {
      queue.setError(Components.Exception("User error '" + errorCode + "'"));
      listener(queue, error);
    } else if (error) {
      cleanLastUserError(queue.server().uri().spec, errorCode);
      error = null;
    }

    return queue;
  }

  function setLastUserError(queue, errorCode) {
    prepareLastUserErrorMap(queue.server().uri().spec, errorCode);

    lastUserErrors[queue.server().uri().spec][errorCode] =
      new cal3eResponse.UserError(errorCode);

    queue.setError(Components.Exception("User error '" + errorCode + "'"));

    return lastUserErrors[queue.server().uri().spec][errorCode];
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
    return synchronizedMethod.future(arguments)
      .push('ESClient.getUsers', [query])
      .call(onResult, listener);
  }
  getUsers = synchronizedMethod.create(
    createScenario(getUsers), createQueue
  );

  function getCalendars(identity, listener, query) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.getCalendars', [query])
      .call(onResult, listener);
  }
  getCalendars = synchronizedMethod.create(
    createScenario(getCalendars), createQueue
  );

  function getSharedCalendars(identity, listener, query) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.getSharedCalendars', [query])
      .call(onResult, listener);
  }
  getSharedCalendars = synchronizedMethod.create(
    createScenario(getSharedCalendars), createQueue
  );

  function createCalendar(identity, listener, calendar) {
    var queue = synchronizedMethod.future(arguments);
    queue.push('ESClient.createCalendar', [calendar.calname]);
    if (calendar.calname != calendar.name) {
      queue.push('ESClient.setCalendarAttribute', [
        getCalendarCalspec(calendar),
        'title',
        calendar.name,
      true
      ]);
    }
    if (calendar.getProperty('color')) {
      queue.push('ESClient.setCalendarAttribute', [
        getCalendarCalspec(calendar),
        'color',
        calendar.getProperty('color'),
        true
      ]);
    }

    return queue.call(onResult, listener);
  }
  createCalendar = synchronizedMethod.create(
    createScenario(createCalendar), createQueue
  );

  function deleteCalendar(identity, listener, calendar) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.deleteCalendar', [calendar.calname])
      .call(onResult, listener);
  }
  deleteCalendar = synchronizedMethod.create(
    createScenario(deleteCalendar), createQueue
  );

  function subscribeCalendar(identity, listener, calspec) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.subscribeCalendar', [calspec])
      .call(onResult, listener);
  }
  subscribeCalendar = synchronizedMethod.create(
    createScenario(subscribeCalendar), createQueue
  );

  function setCalendarAttribute(identity, listener, calendar, name, value,
                                isPublic) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.setCalendarAttribute', [
        getCalendarCalspec(calendar),
        name,
        value,
        isPublic])
      .call(onResult, listener);
  }
  setCalendarAttribute = synchronizedMethod.create(
    createScenario(setCalendarAttribute), createQueue
  );

  function queryObjects(identity, listener, calendar, query) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.queryObjects', [
        getCalendarCalspec(calendar),
        query])
      .call(onResult, listener);
  }
  queryObjects = synchronizedMethod.create(
    createScenario(queryObjects), createQueue
  );

  function addObject(identity, listener, calendar, item) {
    enqueueItemTimezones(synchronizedMethod.future(arguments), item);

    return synchronizedMethod.future(arguments)
      .push('ESClient.addObject', [
        getCalendarCalspec(calendar),
        item.icalComponent.serializeToICS()])
      .call(onResult, listener);
  }
  addObject = synchronizedMethod.create(
    createScenario(addObject), createQueue
  );

  function updateObject(identity, listener, calendar, item) {
    enqueueItemTimezones(synchronizedMethod.future(arguments), item);

    return synchronizedMethod.future(arguments)
      .push('ESClient.updateObject', [
        getCalendarCalspec(calendar),
        item.icalComponent.serializeToICS()])
      .call(onResult, listener);
  }
  updateObject = synchronizedMethod.create(
    createScenario(updateObject), createQueue
  );

  function enqueueItemTimezones(queue, item) {
    item.icalComponent.getReferencedTimezones({}).forEach(function(timezone) {
      queue.push('ESClient.addObject', [
        getCalendarCalspec(calendar),
        timezone.icalComponent.serializeToICS()
      ]);
    });
  }

  function deleteObject(identity, listener, calendar, item) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.deleteObject', [getCalendarCalspec(calendar), item.id])
      .call(onResult, listener);
  }
  deleteObject = synchronizedMethod.create(
    createScenario(deleteObject), createQueue
  );

  function freeBusy(identity, listener, attendee, from, to, defaultTimezone) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.deleteObject', [
        attendee,
        xpcomToEeeDate(from),
        xpcomToEeeDate(to),
        defaultTimezone])
      .call(onResult, listener);
  }
  freeBusy = synchronizedMethod.create(
    createScenario(freeBusy), createQueue
  );

  function createScenario(main) {
    return function runScenario() {
      return new cal3eSynchronization.Queue()
        .push(initQueue)
        .push(authenticateQueue)
        .push(main)
        .call.apply(null, arguments);
    };
  }

  function createQueue() {
    return new Queue();
  }

  function initQueue(identity, listener) {
    synchronizedMethod.waitUntilFinished();

    var args = Array.prototype.slice.apply(arguments);
    var queue = synchronizedMethod.future(arguments);
    var synchronizationQueue = this;
    serverBuilder.fromIdentity(identity, function(server) {
      queue.setServer(server);
      validateQueue(queue, listener, cal3eResponse.userErrors.BAD_CERT);
      if (!Components.isSuccessCode(queue.status())) {
        synchronizedMethod.finished();
        return queue;
      }

      synchronizationQueue.next().apply(synchronizationQueue, args);
    });

    return queue;
  }

  function authenticateQueue(identity, listener) {
    var args = Array.prototype.slice.apply(arguments);
    var queue = synchronizedMethod.future(arguments);
    var synchronizationQueue = this;
    authenticationDelegate.authenticate(identity, queue, function(queue) {
      if (!Components.isSuccessCode(queue.status())) {
        synchronizedMethod.finished();
        return queue;
      }

      synchronizedMethod.finished();
      synchronizationQueue.next().apply(synchronizationQueue, args);
    });

    return queue;
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
      new ServerBuilder(),
      new AuthenticationDelegate()
    );
  }

  return clientInstance;
};

function ServerBuilder() {
  var serverBuilder = this;
  var dns;

  function fromIdentity(identity, callback) {
    if (!cal3eFeature.isSupported('dns')) {
      callback(new cal3eXmlRpc.Client(Services.io.newURI(
        'https://' +
          identity.getCharAttribute('eee_host') + ':' +
          identity.getIntAttribute('eee_port') + '/RPC2',
        null,
        null
      )));
      return;
    }

    dns.resolveServer(getHostname(identity), function(record) {
      callback(new cal3eXmlRpc.Client(Services.io.newURI(
        'https://' + record['host'] + ':' + record['port'] + '/RPC2',
        null,
        null
      )));
    });
  }

  function getHostname(identity) {
    return identity.email.substring(identity.email.indexOf('@') + 1);
  }

  function init() {
    dns = new cal3eDns();
  }

  serverBuilder.fromIdentity = fromIdentity;

  init();
}

/**
 * @todo needs queue validator
 */
function AuthenticationDelegate() {
  var authenticationDelegate = this;
  var sessionStorage;

  function authenticate(identity, queue, callback) {
    if (didQueueAuthFailed(queue)) {
      invalidate(identity);
    }

    validate(findInStorages(identity) || prompt(identity), queue, {
      callback: callback,
      identity: identity
    });
  }

  function findInStorages(identity) {
    var login = null;

    [sessionStorage, Services.logins].forEach(function(storage) {
      if (login) {
        return;
      }

      login = findInStorage(storage, identity);
    });

    return login;
  }

  function prompt(identity) {
    var stringBundle = Services.strings.createBundle(
      'chrome://calendar3e/locale/cal3eCalendar.properties'
    );

    var password = {
      value: findInStorages(identity) ?
        findInStorages(identity).password :
        ''
    };
    var didEnterPassword =
      Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
      .getService(Components.interfaces.nsIPromptFactory)
      .getPrompt(null, Components.interfaces.nsIAuthPrompt)
      .promptPassword(
        stringBundle.GetStringFromName('cal3ePasswordDialog.title'),
        stringBundle.GetStringFromName('cal3ePasswordDialog.content'),
        loginUri(identity).spec,
        Components.interfaces.nsIAuthPrompt.SAVE_PASSWORD_PERMANENTLY,
        password
      );

    // LoginManagerPrompter doesn't support session storage
    if (didEnterPassword && !findInStorages(identity)) {
      addToStorage(sessionStorage, identity, password.value);
    }

    return didEnterPassword ? findInStorages(identity) : null;
  }

  function invalidate(identity) {
    [sessionStorage, Services.logins].forEach(function(storage) {
      if (!findInStorage(storage, identity)) {
        return;
      }

      storage.removeLogin(findInStorage(storage, identity));
    });
  }

  function validate(login, queue, context) {
    if (!login) {
      queue.setError(Components.Exception(
        "User error '" + cal3eResponse.userErrors.NO_PASSWORD + "'"
      ));
      context.callback(queue);
      return;
    }

    queue
      .push('ESClient.authenticate', [eeeUsername(login), login.password])
      .call(didValidate, context);
  }

  function didValidate(queue, context) {
    if (queue.isPending()) {
      return;
    }

    if (didQueueAuthFailed(queue)) {
      authenticate(context.identity, queue, context.callback);
    } else {
      context.callback(queue);
    }
  }

  function findInStorage(storage, identity) {
    var logins = storage.findLogins(
      {}, loginInfoHostname(identity), null, loginInfoHostname(identity)
    );

    return logins.length > 0 ? logins[0] : null;
  }

  function addToStorage(storage, identity, password) {
    var login = Components.classes['@mozilla.org/login-manager/loginInfo;1']
      .createInstance(Components.interfaces.nsILoginInfo);
    login.init(
      loginInfoHostname(identity), null, loginInfoHostname(identity),
      loginInfoUsername(identity), password,
      '', ''
    );
    storage.addLogin(login);
  }

  function didQueueAuthFailed(queue) {
    return queue.isFault() &&
      (cal3eResponse.fromMethodQueue(queue).errorCode ===
       cal3eResponse.eeeErrors.AUTH_FAILED);
  }

  function loginUri(identity) {
    return Services.io.newURI('eee://' + identity.email + '/', null, null);
  }

  function loginInfoHostname(identity) {
    return loginUri(identity).scheme + '://' + loginUri(identity).host;
  }

  function loginInfoUsername(identity) {
    return loginUri(identity).username;
  }

  function eeeUsername(login) {
    return login.username + '@' +
      Services.io.newURI(login.hostname, null, null).host;
  }

  function init() {
    sessionStorage = new LoginInfoSessionStorage();
  }

  authenticationDelegate.authenticate = authenticate;

  init();
}

function LoginInfoSessionStorage() {
  var loginInfoSessionStorage = this;
  var storage;

  function addLogin(login) {
    prepareStorageForHostname(login.hostname);

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
      return;
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

function Queue() {
  var queue = this;
  var lastResponse;
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
    if (!server) {
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

  function setServer(newServer) {
    server = newServer;
    server.setListener({
      onResult: onResult,
      onFault: onFault,
      onError: onError
    });

    return queue;
  }

  function getServer() {
    return server;
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
  queue.setServer = setServer;
  queue.server = getServer;
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
