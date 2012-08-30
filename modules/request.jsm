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

function Client() {
  var client = this;
  var queue = new cal3eSynchronization.Queue();
  var dns;
  var lastUserErrors;
  var tmpLoginInfos;

  function enqueueAuthenticate(identity, methodQueue, listener) {
    //XXX move the whole password prompt/store/... functionality to
    // separate class

    if (!validateQueue(methodQueue, listener,
                       cal3eResponse.userErrors.NO_PASSWORD)) {
      return methodQueue;
    }

    var loginInfo = findLoginInfo(identity) ||
      promptForPasswordAndStoreIt(identity, methodQueue, listener);
    if (loginInfo) {
      methodQueue.push(
        'ESClient.authenticate', [identity.email, loginInfo.password]
      );
    }

    return methodQueue;
  }

  function passwordUri(identity) {
    //XXX not DRY - somehow use EeeProtocol class
    return 'eee://' +
      identity.email.substring(identity.email.indexOf('@') + 1);
  }

  function findLoginInfo(identity) {
    return findTmpLoginInfo(identity) || findPermLoginInfo(identity);
  }

  function findPermLoginInfo(identity) {
    var logins = Services.logins.findLogins(
      {}, passwordUri(identity), passwordUri(identity), null
    );

    return logins.length > 0 ? logins[0] : null;
  }

  function findTmpLoginInfo(identity) {
    return tmpLoginInfos && tmpLoginInfos[identity.key] ?
      tmpLoginInfos[identity.key] :
      null;
  }

  function promptForPassword(identity) {
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

    var loginInfo =
      Components.classes['@mozilla.org/login-manager/loginInfo;1']
      .createInstance(Components.interfaces.nsILoginInfo);
    loginInfo.init(
      passwordUri(identity), passwordUri(identity), null, identity.email,
      password.value, '', ''
    );

    return [loginInfo, didEnterPassword, savePassword.value];
  }

  function storePermLoginInfo(identity, loginInfo) {
    if (findPermLoginInfo(identity) === null) {
      Services.logins.addLogin(loginInfo);
    } else {
      Services.logins.modifyLogin(findPermLoginInfo(identity), loginInfo);
    }
  }

  function storeTmpLoginInfo(identity, loginInfo) {
    if (!tmpLoginInfos) {
      tmpLoginInfos = {};
    }
    tmpLoginInfos[identity.key] = loginInfo;
  }

  function promptForPasswordAndStoreIt(identity, methodQueue, listener) {
    var [loginInfo, didEnterPassword, savePassword] =
      promptForPassword(identity);

    if (didEnterPassword && savePassword) {
      storePermLoginInfo(identity, loginInfo);
    } else if (didEnterPassword) {
      storeTmpLoginInfo(identity, loginInfo);
    } else if (!didEnterPassword) {
      loginInfo = null;
      listener(
        methodQueue,
        setLastUserError(
          methodQueue, cal3eResponse.userErrors.NO_PASSWORD
        )
      );
    }

    return loginInfo;
  }

  function restartQueueWithNewPassword(methodQueue, listener) {
    methodQueue.cancel();
    var newMethodQueue = prepareQueue(
      findIdentityInQueue(methodQueue), listener
    );
    methodQueue.toArray().forEach(function(methodCall) {
      if (methodCall[0] === 'ESClient.authenticate') {
        methodCall[1][1] = promptForPasswordAndStoreIt(
          findIdentityByEmail(methodCall[1][0]),
          methodQueue,
          listener
        ).password;
      }
      newMethodQueue.push(methodCall[0], methodCall[1]);
    });

    newMethodQueue.call();
  }

  function findIdentityInQueue(queue) {
    var identity = null;
    queue.toArray().forEach(function(methodCall) {
      if (methodCall[0] === 'ESClient.authenticate') {
        identity = findIdentityByEmail(methodCall[1][0]);
      }
    });

    return identity;
  }

  function findIdentityByEmail(email) {
    var identities = cal3eIdentity.Collection()
      .getEnabled()
      .findByEmail(email);

    return identities.length > 0 ? identities[0] : null;
  }

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
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    var future = enqueueAuthenticate(identity, future, listener);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    return future
      .push('ESClient.getUsers', [query])
      .call();
  }
  getUsers = queue.extend(getUsers, prepareQueue);

  function getCalendars(identity, listener, query) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    var future = enqueueAuthenticate(identity, future, listener);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    return future
      .push('ESClient.getCalendars', [query])
      .call();
  }
  getCalendars = queue.extend(getCalendars, prepareQueue);

  function createCalendar(identity, listener, calendar) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    var future = enqueueAuthenticate(identity, future, listener);
    if (!Components.isSuccessCode(future.status())) {
      return future;
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

    return future.call();
  }
  createCalendar = queue.extend(createCalendar, prepareQueue);

  function deleteCalendar(identity, listener, calendar) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    var future = enqueueAuthenticate(identity, future, listener);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    return future
      .push('ESClient.deleteCalendar', [calendar.calname])
      .call();
  }
  deleteCalendar = queue.extend(deleteCalendar, prepareQueue);

  function setCalendarAttribute(identity, listener, calendar, name, value,
                                isPublic) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    var future = enqueueAuthenticate(identity, future, listener);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    return future
      .push('ESClient.setCalendarAttribute', [
        getCalendarCalspec(calendar),
        name,
        value,
        isPublic])
      .call();
  }
  setCalendarAttribute = queue.extend(setCalendarAttribute, prepareQueue);

  function queryObjects(identity, listener, calendar, id, from, to) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    var future = enqueueAuthenticate(identity, future, listener);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    return future.push(
      'ESClient.queryObjects', [
        getCalendarCalspec(calendar),
        getQueryFromQueryObjectsArguments(id, from, to)])
      .call();
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

    var future = enqueueAuthenticate(identity, future, listener);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    enqueueItemTimezones(future, item);

    return future
      .push('ESClient.addObject', [
        getCalendarCalspec(calendar),
        item.icalComponent.serializeToICS()])
      .call();
  }
  addObject = queue.extend(addObject, prepareQueue);

  function updateObject(identity, listener, calendar, item) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    var future = enqueueAuthenticate(identity, future, listener);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    enqueueItemTimezones(future, item);

    return future
      .push('ESClient.updateObject', [
        getCalendarCalspec(calendar),
        item.icalComponent.serializeToICS()])
      .call();
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

    var future = enqueueAuthenticate(identity, future, listener);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    return future
      .push('ESClient.deleteObject', [getCalendarCalspec(calendar), item.id])
      .call();
  }
  deleteObject = queue.extend(deleteObject, prepareQueue);

  function freeBusy(identity, listener, attendee, from, to, defaultTimezone) {
    var future = queue.future(arguments);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    var future = enqueueAuthenticate(identity, future, listener);
    if (!Components.isSuccessCode(future.status())) {
      return future;
    }

    return future
      .push('ESClient.deleteObject', [
        attendee,
        xpcomToEeeDate(from),
        xpcomToEeeDate(to),
        defaultTimezone])
      .call();
  }
  freeBusy = queue.extend(freeBusy, prepareQueue);

  function prepareQueue(identity, listener) {
    var queue = new Queue();
    queue
      .setServerUri(uriFromIdentity(identity))
      .setListener(onResult)
      .setContext(listener);

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
    } else if (methodQueue.isFault() &&
               (methodQueue.lastResponse().errorCode ===
                cal3eResponse.eeeErrors.AUTH_FAILED)) {
      restartQueueWithNewPassword(methodQueue, listener);
      return;
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
  var pending;
  var status;
  var error;
  var timestamp;

  function push(methodName, parameters) {
    if (pending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }

    methodCalls.push([methodName, parameters]);
    status = Components.results.NS_OK;

    return queue;
  }

  function toArray() {
    return methodCalls.slice();
  }

  function call() {
    if (pending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }
    if (serverUri === undefined) {
      throw Components.results.NS_ERROR_NOT_INITIALIZED;
    }

    methodIdx = 0;
    pending = methodCalls.length > methodIdx;
    callNext();

    return queue;
  }

  function callNext() {
    if (!pending) {
      return;
    }

    server.call.apply(server, methodCalls[methodIdx]);
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
    lastResponse = response;
    methodIdx += 1;
    pending = methodCalls.length > methodIdx;
    listener(queue, context);
    callNext();
  }

  function onError(resultServer, serverError) {
    // skip handling of responses from canceled requests
    if (resultServer !== server) {
      return;
    }

    setError(serverError);
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

  function setListener(newListener) {
    if (pending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }

    listener = newListener;

    return queue;
  }

  function setContext(newContext) {
    if (pending) {
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
  queue.setError = setError;
  queue.cancel = cancel;
  queue.push = push;
  queue.toArray = toArray;
  queue.call = call;

  init();
}

var cal3eRequest = {
  Client: Client
};
EXPORTED_SYMBOLS = [
  'cal3eRequest'
];
