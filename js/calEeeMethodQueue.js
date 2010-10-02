/* ***** BEGIN LICENSE BLOCK *****
 * Mozilla 3e Calendar Extension
 * Copyright © 2010  Zonio s.r.o.
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
const Cr = Components.result;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

EXPORTED_SYMBOLS = [
  "calEeeMethodQueue"
];

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
  this._methods = [];
  this._pending = true;
  this._status = Cr.NS_OK;
  this._executing = false;
}

calEeeMethodQueue.prototype = {

  // XPCOMUtils definition
  classDescription: "Queue for methods to be executed on the EEE server.",
  classID: Component.ID("{e2b342d0-6119-43d0-8fc6-6116876d2fdb}"),
  contractID: "@zonio.net/calendar3e/method-queue;1",

  QueryInterface: XPCOMUtils.generateQI([
    Ci.calEeeIMethodQueue,
    Ci.nsIXmlRpcClientListener
  ]),

  /**
   * Identifier of this method queue.
   *
   * It is generated from server URI and last method name.
   *
   * @property {String}
   * @todo add proper unique identifier (is it necessary?)
   */
  get id calEeeMq_get_id() {
    var uri = this._uri.spec,
        lastMethod = this._methods[this._methods.length - 1];

    return uri + ':' + lastMethod;
  },

  /**
   * Indicator whether method queue has been executed already.
   *
   * @property {Boolean}
   */
  get isPending calEeeMq_get_isPending() {
    return this._pending;
  },

  /**
   * Current method queue status.
   *
   * Mozilla standard errors such as NS_OK and NS_ERROR_FAILURE are used.
   *
   * @return {Number}
   */
  get status calEeeMq_get_status() {
    return this._status;
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
  set serverUri calEeeMq_set_serverUri(uri) {
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
  get serverUri calEeeMq_get_serverUri() {
    return this._uri;
  },

  /**
   * Last repsonse from successful method call returned by the EEE server.
   *
   * @property {nsISupports}
   * @throws {NS_ERROR_NOT_AVAILABLE} if called before all methods have been
   * called
   */
  get lastResponse calEeeMq_get_lastResponse() {
    if ('undefined' === typeof this._lastResponse) {
      throw Cr.NS_ERROR_NOT_AVAILABLE;
    }

    return this._lastResponse;
  },

  /**
   * Puts a method to the end of this queue with its parameters.
   *
   *
   *
   * @param {String} methodName fully specified EEE method name
   * @param {Number} length number of arguments passed to the method
   * @param {Array} parameters method parameters themselves
   * @returns {calEeeMethodQueue} receiver
   * @throws {NS_ERROR_IN_PROGRESS} if called after method calls have already
   * been executed
   */
  enqueueMethod: function calEeeMq_enqueueMethod(methodName, length,
                                                 parameters) {
    if (this._executing) {
      throw Cr.NS_ERROR_IN_PROGRESS;
    }

    var methodEnvelope = [
      methodName, parameters, length
    ];
    this._methods.push(methodEnvelope);
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

    var server = Cc["@mozilla.org/xml-rpc/client;1"].
        createInstance(Ci.nsIXmlRpcClient);
    server.init(this._uri.spec());
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
    var methodEnvelope = this._methods[this._methodIdx],
        serverArguments = [this, methodEnvelope[0]];
    serverArguments = serverArguments.concat(methodEnvelope);
    this._server.asyncCall.apply(this._server, serverArguments);
  },

  /**
   * Notifies listener that method was called on the server and continues
   * in method execution or finishes if there are no left.
   *
   * Listener receives name of executed method and a context it registers
   * during execution.
   *
   * @param {nsIXmlRpcClient} server XML-RPC client
   * @param {String} methodName name of method successfully called
   * @param {nsISupports} result result returned by the method call
   */
  onResult: function calEeeMq_onResult(server, methodName, result) {
    // skip handling of responses from canceled requests
    if (server !== this._server) {
      return;
    }

    this._methodIdx += 1;
    this._lastResponse = result;
    if (this._methods.length > this._methodIdx) {
      this._listener.onResult(this, [methodName, this._context]);
      this._executeNext();
    } else {
      this._pending = false;
      this._listener.onResult(this, [methodName, this._context]);
    }
  },

  /**
   * Notifies listener that method was called and sets queue to failure state.
   *
   * @param {nsIXmlRpcClient} server XML-RPC client
   * @param {String} methodName name of method which caused a failure
   * @param {nsIXmlRpcFault} fault
   */
  onFault: function calEeeMq_onFault(server, methodName, fault) {
    // skip handling of responses from canceled requests
    if (server !== this._server) {
      return;
    }

    this._lastResponse = null;
    this._pending = false;
    this._status = Cr.NS_ERROR_FAILURE;
    this._listener.onResult(this, [methodName, this._context]);
  },

  /**
   * Notifies listener that method was called and sets queue to not OK state.
   *
   * @param {nsIXmlRpcClient} server XML-RPC client
   * @param {String} methodName name of method which caused an error
   * @param {Number} status error code
   * @param {String} message description of error
   */
  onError: function calEeeMq_onError(server, methodName, status, message) {
    // skip handling of responses from canceled requests
    if (server !== this._server) {
      return;
    }

    this._lastResponse = null;
    this._pending = false;
    this._status = status;
    this._listener.onResult(this, [methodName, this._context]);
  }

};
