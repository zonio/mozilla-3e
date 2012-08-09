/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2011  Zonio s.r.o.
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
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://calendar3e/modules/xml-rpc.jsm");

/**
 * Queue holding methods to be called on EEE server and their responses.
 *
 * This queue does not allow multiple execution. It simply executes method,
 * notifies listener registered during execution and then is leaved read-only
 * state without.
 *
 * Read-only state can be reset by {@see cancel} method but queued method
 * stays.
 *
 * This queue uses old Mozilla's XML-RPC client which was removed from Mozilla
 * SDK but is still functional.
 *
 * @todo use more robust (nsIVariant) and modern XML-RPC client
 */
function calEeeMethodQueue() {
  this._methodCalls = [];
  this._pending = true;
  this._status = Cr.NS_OK;
  this._errorDescription = null;
  this._executing = false;
  this._timestamp = 1 * (new Date());
}

calEeeMethodQueue.prototype = {

  classDescription: "Queue for methods to be executed on the EEE server",

  classID: Components.ID("{bd47191f-9617-4a77-ae79-b7927b535f4c}"),

  contractID: "@zonio.net/calendar3e/method-queue;1",

  QueryInterface: XPCOMUtils.generateQI([
    Ci.calEeeIMethodQueue
  ]),

  /**
   * Identifier of this method queue.
   *
   * It is generated from server URI and last method name.
   *
   * @property {String}
   * @todo add proper unique identifier (is it necessary?)
   */
  get id() {
    var uri = this._uri.spec;
    var lastMethod = "-- not initialized --";
    if (this._methodCalls.length > 0) {
      lastMethod = this._methodCalls[this._methodCalls.length - 1][0];
    }

    return uri + ':' + lastMethod + '.' + this._timestamp;
  },

  /**
   * Indicator whether method queue has been executed already.
   *
   * @property {Boolean}
   */
  get isPending() {
    return this._pending;
  },

  /**
   * Current method queue status.
   *
   * Mozilla standard errors such as NS_OK and NS_ERROR_FAILURE are used.
   *
   * @return {Number}
   */
  get status() {
    return this._status;
  },

  /**
   * Current method queue error description.
   *
   * This is a complement to method queue's status.
   *
   * @return {String}
   */
  get errorDescription() {
    return this._errorDescription;
  },

  /**
   * Cancels execution of currently requested methods.
   *
   * Does nothing if execution has not start yet.
   */
  cancel: function calEeeMq_cancel() {
    this._executing = false;
    this._server = null;
    this._lastResponse = undefined;
  },

  /**
   * Sets URI of the EEE server where method calls will be sent.
   *
   * To send set server URI after execution, you need to cancel it first.
   *
   * @param {nsIURI} uri
   * @throws {NS_ERROR_IN_PROGRESS} if called before the first server
   * response to method calls has been returned fro the server
   */
  set serverUri(uri) {
    if (this._executing) {
      throw Cr.NS_ERROR_IN_PROGRESS;
    }

    this._uri = uri;
    this._status = Cr.NS_OK;
  },

  /**
   * URI of the EEE server where method calls are sent.
   *
   * @property {nsIURI}
   */
  get serverUri() {
    return this._uri;
  },

  /**
   * Last repsonse from successful method call returned by the EEE server.
   *
   * @property {nsISupports}
   * @throws {NS_ERROR_NOT_AVAILABLE} if called before all methods have been
   * called
   */
  get lastResponse() {
    if ('undefined' === typeof this._lastResponse) {
      throw Cr.NS_ERROR_NOT_AVAILABLE;
    }

    return this._lastResponse;
  },

  /**
   * Checks whether last response was a fault or not.
   *
   * @property {Boolean}
   * @throws {NS_ERROR_NOT_AVAILABLE} if called before all methods have been
   * called
   */
  get isFault() {
    return this.lastResponse && this.lastResponse.isFault();
  },

  /**
   * Puts a method to the end of this queue with its parameters.
   *
   * @param {String} methodName fully specified EEE method name
   * @param {Number} count number of arguments passed to the method
   * @param {Array} parameters method parameters themselves
   * @returns {calEeeMethodQueue} receiver
   * @throws {NS_ERROR_IN_PROGRESS} if called after method calls have already
   * been executed
   */
  enqueueMethod: function calEeeMq_enqueueMethod(methodName, count,
                                                 parameters) {
    if (this._executing) {
      throw Cr.NS_ERROR_IN_PROGRESS;
    }

    this._methodCalls.push([ methodName, parameters, count ]);
    this._status = Cr.NS_OK;

    return this;
  },

  /**
   * Executes queue of queued methods on EEE server.
   *
   * @param {calIGenericOperationListener} listener gets notified when methods
   * execution finishes
   * @param {Object} context passed to the listener along with method name
   * @returns {calEeeMethodQueue} receiver
   * @throws {NS_ERROR_IN_PROGRESS} if called after method calls have already
   * been executed
   * @throws {NS_ERROR_NOT_INITIALIZED} if called with no server URI set
   */
  execute: function calEeeMq_execute(listener, context) {
    if (this._executing) {
      throw Cr.NS_ERROR_IN_PROGRESS;
    }
    if ('undefined' === typeof this._uri) {
      throw Cr.NS_ERROR_NOT_INITIALIZED;
    }

    var methodQueue = this;
    var server = new cal3eXmlRpc.Client();
    server.setUri(this._uri);
    this._server.setListener({
      "onResult": function(server, result) {
        methodQueue.onResult(server, result);
      },
      "onFault": function(server, fault) {
        methodQueue.onFault(server, fault);
      },
      "onError": function(server, status, description) {
        methodQueue.onError(server, status, description);
      }
    });

    this._executing = true;
    this._server = server;
    this._listener = listener;
    this._context = context;
    this._methodIdx = 0;
    this._executeNext();
  },

  /**
   * Executes EEE method from this queue on the server.
   */
  _executeNext: function calEeeMq_executeNext() {
    var context = Cc["@mozilla.org/supports-cstring;1"]
      .createInstance(Ci.nsISupportsCString);
    context.data = this._methodCalls[this._methodIdx][0];

    var callArguments = [ this, context ];
    callArguments = callArguments.concat(this._methodCalls[this._methodIdx]);
    this._server.call.apply(this._server, callArguments);
  },

  /**
   * Notifies listener that method was called on the server and continues
   * in method execution or finishes if there are no left.
   *
   * Listener receives name of executed method and a context it registers
   * during execution.
   *
   * @param {nsIXmlRpcClient} server XML-RPC client
   * @param {nsISupports} result result returned by the method call
   */
  onResult: function calEeeMq_onResult(server, result) {
    // skip handling of responses from canceled requests
    if (server !== this._server) {
      return;
    }

    this._passToListenerGoNext(result);
  },

  /**
   * Notifies listener that method was called and sets queue to failure state.
   *
   * @param {nsIXmlRpcClient} server XML-RPC client
   * @param {nsIXmlRpcFault} fault
   */
  onFault: function calEeeMq_onFault(server, fault) {
    // skip handling of responses from canceled requests
    if (server !== this._server) {
      return;
    }

    this._lastResponse = fault;
    this._passToListenerGoNext(fault);
  },

  _passToListenerGoNext: function calEeeMq_passToListenerGoNext(response) {
    this._methodIdx += 1;
    this._lastResponse = response;
    try {
      if (this._methodCalls.length <= this._methodIdx) {
        this._pending = false;
      }
      this._listener.onResult(this, this._context);
    } catch (e) {
      let lastExec = this._pending;
      this._lastResponse = null;
      this._pending = false;
      this._status = e.result;
      if (lastExec) {
        this._listener.onResult(this, this._context);
      }
    }
    if (this._pending) {
      this._executeNext();
    }
  },

  /**
   * Notifies listener that method was called and sets queue to not OK state.
   *
   * @param {nsIXmlRpcClient} server XML-RPC client
   * @param {Number} status error code
   * @param {String} message description of error
   */
  onError: function calEeeMq_onError(server, status, message) {
    // skip handling of responses from canceled requests
    if (server !== this._server) {
      return;
    }

    this._lastResponse = null;
    this._pending = false;
    this._status = status;
    this._errorDescription = message;
    this._listener.onResult(this, this._context);
  }

}

const NSGetFactory = XPCOMUtils.generateNSGetFactory([calEeeMethodQueue]);
