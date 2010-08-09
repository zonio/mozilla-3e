EXPORTED_SYMBOLS = [
  "cal3eClient", "cal3eMethodStack", "cal3eMethod", "cal3eMethodResponse"
];

Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

/**
 * Representation of EEE method to call.
 *
 * EEE protocol invokes method in context of an interface which is either
 * ESClient or ESServer.
 *
 * @param cal3eInterface currently only an instance of cal3eClient
 * @param methodName name of the method to call
 *
 * @see cal3eMethodStack
 */
function cal3eMethod(cal3eInterface, methodName) {
  this._params = [];
  this.setInterface(cal3eInterface)
      .setMethodName(methodName);
}

cal3eMethod.prototype = {

  _interface: null,

  _methodName: null,

  setInterface: function cal3eMethod_set_interface(cal3eInterface) {
    this._interface  = cal3eInterface;
    return this;
  },

  setMethodName: function cal3eMethod_set_methodName(methodName) {
    this._methodName = '' + methodName;
    return this;
  },

  /**
   * Appends one parameter to currently set parameters.
   *
   * @param param another parameter to XML-RPC
   * @return receiver
   */
  addParam: function cal3eMethod_add_param(param) {
    this._params.push('' + param);
    return this;
  },

  /**
   * Returns an XML object for XML-RPC call.
   *
   * @return XML
   */
  toXML: function cal3eMethod_to_xml() {
    if (null === this._interface) {
      throw new Error("Interface must be set");
    }
    if (null === this._methodName) {
      throw new Error("Method name must be set");
    }
    var methodCall = <methodCall/>,
        methodNameText = this._interface.interfaceName +
          "." +
          this._methodName;
    methodCall.appendChild(<methodName>{methodNameText}</methodName>);

    var idx = -1, length = this._params.length, param,
        params = <params/>;
    while (++idx < length) {
      param = <param><value>{this._params[idx]}</value></param>;
      params.appendChild(param);
    }
    methodCall.appendChild(params);
    return methodCall;
  },

  toXMLString: function cal3eMethod_to_xmlString() {
    return this.toXML().toXMLString();
  }

}

/**
 * Representation of response to called {@link cal3eMethod}.
 *
 * Response could be an error or a usual result with value.
 */
function cal3eMethodResponse() {
}
/**
 * Builds {@link cal3eMethodResponse} from given XML.
 *
 * @param xml instance of XML retrieved from raw response
 * @return cal3eMethodResponse
 * @throws TypeError on bad XML structure
 */
cal3eMethodResponse.fromXml = function cal3eMethodResponse_factory_fromXml(xml) {
  if ('methodResponse' != xml.name()) {
    throw new TypeError("Uknown response root tag '" + xml.name() + "'");
  }
  var response = new cal3eMethodResponse();
  response._isError = !!xml.fault && !xml.params;
  var faultCode, faultString,
      responseValue;
  if (!response.isError()) {
    try {
      responseValue = xml.params.param.value;
    } catch (exp) {
      responseValue = null;
    }
    if (null !== responseValue) {
      response._value = this._parseValue(responseValue);
    } else {
      throw new TypeError("Uknown response structure");
    }
  } else {
    try {
      faultCode = 'faultCode' == xml.fault.value.struct.member[0].name ?
        xml.fault.value.struct.member[0].value.int :
        null ;
      faultString = 'faultString' == xml.fault.value.struct.member[1].name ?
        xml.fault.value.struct.member[1].value.string :
        null ;
    } catch (exp) {
      faultCode = null;
      faultString = null;
    }
    if ((null !== faultCode) && (null !== faultString)) {
      response._faultCode = faultCode;
      response._faultString = faultString;
    } else {
      throw new TypeError("Uknown fault structure");
    }
  }
  return response;
}
/**
 * Parses XML-RPC value to JavaScript equivalent.
 *
 * @param xmlRpcValue value XML element
 * @return parsed JavaScript value
 */
