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
  var executing;
  var pending;
  var status;
  var error;
  var timestamp;

  function id() {
    var lastMethod = methodCalls.length > 0 ?
      methodCalls[methodCalls.length - 1][0] :
      "-- not initialized --" ;

    return serverUri.spec + ':' + lastMethod + '.' + timestamp;
  }

  function isPending() {
    return pending;
  }

  function status() {
    return status;
  }

  function error() {
    return error;
  }

  function cancel() {
    server.abort();
    executing = false;
    server = null;
    lastResponse = undefined;
  }

  function setServerUri(newServerUri) {
    if (executing) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }

    serverUri = newServerUri;
    status = Components.results.NS_OK;
  }

  function serverUri() {
    return serverUri;
  }

  function lastResponse() {
    if ('undefined' === typeof lastResponse) {
      throw Components.results.NS_ERROR_NOT_AVAILABLE;
    }

    return lastResponse;
  }

  function isFault() {
    return lastResponse() && lastResponse().isFault();
  }

  function push(methodName, parameters) {
    if (executing) {
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

  function execute(listener, context) {
    if (executing) {
      throw Components.results.NS_ERROR_IN_PROGRESS;
    }
    if ('undefined' === typeof serverUri) {
      throw Components.results.NS_ERROR_NOT_INITIALIZED;
    }

    executing = true;
    listener = listener;
    context = context;
    methodIdx = 0;
    executeNext();
  }

  function executeNext() {
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
      executeNext();
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

  function init() {
    methodCalls = [];
    executing = false;
    pending = false;
    status = Components.results.NS_OK;
    error = null;
    timestamp = 1 * (new Date());
  }

  init();
}

var cal3eRequest = {
  "Queue": Queue
};
EXPORTED_SYMBOLS = [
  "cal3eRequest"
];
