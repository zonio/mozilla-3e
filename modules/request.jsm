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

Components.utils.import('resource://gre/modules/NetUtil.jsm');
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://calendar3e/modules/dns.jsm');
Components.utils.import('resource://calendar3e/modules/feature.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/model.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');
Components.utils.import('resource://calendar3e/modules/synchronization.jsm');
Components.utils.import('resource://calendar3e/modules/xml-rpc.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

/**
 * @todo create a request constructor instead of this scenario nonsense
 * @todo since {@link updateObject} is doesn't always update call
 * ESClient.updateObject, the general rule about method names being
 * related to scenarios is no longer true
 */
function Client(serverBuilder, authenticationDelegate,
                queueValidationDelegate) {
  var client = this;
  var synchronizedMethod = new cal3eSynchronization.Method();

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
    queue.push('ESClient.createCalendar', [cal3eModel.calendarName(calendar)]);

    return queue.call(onResult, listener);
  }
  createCalendar = synchronizedMethod.create(
    createScenario(createCalendar), createQueue
  );

  function deleteCalendar(identity, listener, calendar) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.deleteCalendar', [cal3eModel.calendarName(calendar)])
      .call(onResult, listener);
  }
  deleteCalendar = synchronizedMethod.create(
    createScenario(deleteCalendar), createQueue
  );

  function subscribeCalendar(identity, listener, calendar) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.subscribeCalendar', [
        cal3eModel.calendarCalspec(calendar)])
      .call(onResult, listener);
  }
  subscribeCalendar = synchronizedMethod.create(
    createScenario(subscribeCalendar), createQueue
  );

  function unsubscribeCalendar(identity, listener, calendar) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.unsubscribeCalendar', [
        cal3eModel.calendarCalspec(calendar)])
      .call(onResult, listener);
  }
  unsubscribeCalendar = synchronizedMethod.create(
    createScenario(unsubscribeCalendar), createQueue
  );

  function setCalendarAttribute(identity, listener, calendar, name, value,
                                isPublic) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.setCalendarAttribute', [
        cal3eModel.calendarCalspec(calendar),
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
        cal3eModel.calendarCalspec(calendar),
        query])
      .call(onResult, listener);
  }
  queryObjects = synchronizedMethod.create(
    createScenario(queryObjects), createQueue
  );

  function addObject(identity, listener, calendar, item) {
    return uploadAttachments(
      identity, listener, item, synchronizedMethod.future(arguments),
      function(queue) {
        enqueueAddObject(queue, calendar, item);
        queue.call(onResult, listener);
      });
  }
  addObject = synchronizedMethod.create(
    createScenario(addObject), createQueue
  );

  function updateObject(identity, listener, calendar, newItem, oldItem) {
    var args = Array.prototype.slice.apply(arguments);
    var queue = synchronizedMethod.future(arguments);
    var synchronizationQueue = this;

    return uploadAttachments(
      identity, listener, newItem, synchronizedMethod.future(arguments),
      function(queue) {
        if (oldItem.hasProperty('RECURRENCE-ID') &&
            newItem.hasProperty('RECURRENCE-ID')) {
          synchronizationQueue
            .push(findExistingObjectAndPrepareCall)
            .push(enqueueCrudAndCall);
        } else if (oldItem.recurrenceInfo && newItem.recurrenceInfo) {
          synchronizationQueue
            .push(prepareExceptionsToDelete)
            .push(enqueueCrudAndCall);
        } else {
          args.unshift(enqueueUpdateObject);
          synchronizationQueue.push(enqueueCrudAndCall);
        }

        synchronizationQueue.next().apply(synchronizationQueue, args);
    });
  }
  updateObject = synchronizedMethod.create(
    createScenario(updateObject), createQueue
  );

  function deleteObject(identity, listener, calendar, item) {
    var queue = synchronizedMethod.future(arguments);

    enqueueDeleteObject(queue, calendar, item);
    return queue.call(onResult, listener);
  }
  deleteObject = synchronizedMethod.create(
    createScenario(deleteObject), createQueue
  );

  function freeBusy(identity, listener, attendee, from, to, defaultTimezone) {
    return synchronizedMethod.future(arguments)
      .push('ESClient.freeBusy', [
        attendee,
        cal3eUtils.nsprTimeToEeeDate(from),
        cal3eUtils.nsprTimeToEeeDate(to),
        defaultTimezone])
      .call(onResult, listener);
  }
  freeBusy = synchronizedMethod.create(
    createScenario(freeBusy), createQueue
  );

  function findExistingObjectAndPrepareCall(identity, listener, calendar,
                                            newItem, oldItem) {
    var args = Array.prototype.slice.apply(arguments);
    var queue = synchronizedMethod.future(arguments);
    var synchronizationQueue = this;

    queue
      .push('ESClient.queryObjects', [
        cal3eModel.calendarCalspec(calendar),
        "match_uid('" + cal3eUtils.getInstanceId(newItem, newItem) + "')"
      ])
      .call(function(queue, listener) {
        var result = cal3eResponse.fromRequestQueue(queue);
        if (!(result instanceof cal3eResponse.Success)) {
          onResult(queue, listener);
          return;
        }

        var parser = Components.classes['@mozilla.org/calendar/ics-parser;1']
          .createInstance(Components.interfaces.calIIcsParser);
        try {
          parser.parseString(result.data);
        } catch (e) {
          queue.setError(e);
          onResult(queue, listener);
          return;
        }

        args.unshift(parser.getItems({}).length === 0 ?
                     enqueueAddObject :
                     enqueueUpdateObject);
        synchronizationQueue.next().apply(synchronizationQueue, args);
      }, listener);
  }

  function prepareExceptionsToDelete(identity, listener, calendar, newItem,
                                     oldItem) {
    var args = Array.prototype.slice.apply(arguments);
    args.unshift(enqueueUpdateObject);
    var queue = synchronizedMethod.future(arguments);
    var synchronizationQueue = this;

    function filterExdates(item) {
      return item instanceof Components.interfaces.calIRecurrenceDate &&
        item.isNegative;
    }

    var hasNoExceptionsToDelete = oldItem.recurrenceInfo.getRecurrenceItems({})
      .filter(filterExdates)
      .every(function(oldItemInstance) {
        return newItem.recurrenceInfo.getRecurrenceItems({})
          .filter(filterExdates)
          .some(function(newItemIntance) {
            return newItemIntance.icalProperty.icalString ===
              oldItemInstance.icalProperty.icalString;
          });
      });
    if (hasNoExceptionsToDelete) {
      synchronizationQueue.next().apply(synchronizationQueue, args);
      return;
    }

    queue
      .push('ESClient.queryObjects', [
        cal3eModel.calendarCalspec(calendar),
        "match_id('" + newItem.id + "')"
      ])
      .call(function(queue, listener) {
        var result = cal3eResponse.fromRequestQueue(queue);
        if (!(result instanceof cal3eResponse.Success)) {
          onResult(queue, listener);
          return;
        }

        var parser = Components.classes['@mozilla.org/calendar/ics-parser;1']
          .createInstance(Components.interfaces.calIIcsParser);
        try {
          parser.parseString(result.data);
        } catch (e) {
          queue.setError(e);
          onResult(queue, listener);
          return;
        }

        parser.getParentlessItems({}).forEach(function(parentlessItems) {
          enqueueDeleteObject(queue, calendar, newItem, parentlessItems);
        });

        synchronizationQueue.next().apply(synchronizationQueue, args);
      }, listener);
  }

  function enqueueCrudAndCall(enqueueCrud, identity, listener, calendar,
                              item) {
    var queue = synchronizedMethod.future(arguments);
    enqueueCrud(queue, calendar, item);

    return queue.call(onResult, listener);
  }

  function enqueueItemTimezones(queue, calendar, item) {
    item.icalComponent.getReferencedTimezones({}).forEach(function(timezone) {
      if (timezone.icalComponent) {
        queue.push('ESClient.addObject', [
          cal3eModel.calendarCalspec(calendar),
          timezone.icalComponent.serializeToICS()
        ]);
      }
    });
  }

  function enqueueAddObject(queue, calendar, item) {
    enqueueItemTimezones(queue, calendar, item);
    queue.push('ESClient.addObject', [
      cal3eModel.calendarCalspec(calendar),
      item.icalComponent.serializeToICS()
    ]);
  }

  function enqueueUpdateObject(queue, calendar, item) {
    enqueueItemTimezones(queue, calendar, item);
    queue.push('ESClient.updateObject', [
      cal3eModel.calendarCalspec(calendar),
      item.icalComponent.serializeToICS()
    ]);
  }

  function enqueueDeleteObject(queue, calendar, item, itemInstance) {
    queue.push('ESClient.deleteObject', [
      cal3eModel.calendarCalspec(calendar),
      cal3eUtils.getInstanceId(item, itemInstance)
    ]);
  }

  function uploadAttachments(identity, listener, item, queue, callback) {
    if (!cal3eFeature.isSupported('attachments')) {
      callback(queue);
      return queue;
    }

    var attachments = item.getAttachments({});
    var idx = 0;

    function uploadAttachment() {
      var xhr = Components.classes[
        '@mozilla.org/xmlextras/xmlhttprequest;1'
      ].createInstance(Components.interfaces.nsIXMLHttpRequest);
      xhr.open('POST', cal3eUtils.fileAttachmentToEeeUri(
        attachments[idx].uri, identity.email
      ));
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      xhr.addEventListener('error', function() {
        queue.setError(Components.Exception('Upload error.'));
        listener(queue, cal3eResponse.fromMethodQueue(queue));
      }, false);

      xhr.addEventListener('load', function() {
        if (idx < attachments.length) {
          uploadAttachment();
          idx += 1;
        } else {
          callback(queue);
        }
      }, false);

      var channel = Services.io.newChannel(cal3eUtils.fileAttachmentToEeeUri(
        attachments[idx].uri, identity.email
      ).spec, null, null)
        .QueryInterface(Components.interfaces.nsIUploadChannel);
      channel.setUploadStream(
        Services.io.newChannel(attachments[idx].uri.spec, null, null).open(),
        'application/octet-stream',
        -1
      );
      channel.asyncOpen({
        QueryInterface: XPCOMUtils.generateQI([
          Components.interfaces.nsIStreamListener
        ]),
        onStopRequest: function() {
        },
        onStartRequest: function() {
        },
        onDataAvailable: function() {
        }
      }, null);
    }
    uploadAttachment();

    attachments.forEach(function(attach) {
      if (attach.uri.schemeIs('file')) {
        attach.uri = cal3eUtils.fileAttachmentToEeeUri(
          attach.uri, identity.email
        );
      }
    });

    return queue;
  }

  function createScenario(main) {
    return function runScenario() {
      return new cal3eSynchronization.Queue()
        .push(initQueue)
        .push(checkQueueSecurity)
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

      if (stopScenarioIfUserError(queue, listener)) {
        return queue;
      }

      synchronizationQueue.next().apply(synchronizationQueue, args);
    });

    return queue;
  }

  //TODO use XHR or channel to check this SSL certificate on the other
  // side
  function checkQueueSecurity(identity, listener) {
    var args = Array.prototype.slice.apply(arguments);
    var queue = synchronizedMethod.future(arguments);
    var synchronizationQueue = this;

    if (stopScenarioIfUserError(queue, listener)) {
      return queue;
    }

    queue.push('ESClient.getServerAttributes', ['']).call(function() {
      if (stopScenarioIfUserError(queue, listener)) {
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

    if (stopScenarioIfUserError(queue, listener)) {
      return queue;
    }

    authenticationDelegate.authenticate(identity, queue, function(queue) {
      if (stopScenarioIfUserError(queue, listener)) {
        return queue;
      }

      synchronizedMethod.finished();
      synchronizationQueue.next().apply(synchronizationQueue, args);
    });

    return queue;
  }

  function stopScenarioIfUserError(queue, listener) {
    queueValidationDelegate.apply(queue);

    return stopScenario(
      queue,
      listener,
      queueValidationDelegate.validate(queue)
    );
  }

  function stopScenario(queue, listener, error) {
    if (Components.isSuccessCode(queue.status())) {
      return false;
    }

    synchronizedMethod.finished();
    listener(error || cal3eResponse.fromRequestQueue(queue));

    return true;
  }

  function onResult(queue, listener) {
    if (queue.isPending()) {
      return;
    }

    var error = queueValidationDelegate.apply(queue);
    listener(error || cal3eResponse.fromRequestQueue(queue), queue);
  }

  client.getUsers = getUsers;
  client.getCalendars = getCalendars;
  client.getSharedCalendars = getSharedCalendars;
  client.createCalendar = createCalendar;
  client.deleteCalendar = deleteCalendar;
  client.subscribeCalendar = subscribeCalendar;
  client.unsubscribeCalendar = unsubscribeCalendar;
  client.setCalendarAttribute = setCalendarAttribute;
  client.queryObjects = queryObjects;
  client.addObject = addObject;
  client.updateObject = updateObject;
  client.deleteObject = deleteObject;
  client.freeBusy = freeBusy;
}
var clientInstance;
Client.getInstance = function Client_getInstance() {
  if (!clientInstance) {
    clientInstance = new Client(
      new ServerBuilder(),
      new AuthenticationDelegate(),
      new QueueValidationDelegate()
    );
  }

  return clientInstance;
};

function ServerBuilder() {
  var serverBuilder = this;
  var dns;

  function fromIdentity(identity, callback) {
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

function AuthenticationDelegate() {
  var authenticationDelegate = this;
  var sessionStorage;

  function authenticate(identity, queue, callback) {
    if (!Components.isSuccessCode(queue.status())) {
      callback(queue);
      return;
    }

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
      Components.classes['@mozilla.org/embedcomp/window-watcher;1']
      .getService(Components.interfaces.nsIPromptFactory)
      .getPrompt(null, Components.interfaces.nsIAuthPrompt)
      .promptPassword(
        stringBundle.GetStringFromName(
          'cal3ePasswordDialog.title'),
        stringBundle.formatStringFromName(
          'cal3ePasswordDialog.content', [identity.email], 1),
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
      queue.setError(Components.Exception('No password given'));
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
    var logins = storage
      .findLogins(
        {}, loginInfoHostname(identity), null, loginInfoHostname(identity)
      )
      .filter(function(login) {
        return login.username === loginInfoUsername(identity);
      });

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
      (cal3eResponse.fromRequestQueue(queue).errorCode ===
       cal3eResponse['eeeErrors']['AUTH_FAILED']);
  }

  function loginUri(identity) {
    return Services.io.newURI('eee://' + identity.email + '/', null, null);
  }

  function loginInfoHostname(identity) {
    return loginUri(identity).scheme + '://' + loginUri(identity).host;
  }

  function loginInfoUsername(identity) {
    return decodeURIComponent(loginUri(identity).username);
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

function QueueValidationDelegate() {
  var queueValidationDelegate = this;
  var userErrors;

  function validate(queue) {
    if (getValidUserErrors(queue).length > 0) {
      setUserError(queue, getValidUserErrors(queue)[0]);
    } else if (getUserErrors(queue).length > 0) {
      cleanupUserErrors(queue);
    }

    return getValidUserErrors(queue)[0];
  }

  function apply(queue) {
    if (!findQueueErrorCode(queue)) {
      return null;
    }

    var error = new cal3eResponse.UserError(findQueueErrorCode(queue));
    storeUserError(queue, error);
    setUserError(queue, error);

    return error;
  }

  function getUserErrors(queue) {
    return userErrors && userErrors[queue.server().uri().spec] ?
      userErrors[queue.server().uri().spec] :
      [];
  }

  function getValidUserErrors(queue) {
    return getUserErrors(queue).filter(isValid);
  }

  function isValid(error) {
    var threshold = new Date(
      Date.now() -
      Services.prefs.getIntPref('extensions.calendar3e.user_error_timeout')
    );

    return error.timestamp > threshold;
  }

  function setUserError(queue, error) {
    return queue.setError(
      Components.Exception("User error '" + error.errorCode + "'")
    );
  }

  function findQueueErrorCode(queue) {
    var errorCode;
    if (isBadCert(queue)) {
      errorCode = cal3eResponse['userErrors']['BAD_CERT'];
    } else if (isNoPassword(queue)) {
      errorCode = cal3eResponse['userErrors']['NO_PASSWORD'];
    } else {
      errorCode = null;
    }

    return errorCode;
  }

  function isBadCert(queue) {
    return queue.error() &&
        (queue.error().result === Components.results.NS_ERROR_FAILURE) &&
        (queue.error().message === 'Server certificate exception not added');
  }

  function isNoPassword(queue) {
    return queue.error() &&
        (queue.error().result === Components.results.NS_ERROR_FAILURE) &&
        (queue.error().message === 'No password given');
  }

  function storeUserError(queue, error) {
    if (!userErrors) {
      userErrors = {};
      userErrors.length = 0;
    }
    if (!userErrors[queue.server().uri().spec]) {
      userErrors[queue.server().uri().spec] = [];
      userErrors.length += 1;
    }

    userErrors[queue.server().uri().spec].push(error);
  }

  function cleanupUserErrors(queue) {
    userErrors[queue.server().uri().spec] =
      userErrors[queue.server().uri().spec].filter(isValid);
    if (userErrors[queue.server().uri().spec].length === 0) {
      delete userErrors[queue.server().uri().spec];
      userErrors.length -= 1;
    }
    if (userErrors.length === 0) {
      userErrors = null;
    }
  }

  queueValidationDelegate.validate = validate;
  queueValidationDelegate.apply = apply;
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