cal3eMethodResponse._parseValue = function cal3eMethodResponse_static_parseValue(xmlRpcValue) {
  var value = null;
  if ('value' != xmlRpcValue.name()) {
    throw new TypeError("Value element expected");
  }
  if (!xmlRpcValue.hasSimpleContent()) {
    xmlRpcValue = xmlRpcValue.child(0);
  }
  var type = '' + xmlRpcValue.name();
  switch (type) {
  case 'i4':
  case 'int':
    value = parseInt('' + xmlRpcValue);
    break;
  case 'boolean':
    value = !!parseInt('' + xmlRpcValue);
    break;
  case 'value':
  case 'string':
    value = '' + xmlRpcValue;
    break;
  case 'double':
    value = parseFloat('' + xmlRpcValue);
    break;
  case 'dateTime.iso8601':
    //TODO not needed by 3e client right now
    break;
  case 'base64':
    //TODO not needed by 3e client right now
    break;
  case 'array':
    value = [];
    for each (var item in xmlRpcValue.data.value) {
      value.push(this._parseValue(item));
    }
    break;
  case 'struct':
    value = {};
    for each (var member in xmlRpcValue.member) {
      value[member.name] = this._parseValue(member.value);
    }
    break;
  }
  return value;
}
cal3eMethodResponse.prototype = {

  /**
   * Returns value of this response.
   *
   * @return value
   */
  get value cal3eMethodResponse_get_value() {
    return this._value;
  },

  /**
   * Checks whether this response was an error or not.
   *
   * @return <code>true</code> if response was an error
   */
  isError: function cal3eMethodResponse_isError() {
    return this._isError;
  },

  /**
   * Returns code of EEE error.
   *
   * @return number of EEE error or <code>null</code> if there's none
   */
  get faultCode cal3eMethodResponse_get_faultCode() {
    return this.isError ? this._faultCode : null;
  },

  /**
   * Returns desicription of EEE error.
   *
   * @return description of EEE error or <code>null</code> it there's none
   */
  get faultString cal3eMethodResponse_get_faultString() {
    return this.isError ? this._faultString : null;
  }

}

/**
 * Convenient place to stack {@link cal3eMethod} instances for batch execution.
 *
 * @param uri EEE server where method calls are sent
 */
function cal3eMethodStack(uri) {
  this._uri = uri;

  // DEBUG
  var console = Cc["@mozilla.org/consoleservice;1"].getService(
      Ci.nsIConsoleService
    );
  this._console = console;
}

