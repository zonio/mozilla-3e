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

Components.utils.import("resource://calendar3e/modules/xml-rpc.jsm");

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

  function onError(resultServer, status, message) {
    // skip handling of responses from canceled requests
    if (resultServer !== server) {
      return;
    }

    lastResponse = null;
    pending = false;
    status = status;
    error = Components.Exception(message, status);
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
  "Queue": Queue
};
EXPORTED_SYMBOLS = [
  "cal3eRequest"
];
