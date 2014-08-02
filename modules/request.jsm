/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2012 - 2013  Zonio s.r.o.
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
Components.utils.import('resource://calendar3e/modules/sd.jsm');
Components.utils.import('resource://calendar3e/modules/feature.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/logger.jsm');
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
                queueValidationDelegate, logger) {
  var client = this;
  var synchronizedMethod = new cal3eSynchronization.Method();
  var logger;

  function getUsers(identity, listener, query) {
    return synchronizedMethod.promise(arguments)
      .push('ESClient.getUsers', [query])
      .call(onResult, listener);
  }
  getUsers = synchronizedMethod.create(
    createScenario(getUsers), createQueue
  );

  function getCalendars(identity, listener, query) {
    return synchronizedMethod.promise(arguments)
      .push('ESClient.getCalendars', [query])
      .call(onResult, listener);
  }
  getCalendars = synchronizedMethod.create(
    createScenario(getCalendars), createQueue
  );

  function getSharedCalendars(identity, listener, query) {
    return synchronizedMethod.promise(arguments)
      .push('ESClient.getSharedCalendars', [query])
      .call(onResult, listener);
  }
  getSharedCalendars = synchronizedMethod.create(
    createScenario(getSharedCalendars), createQueue
  );

  function createCalendar(identity, listener, calendar) {
    var queue = synchronizedMethod.promise(arguments);
    queue.push('ESClient.createCalendar', [cal3eModel.calendarName(calendar)]);

    return queue.call(onResult, listener);
  }
  createCalendar = synchronizedMethod.create(
    createScenario(createCalendar), createQueue
  );

  function deleteCalendar(identity, listener, calendar) {
    return synchronizedMethod.promise(arguments)
      .push('ESClient.deleteCalendar', [cal3eModel.calendarName(calendar)])
      .call(onResult, listener);
  }
  deleteCalendar = synchronizedMethod.create(
    createScenario(deleteCalendar), createQueue
  );

  function subscribeCalendar(identity, listener, calendar) {
    return synchronizedMethod.promise(arguments)
      .push('ESClient.subscribeCalendar', [
        cal3eModel.calendarCalspec(calendar)])
      .call(onResult, listener);
  }
  subscribeCalendar = synchronizedMethod.create(
    createScenario(subscribeCalendar), createQueue
  );

  function unsubscribeCalendar(identity, listener, calendar) {
    return synchronizedMethod.promise(arguments)
      .push('ESClient.unsubscribeCalendar', [
        cal3eModel.calendarCalspec(calendar)])
      .call(onResult, listener);
  }
  unsubscribeCalendar = synchronizedMethod.create(
    createScenario(unsubscribeCalendar), createQueue
  );

  function setCalendarAttribute(identity, listener, calendar, name, value,
                                isPublic) {
    return synchronizedMethod.promise(arguments)
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

  function getUserPermissions(identity, listener, calendar) {
    return synchronizedMethod.promise(arguments)
      .push('ESClient.getUserPermissions', [cal3eModel.calendarName(calendar)])
      .call(onResult, listener);
  }
  getUserPermissions = synchronizedMethod.create(
    createScenario(getUserPermissions), createQueue
  );

  function getGroupPermissions(identity, listener, calendar) {
    return synchronizedMethod.promise(arguments)
      .push('ESClient.getGroupPermissions', [cal3eModel.calendarName(calendar)])
      .call(onResult, listener);
  }
  getGroupPermissions = synchronizedMethod.create(
    createScenario(getGroupPermissions), createQueue
  );

  function setUserPermission(identity, listener, calendar, username, perm) {
    return synchronizedMethod.promise(arguments)
      .push('ESClient.setUserPermission',
        [cal3eModel.calendarName(calendar), username, perm])
      .call(onResult, listener);
  }
  setUserPermission = synchronizedMethod.create(
    createScenario(setUserPermission), createQueue
  );

  function setGroupPermission(identity, listener, calendar, groupname, perm) {
    return synchronizedMethod.promise(arguments)
      .push('ESClient.setGroupPermission',
        [cal3eModel.calendarName(calendar), groupname, perm])
      .call(onResult, listener);
  }
  setGroupPermission = synchronizedMethod.create(
    createScenario(setGroupPermission), createQueue
  );

  function getGroups(identity, listener, query) {
    return synchronizedMethod.promise(arguments)
      .push('ESClient.getGroups', [query])
      .call(onResult, listener);
  }
  getGroups = synchronizedMethod.create(
    createScenario(getGroups), createQueue
  );

  function queryObjects(identity, listener, calendar, query) {
    return synchronizedMethod.promise(arguments)
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
      identity, listener, item, synchronizedMethod.promise(arguments),
      function(queue) {
        enqueueAddObject(queue, calendar, item);
        queue.call(onResult, listener);
      });
  }
  addObject = synchronizedMethod.create(
    createScenario(addObject), createQueue
  );

  function downloadAttachment(identity, listener, attachmentEeeUri) {
    return _downloadAttachment(
      identity, listener, attachmentEeeUri,
      synchronizedMethod.promise(arguments));
  }
  downloadAttachment = synchronizedMethod.create(
    createScenario(downloadAttachment), createQueue
  );

  function updateObject(identity, listener, calendar, newItem, oldItem) {
    var args = Array.prototype.slice.apply(arguments);
    var queue = synchronizedMethod.promise(arguments);
    var synchronizationQueue = this;

    return uploadAttachments(
      identity, listener, newItem, synchronizedMethod.promise(arguments),
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
    var queue = synchronizedMethod.promise(arguments);

    enqueueDeleteObject(queue, calendar, item);
    return queue.call(onResult, listener);
  }
  deleteObject = synchronizedMethod.create(
    createScenario(deleteObject), createQueue
  );

  function freeBusy(identity, listener, attendee, from, to, defaultTimezone) {
    return synchronizedMethod.promise(arguments)
      .push('ESClient.freeBusy', [
        attendee,
        (new Date(from / 1000)).toISOString(),
        (new Date(to / 1000)).toISOString(),
        defaultTimezone])
      .call(onResult, listener);
  }
  freeBusy = synchronizedMethod.create(
    createScenario(freeBusy), createQueue
  );

  function findExistingObjectAndPrepareCall(identity, listener, calendar,
                                            newItem, oldItem) {
    var args = Array.prototype.slice.apply(arguments);
    var queue = synchronizedMethod.promise(arguments);
    var synchronizationQueue = this;

    queue
      .push('ESClient.queryObjects', [
        cal3eModel.calendarCalspec(calendar),
        "match_id('" + cal3eUtils.getInstanceId(newItem, newItem) + "') " +
        "and not deleted()"
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
    var queue = synchronizedMethod.promise(arguments);
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
        "match_uid('" + newItem.id + "')"
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
    var queue = synchronizedMethod.promise(arguments);
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
    var attachments = item.getAttachments({});
    var host = queue.getServer().uri().host + ':' +
               queue.getServer().uri().port;
    var password = authenticationDelegate.password(identity);

    item.getAttachments({}).forEach(function(attachment) {
      if (!attachment.uri.schemeIs('file')) {
        return;
      }
      logger.info('Uploading attachment ' +
        decodeURIComponent(attachment.uri.spec));

      var xhr = Components.classes['@mozilla.org/xmlextras/xmlhttprequest;1']
        .createInstance(Components.interfaces.nsIXMLHttpRequest);
      var splittedPath = attachment.uri.path.split('/');
      var sha1 = cal3eUtils.computeSha1(attachment.uri);
      var url = 'https://' + host + '/attachments/' + sha1 + '/' +
        splittedPath[splittedPath.length - 1];

      xhr.open('POST', url);
      var basicAuthHash = btoa(identity.email + ':' + password);
      xhr.setRequestHeader('Authorization', 'Basic ' + basicAuthHash);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      xhr.addEventListener('error', function(evt) {
        logger.error('Attachment ' + decodeURIComponent(attachment.uri.spec) +
            ' could not be uploaded. ' + evt.target.responseText);
        queue.setError(Components.Exception(evt.target.responseText));
        listener(queue, cal3eResponse.fromRequestQueue(queue));
      }, false);

      xhr.addEventListener('load', function(evt) {
        if (evt.target.status == '409') {
          logger.warn('Attachment ' + decodeURIComponent(attachment.uri.spec) +
          ' wasn\'t uploaded. It already exists on server.');
        } else if (evt.target.status != '200') {
          logger.error('Attachment ' + decodeURIComponent(attachment.uri.spec) +
            ' could not be uploaded. ' + evt.target.responseText);
          queue.setError(Components.Exception(evt.target.responseText));
          listener(queue, cal3eResponse.fromRequestQueue(queue));
          return;
        } else {
          logger.info('Attachment ' + decodeURIComponent(attachment.uri.spec) +
            ' successfully uploaded');
        }
      }, false);

      var localFile = Components.classes['@mozilla.org/file/local;1']
        .createInstance(Components.interfaces.nsILocalFile);
      localFile.initWithPath(decodeURIComponent(attachment.uri.path));

      NetUtil.asyncFetch(localFile, function(inputStream, status) {
        if (!Components.isSuccessCode(status)) {
          queue.setError(Components.Exception('Cannot read attachment.'));
          listener(queue, cal3eResponse.fromRequestQueue(queue));
        }

        try {
          xhr.send(inputStream);
        } catch (error) {
          logger.error('Attachment ' + decodeURIComponent(attachment.uri.spec) +
            ' could not be uploaded. ' + error.message);
          queue.setError(Components.Exception('Cannot upload attachment. ' +
            error.message));
          listener(queue, cal3eResponse.fromRequestQueue(queue));
        }
      });
    });

    attachments.forEach(function(attach) {
      if (attach.uri.schemeIs('file')) {
        attach.uri = cal3eUtils.fileAttachmentToEeeUri(
          attach.uri, identity.email
        );
      }
    });

    callback(queue);
  }

  function _downloadAttachment(identity, listener, eeeUri, queue) {
    logger.info('Downloading attachment ' + eeeUri);
    var host = queue.getServer().uri().host + ':' +
               queue.getServer().uri().port;
    var password = authenticationDelegate.password(identity);

    var xhr = Components.classes['@mozilla.org/xmlextras/xmlhttprequest;1']
      .createInstance(Components.interfaces.nsIXMLHttpRequest);
    var splittedPath = eeeUri.split('/');
    var url = 'https://' + host + '/attachments/' +
      splittedPath[splittedPath.length - 2] + '/' +
      splittedPath[splittedPath.length - 1];

    xhr.open('GET', url);
    /* Response must be array buffer else binary data are currupted when
     * using stream to save them to disk. */
    xhr.responseType = 'arraybuffer';
    var basicAuthHash = btoa(identity.email + ':' + password);
    xhr.setRequestHeader('Authorization', 'Basic ' + basicAuthHash);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.addEventListener('error', function(evt) {
      logger.error('Attachment ' + eeeUri + ' cannot be downloaded. ' +
        evt.target.responseText);
    }, false);

    xhr.addEventListener('load', function(evt) {
      logger.info('Attachment ' + eeeUri + ' successfuly downloaded.');
      listener(evt.target.status, new Int8Array(evt.target.response));
    }, false);

    try {
      xhr.send();
    } catch (error) {
      logger.error('Attachment ' + attachment.uri.spec +
        ' could not be donwloaded. ' + error.message);
    }
  }

  function createScenario(main) {
    return function runScenario() {
      var queue = synchronizedMethod.promise(arguments);
      logger.info('[' + queue.id() + '] Running scenario "' + main.name + '"');

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
    var queue = synchronizedMethod.promise(arguments);
    var synchronizationQueue = this;

    serverBuilder.fromIdentity(identity, logger)
      .then(function(server) {
        queue.setServer(server);

        if (stopScenarioIfUserError(queue, listener)) {
          return queue;
        }

        synchronizationQueue.next().apply(synchronizationQueue, args);
      }, function(error) {
        logger.warn(
          '[' + queue.id() + '] Cannot initialize queue because of error: ' +
            error.name + '(' + error.message + ')'
        );
        queue.setError(error);
        stopScenario(queue, listener);
      });

    return queue;
  }

  //TODO use XHR or channel to check this SSL certificate on the other
  // side
  function checkQueueSecurity(identity, listener) {
    var args = Array.prototype.slice.apply(arguments);
    var queue = synchronizedMethod.promise(arguments);
    var synchronizationQueue = this;

    if (stopScenarioIfUserError(queue, listener)) {
      return queue;
    }

    queue.push('ESClient.getServerAttributes', ['']).call(function() {
      if (stopScenarioIfUserError(queue, listener)) {
        logger.warn('[' + queue.id() + '] Cannot verify whether the server ' +
                    'is secure');
        return queue;
      }

      synchronizationQueue.next().apply(synchronizationQueue, args);
    });

    return queue;
  }

  function authenticateQueue(identity, listener) {
    var args = Array.prototype.slice.apply(arguments);
    var queue = synchronizedMethod.promise(arguments);
    var synchronizationQueue = this;

    if (stopScenarioIfUserError(queue, listener)) {
      return queue;
    }

    authenticationDelegate.authenticate(identity, queue, function(queue) {
      if (stopScenarioIfUserError(queue, listener)) {
        logger.warn('[' + queue.id() + '] Cannot authenticate');
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

    var result = error || cal3eResponse.fromRequestQueue(queue);
    logger.info('[' + queue.id() + '] Scenario finished unsuccessfully ' +
                'with result ' +
                result.constructor.name + '(' + result.errorCode + ')');

    listener(result, queue);

    return true;
  }

  function onResult(queue, listener) {
    if (queue.isPending()) {
      return;
    }

    var error = queueValidationDelegate.apply(queue);
    var result = error || cal3eResponse.fromRequestQueue(queue);
    logger.info('[' + queue.id() + '] Scenario finished with result ' +
                result.constructor.name + '(' + result.errorCode + ')');

    listener(result, queue);
  }

  client.getUsers = getUsers;
  client.getCalendars = getCalendars;
  client.getSharedCalendars = getSharedCalendars;
  client.createCalendar = createCalendar;
  client.deleteCalendar = deleteCalendar;
  client.subscribeCalendar = subscribeCalendar;
  client.unsubscribeCalendar = unsubscribeCalendar;
  client.setCalendarAttribute = setCalendarAttribute;
  client.getUserPermissions = getUserPermissions;
  client.getGroupPermissions = getGroupPermissions;
  client.setUserPermission = setUserPermission;
  client.setGroupPermission = setGroupPermission;
  client.getGroups = getGroups;
  client.queryObjects = queryObjects;
  client.addObject = addObject;
  client.updateObject = updateObject;
  client.deleteObject = deleteObject;
  client.freeBusy = freeBusy;
  client.downloadAttachment = downloadAttachment;
}
var clientInstance;
Client.getInstance = function Client_getInstance() {
  if (!clientInstance) {
    clientInstance = new Client(
      new ServerBuilder(),
      new AuthenticationDelegate(),
      new QueueValidationDelegate(),
      cal3eLogger.create('extensions.calendar3e.log.request')
    );
  }

  return clientInstance;
};

function ServerBuilder() {
  var serverBuilder = this;
  var sd;

  function fromIdentity(identity) {
    return sd.resolveServer(getHostname(identity)).then(function(service) {
      return new cal3eXmlRpc.Client(Services.io.newURI(
        'https://' + service + '/RPC2', null, null
      ));
    }, function() {
      throw Components.Exception(
        'No service found for "' + identity.email + '"'
      );
    });
  }

  function getHostname(identity) {
    return identity.email.substring(identity.email.indexOf('@') + 1);
  }

  function init() {
    sd = new cal3eSd();
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
      'chrome://calendar3e/locale/calendar3e.properties'
    );

    var mozillaStringBundle = Services.strings.createBundle(
      'chrome://chat/locale/accounts.properties'
    );

    var password = {
      value: findInStorages(identity) ?
        findInStorages(identity).password :
        ''
    };

    var shouldSave = { value: false };

    var didEnterPassword =
      Components.classes['@mozilla.org/embedcomp/prompt-service;1']
        .getService(Components.interfaces.nsIPromptService)
        .promptPassword(null,
          stringBundle.GetStringFromName(
            'calendar3e.passwordDialog.title'),
          stringBundle.formatStringFromName(
            'calendar3e.passwordDialog.content', [identity.email], 1),
          password,
          mozillaStringBundle.GetStringFromName(
            'passwordPromptSaveCheckbox'),
          shouldSave);

    // LoginManagerPrompter doesn't support session storage
    if (didEnterPassword && !findInStorages(identity)) {
      addToStorage(shouldSave.value ? Services.logins : sessionStorage,
        identity, password.value);
    }

    return didEnterPassword ? findInStorages(identity) : null;
  }

  function password(identity) {
    var loginInfo = findInStorages(identity) || prompt(identity);
    return loginInfo ? loginInfo.password : null;
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
      .push('ESClient.authenticate', [eeeUsername(login), login.password], [1])
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
  authenticationDelegate.password = password;

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
      Components.Exception('User error "' + error.errorCode + '"')
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

  function push(methodName, parameters, masked) {
    if (pending) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }

    methodCalls.push([methodName, parameters, masked]);
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
  queue.getServer = getServer;
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