cal3eMethodStack.prototype = {

  _methods: [],

  _executedMethodIdx: -1,

  _responses: [],

  _observers: [],

  _errorResponse: null,

  /**
   * Returns the last response from RPC server.
   *
   * @return instance of {@link cal3eMethodResponse}
   */
  get lastResponse cal3eMethodStack_get_lastResponse() {
    var responses = this._responses,
        length = this._responses.length;
    return 0 < length ? responses[length-1] : null ;
  },

  /**
   * Returns an error response on HTTP level.
   *
   * @return instance of <code>nsIHttpChannel</code> or <code>null</code> if
   *  there's none
   */
  get errorResponse cal3eMethodStack_get_errorResponse() {
    return this._errorResponse;
  },

  /**
   * Adds given method to the end of method stack.
   *
   * @param method instance of {@link cal3eMethod}
   * @return receiver
   */
  addMethod: function cal3eMethodStack_addMethod(method) {
    this._methods.push(method);
    return this;
  },

  /**
   * Adds observer which will be notified when execution of methods in this
   * stack finish.
   *
   * Observer should define <code>methodStackDidChange</code> method which
   * receives this method stack as an argument.
   *
   * @param observer
   * @return receiver
   */
  addObserver: function cal3eMethodStack_addObserver(observer) {
    this._observers.push(observer);
    return this;
  },

  /**
   * Calls <code>methodStackDidChange</code> on each observer.
   *
   * Should be called only when execution of method stack finished.
   *
   * @return receiver
   */
  notify: function cal3eMethodStack_notify() {
    var observers = this._observers,
        idx = observers.length,
        observer;
    while (idx--) {
      observer = observers[idx];
      if ('function' === typeof observer.methodStackDidChange) {
        observer.methodStackDidChange(this);
      }
    }
    return this;
  },

  /**
   * Starts the exection of methods in this stack.
   *
   * @param observer optional observer which will be notified when execution
   *  finish
   * @return receiver
   */
  execute: function cal3eMethodStack_execute(observer) {
    if (undefined !== observer) {
      this.addObserver(observer);
    }
    this._executeNext();
    return this;
  },

  _executeNext: function cal3eMethodStack_executeNext() {
    var methodIndex = this._executedMethodIdx + 1,
        method = this._methods[methodIndex];

    // if there's no method to execute in this stack, then notify observers
    if (undefined === method) {
      this.notify();
      return;
    }
    // continue otherwise
    var xml = method.toXMLString(),
        httpChannel = cal.prepHttpChannel(this._uri, xml, "text/xml", null);
    httpChannel.requestMethod = "POST";
    var console = Cc["@mozilla.org/consoleservice;1"].getService(
      Ci.nsIConsoleService
    );
    console.logStringMessage("Sending: " + xml);
    this._executedMethodIdx = methodIndex;
    cal.sendHttpRequest(cal.createStreamLoader(), httpChannel, this);
  },

  /**
   * Stops the execution without notifying any observer.
   *
   * @return receiver
   */
  stop: function cal3eMethodStack_stop() {
    this._executedMethodIdx = this._methods.length;
    return this;
  },

  /**
   * Checks whether all method calls have been successful.
   *
   * @return <code>true</code> if all method calls have been successful
   */
  areResponsesSuccessful: function cal3eMethodStack_areResponsesSuccessful() {
    if (null !== this._errorResponse) {
      return false;
    }
    var areSuccessful = true,
        responses = this._responses,
        idx = responses.length,
        response;
    while (idx--) {
      response = responses[idx];
      if (response.isError()) {
        areSuccessful = false;
        break;
      }
    }
    return areSuccessful;
  },

  /**
   * Handles incoming response to method call.
   *
   * It can either create {@link cal3eMethodResponse} or stores context as the
   * error response due to errors on HTTP level.
   *
   * @param loader
   * @param context instance of <code>nsIHttpChannel</code> which originally
   *  contains request with method call
   * @param status
   * @param resultLength number of bytes in the result
   * @param result byte array with response
   */
  onStreamComplete: function cal3eMethodStack_onStreamComplete(loader, context, status, resultLength, result) {
    var httpChannel = context.QueryInterface(Ci.nsIHttpChannel);
    if (!httpChannel.requestSucceeded) {
      this._console.logStringMessage("HTTP error: " +
          httpChannel.responseStatus + " " +
          httpChannel.responseStatusText);
      if (null === this._errorResponse) {
        this._errorResponse = httpChannel;
        this.notify();
      }
      return;
    }

    // remove XML-RPC response envelope
    var xmlString = cal.convertByteArray(result, resultLength),
        responseXml = cal.safeNewXML(xmlString),
        response;
    try {
      response = cal3eMethodResponse.fromXml(responseXml);
    } catch (error) {
      this._console.logStringMessage(error);
      response = null;
    }
    if (null === response) {
      this._console.logStringMessage("XML-RPC error: " +
          httpChannel.responseStatus + " " +
          httpChannel.responseStatusText + "\n" +
          xmlString);
      if (null === this._errorResponse) {
        this._errorResponse = httpChannel;
        this.notify();
      }
      return;
    }
    var methodIndex = this._executedMethodIdx;
    this._responses[methodIndex] = response;
    if (response.isError()) {
      this._console.logStringMessage("3e error: " +
          response.responseStatus + " " +
          httpChannel.responseStatusText);
      this.notify();
      return;
    }

    this._console.logStringMessage("Received: " + responseXml);

    // continue with next method call
    this._executeNext();
  },

}

/**
 * Simplifies EEE method execution by server resolution and stacking necessary
 * mehotds to convenient operations.
 *
 * @param identity used to resolve how to connect to server
 */
function cal3eClient(identity) {
  this.setIdentity(identity);
}

cal3eClient.prototype = {

  _interfaceName: 'ESClient',

  _identity: null,

  _autoExecute: true,

  /**
   * Returns EEE interface name.
   *
   * @return <code>"ESClient"</code>
   */
  get interfaceName cal3eClient_get_interfaceName() {
    return this._interfaceName;
  },

  /**
   * Sets identity which is used with this client.
   *
   * @param identity used to resolve how to connect to server
   * @return receiver
   */
  setIdentity: function cal3eClient_set_identity(identity) {
    this._identity = identity;
    var username = identity.email;
    //TODO DNS resolve
    var host = username.substring(username.indexOf("@") + 1),
        port = 4444;
    //XXX development
    var host = "localhost";
    var url = "https://" + host + ":" + port + "/RPC2";
    var ioService = Cc["@mozilla.org/network/io-service;1"]
      .getService(Ci.nsIIOService);
    this._uri = ioService.newURI(url, null, null);
    this._methodStack = new cal3eMethodStack(this._uri);
  },

  /**
   * Executes current method stack and prepares new one.
   *
   * @param listener
   * @return receiver
   * @todo listener should be server as context parameter to method stack
   *  execution and not remembered here
   */
  executeMethodStack: function cal3eClient_execute(listener) {
    this._listener = (null !== listener) ? listener : null ;
    this._methodStack.execute(this);
    this._methodStack = new cal3eMethodStack(this._uri);
    return this;
  },

  /**
   * Calls appropriate listener's methods according to method stack state.
   *
   * @param methodStack
   * @see executeMethodStack
   */
  methodStackDidChange: function cal3eClient_methodStackDidChange(methodStack) {
    var success = methodStack.areResponsesSuccessful(),
        listener = this._listener;
    if (success &&
        (null !== listener) && ('function' === typeof listener.onSuccess)) {
      listener.onSuccess.call(listener, methodStack.lastResponse.value, methodStack);
    } else if ((null !== listener) && ('function' === typeof listener.onError)) {
      listener.onError.call(listener, methodStack);
    }
  },

  /**
   * Calls <code>ESClient.authenticate</code> with credentials retrieved from
   * client's identity.
   *
   * @param listener
   * @param execute if defined, overrides auto execute setting
   * @return receiver
   */
  authenticate: function cal3eClient_authenticate(listener, execute) {
    if (null === this._identity) {
      throw new Error("Identity must be set");
    }
    execute = undefined === execute ? this._autoExecute : execute ;
    var authenticateMethod = new cal3eMethod(this, 'authenticate');
    //TODO password manager
    var password = "qwe";
    authenticateMethod
      .addParam(this._identity.email) // username
      .addParam(password); // password
    this._methodStack
      .addMethod(authenticateMethod);
    if (execute) {
      this.executeMethodStack(listener);
    }
    return this;
  },

  /**
   * Calls {@link authenticate} and <code>ESClient.getCalendars</code> with
   * given query.
   *
   * @param query string according EEE query specification and specification of
   *  getCalendars method
   * @param listener
   * @param execute if defined, overrides auto execute setting
   * @return receiver
   */
  getCalendars: function cal3eClient_getCalendars(query, listener, execute) {
    execute = undefined === execute ? this._autoExecute : execute ;
    this.authenticate(null, false);
    var getCalendarsMethod = new cal3eMethod(this, 'getCalendars');
    getCalendarsMethod
      .addParam(query); // query
    this._methodStack
      .addMethod(getCalendarsMethod);
    if (execute) {
      this.executeMethodStack(listener);
    }
    return this;
  }

}
