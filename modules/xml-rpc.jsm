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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/ISO8601DateUtils.jsm");

function Client() {
  var client = this;
  var uri;
  var listener;
  var window;
  var request;
  var xhr;
  var response;

  function send(methodName) {
    if (request) {
      throw Components.Exception(
        "Can be called only once.",
        Components.results.NS_ERROR_ALREADY_INITIALIZED
      );
    }

    request = new Request(
      methodName,
      Array.prototype.slice.call(arguments, 1)
    );

    prepareXhr();
    doXhrSend();

    return client;
  }

  function abort() {
    request = null;
    xhr.abort();
  }

  function doXhrSend() {
    xhr.send(request.body());
  }

  function prepareXhr() {
    xhr = Components.classes[
      "@mozilla.org/xmlextras/xmlhttprequest;1"
    ].createInstance(Components.interfaces.nsIXMLHttpRequest);
    xhr.open("POST", uri.spec);
    xhr.setRequestHeader("Content-Type", "text/xml");
    xhr.addEventListener("load", onXhrLoad, false);
    xhr.addEventListener("error", onXhrError, false);
    xhr.channel.notificationCallbacks = new ChannelCallbacks(
      doXhrSend,
      passErrorToListener,
      window
    );
    xhr.send(request.body());
  }

  function onXhrLoad(event) {
    if ((event.target.status !== 200) || !event.target.responseXML) {
      passErrorToListener(
        Components.results.NS_ERROR_FAILURE, "Unknown network error"
      );
      return;
    }

    event.target.responseXML.normalize();
    try {
      response = createResponse(event.target.responseXML);
    } catch (e) {
      passErrorToListener(e.result, e.message);
      return;
    }

    passResultToListener();
  }

  function onXhrError(event) {
    passErrorToListener(
      Components.results.NS_ERROR_FAILURE, "Unknown network error"
    );
  }

  function passResultToListener() {
    request = null;
    if (isSuccess()) {
      listener.onResult(client, response);
    } else {
      listener.onFault(client, response);
    }
  }

  function passErrorToListener(result, description) {
    request = null;
    listener.onError(client, result, description);
  }

  function setUri(newUri) {
    uri = newUri;

    return client;
  }

  function setListener(newListener) {
    listener = newListener;

    return client;
  }

  function setWindow(newWindow) {
    window = newWindow;

    return client;
  }

  function isSuccess() {
    return response && (response instanceof Response);
  }

  client.send = send;
  client.abort = abort;
  client.setUri = setUri;
  client.setListener = setListener;
  client.setWindow = setWindow;
}

function Request(name, parameters) {
  var request = this;
  var body = '<?xml version="1.0" encoding="UTF-8"?>';

  function appendMethodCallStartAndNameToBody() {
    body += "<methodCall>";
    body += "<methodName>" + name + "</methodName>";
  }

  function appendParametersToBody() {
    body += "<params>";
    parameters.forEach(appendParameterToBody);
    body += "</params>";
  }

  function appendParameterToBody(parameter) {
    body += "<param><value>" + createValue(parameter) + "</value></param>";
  }

  function createValue(parameter) {
    switch (typeof parameter) {
    case "number":
      if ((parameter % 1) === 0) {
        parameter = "<int>" + parameter + "</int>";
      } else {
        parameter = "<double>" + parameter + "</double>";
      }
      break;
    case "boolean":
      parameter = "<boolean>" + parameter + "</boolean>";
      break;
    case "string":
      break;
    case "object":
      if (parameter instanceof Date) {
        parameter = createDateTimeParameter(parameter);
      } else if (parameter instanceof Array) {
        parameter = createArrayParameter(parameter);
      } else if (!(parameter instanceof Base64Parameter)) {
        parameter = createStructParameter(parameter);
      }
      break;
    default:
      throw Components.Exception(
        "Unsupported value type.",
        Components.results.NS_ERROR_ILLEGAL_VALUE
      );
      break;
    }

    return parameter;
  }

  function createDateTimeParameter(parameter) {
    var dateTime = "<dateTime.iso8601>";
    dateTime += date.getFullYear();
    dateTime += date.getMonth();
    dateTime += date.getDate();
    dateTime += "T";
    dateTime += date.getHours();
    dateTime += ":";
    dateTime += date.getMinutes();
    dateTime += ":";
    dateTime += date.getSeconds();
    dateTime += "</dateTime.iso8601>";

    return dateTime;
  }

  function createStructParameter(parameter) {
    var struct = "<struct>";
    for (var name in parameter) {
      if (!parameter.hasOwnProperty(name)) {
        continue;
      }
      struct += "<member>";
      struct += "<name>" + name + "</name>";
      struct += "<value>" + createValue(parameter[name]) + "</value>";
      struct += "</member>";
    }
    struct += "</struct>";

    return struct;
  }

  function appendArrayToBody(parameter) {
    var array = "<array><data>";
    var idx;
    for (idx = 0; idx < parameter.length; idx += 1) {
      array += "<value>" + createValue(parameter[idx]) + "</value>";
    }
    array += "</data></array>";

    return array;
  }

  function appendMethodCallEndToBody() {
    body += "</methodCall>";
  }

  function body() {
    return body;
  }

  function init() {
    appendMethodCallStartAndNameToBody();
    appendParametersToBody();
    appendMethodCallEndToBody();
  }

  request.body = body;

  init();
}

function Base64Parameter(parameter) {
  var base64Parameter = this;

  function toString() {
    return "<base64>" + btoa(parameter) + "</base64>";
  }

  base64Parameter.toString = toString;
}

function createResponse(xmlDocument) {
  if (!xmlDocument.documentElement
      (xmlDocument.documentElement.tagName !== "methodResponse")) {
    throw Components.Exception(
      "No root element in XML response",
      Components.results.NS_ERROR_UNEXPECTED
    );
  }

  var decisionElement = xmlDocument.documentElement.firstChild;
  if (!decisionElement || !decisionElement.tagName ||
      (["params", "fault"].indexOf(decisionElement.tagName) >= 0)) {
    throw Components.Exception(
      "No params nor fault element found in XML response",
      Components.results.NS_ERROR_UNEXPECTED
    );
  }

  return decisionElement.tagName === "params" ?
    new Response(xmlDocument) :
    new FaultResponse(xmlDocument) ;
}

function Response(xmlDocument) {
  var parameter;

  function parseDocument() {
    var paramElement = xmlDocument.documentElement.firstChild.firstChild;
    if (!paramElement || (paramElement.tagName !== "param")) {
      throw Components.Exception(
        "No param element found in XML response",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    var valueElement = paramElement.firstChild;
    if (!valueElement || (valueElement.tagName !== "value")) {
      throw Components.Exception(
        "No value element found in XML response",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    parameter = new Value(valueElement);
  }

  function parameter() {
    return parameter.value();
  }

  function isSuccess() {
    return true;
  }

  function isFault() {
    return false;
  }

  function init() {
    parseDocument();
  }

  faultResponse.parameter = value;
  faultResponse.isSuccess = isSuccess;
  faultResponse.isFault = isFault;

  init();
}

function FaultResponse(xmlDocument) {
  var faultResponse = this;
  var fault;

  function parseDocument() {
    var valueElement = xmlDocument.documentElement.firstChild.firstChild;
    if (!valueElement || (valueElement.tagName !== "value")) {
      throw Components.Exception(
        "No value element found in XML response",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    fault = new Value(valueElement);
    if ((fault.type() !== "struct") || !("faultCode" in fault.value()) ||
        !("faultString" in fault.value())) {
      throw Components.Exception(
        "Unexpected fault struct in XML response",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }
  }

  function faultCode() {
    return fault.value()["faultCode"];
  }

  function faultString() {
    return fault.value()["faultString"];
  }

  function isSuccess() {
    return false;
  }

  function isFault() {
    return true;
  }

  function init() {
    parseDocument();
  }

  faultResponse.faultCode = value;
  faultResponse.faultString = faultString;
  faultResponse.isSuccess = isSuccess;
  faultResponse.isFault = isFault;

  init();
}

function Value(valueElement) {
  var value = this;
  var type;
  var parsedValue;

  function normalizeType(valueElement) {
    if (!valueElement.firstChild) {
      throw Components.Exception(
        "Empty value element",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }
    if ([Components.interfaces.nsIDOMNode.TEXT_NODE,
         Components.interfaces.nsIDOMNode.ELEMENT_NODE]
        .indexOf(valueElement.firstChild.nodeType) >= 0) {
      throw Components.Exception(
        "Unexpected type element",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return valueElement.firstChild.nodeType ===
      Components.interfaces.nsIDOMNode.ELEMENT_NODE ?
      valueElement.firstChild.tagName :
      "string" ;
  }

  function parseValue(valueElement) {
    if (!types[normalizeType(valueElement)]) {
      throw Components.Exception(
        "Unexpected value type",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return types[normalizeType(valueElement)](valueElement);
  }

  function scalarValue(valueElement) {
    var scalarValue;
    if (!valueElement.firstChild ||
        !valueElement.firstChild.firstChild) {
      scalarValue = "";
    } else if (valueElement.firstChild.nodeType ===
               Components.interfaces.nsIDOMNode.TEXT_NODE) {
      scalarValue = valueElement.firstChild.data;
    } else if (valueElement.firstChild.firstChild &&
               (valueElement.firstChild.firstChild.nodeType ===
                Components.interfaces.nsIDOMNode.TEXT_NODE)) {
      scalarValue = valueElement.firstChild.firstChild.data;
    } else {
      throw Components.Exception(
        "Not a scalar value",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return scalarValue;
  }

  function intValue(valueElement) {
    var value = parseInt(scalarValue(valueElement));
    if (isNaN(value)) {
      throw Components.Exception(
        "Unexpected int value",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return value;
  }

  function booleanValue(valueElement) {
    if (["0", "1"].indexOf(scalarValue(valueElement)) < 0) {
      throw Components.Exception(
        "Unexpected boolean value",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return textNode.data === "1";
  }

  function stringValue(valueElement) {
    return "" + scalarValue(valueElement);
  }

  function doubleValue(valueElement) {
    var value = parseFloat(scalarValue(valueElement));
    if (isNaN(value)) {
      throw Components.Exception(
        "Unexpected float value",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return value;
  }

  function dateTimeValue(valueElement) {
    return ISO8601DateUtils.parse(scalarValue(valueElement));
  }

  function base64Value(valueElement) {
    return atob(scalarValue(valueElement));
  }

  function structValue(valueElement) {
    var struct = {};
    var structElement = valueElement.firstChild;
    var idx, member;
    for (idx = 0; idx < structElement.length; idx += 1) {
      member = memberValue(structElement.item(idx));
      struct[member["name"]] = member["value"];
    }

    return struct;
  }

  function memberValue(memberElement) {
    if (!memberElement.tagName || (memberElement.tagName !== "member")) {
      throw Components.Exception(
        "Member element expected in struct",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }
    if (memberElement.childNodes.length !== 2) {
      throw Components.Exception(
        "Only name and value elements expected in struct",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }
    if (!memberElement.firstChild || !memberElement.firstChild.tagName ||
        (memberElement.firstChild.tagName !== "name")) {
      throw Components.Exception(
        "Name element expected in struct",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    var name = scalarValue(memberElement.firstChild);
    var value = parseValue(memberElement.lastChild);

    return { "name": name, "value": value };
  }

  function arrayValue(valueElement) {
    var dataElement = valueElement.firstChild.firstChild;
    if (!dataElement || !dataElement.tagName ||
        (dataElement.tagName !== "data")) {
      throw Components.Exception(
        "Data element expected in array",
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    var array = [];
    for (idx = 0; idx < dataElement.length; idx += 1) {
      array.push(parseValue(dataElement.item(idx)));
    }

    return array;
  }

  function type() {
    return type;
  }

  function value() {
    return parsedValue;
  }

  function init() {
    type = normalizeType(valueElement);
    parsedValue = parseValue(valueElement);
  }

  init();
}

function ChannelCallbacks(repeatCall, onError, window) {
  var channelCallbacks = this;

  function getInterface(iid, result) {
    if (!iid.equals(Components.interfaces.nsIBadCertListener2)) {
      throw Components.Exception(
        "Given interface is not supported",
        Components.results.NS_ERROR_NO_INTERFACE
      );
    }

    return new BadCertListener(repeatCall, onError, window);
  }

  channelCallbacks.QueryInterface = XPCOMUtils.generateQI([
    Components.interfaces.nsIInterfaceRequestor
  ]);
  channelCallbacks.getInterface = getInterface;
}

function BadCertListener(repeatCall, onError, window) {
  var badCertListener = this;

  function notifyCertProblem(socketInfo, status, targetSite) {
    cal.getCalendarWindow().setTimeout(function() {
      showBadCertDialogAndRetryCall({
        "exceptionAdded" : false,
        "prefetchCert" : true,
        "location" : targetSite
      })
    }, 0);
  }

  function showBadCertDialogAndRetryCall(parameters) {
    if (!window) {
      window = Services.wm.getMostRecentWindow(null);
    }

    window.openDialog(
      "chrome://pippki/content/exceptionDialog.xul",
      "",
      "chrome,centerscreen,modal",
      parameters
    );

    if (parameters["exceptionAdded"]) {
      repeatCall();
    } else {
      onError(
        Components.results.NS_ERROR_FAILURE,
        "Server certificate exception not added"
      );
    }
  }

  badCertListener.QueryInterface = XPCOMUtils.generateQI([
    Components.interfaces.nsIInterfaceRequestor
  ]);
  badCertListener.notifyCertProblem = notifyCertProblem;
}

var cal3eXmlRpc = {
  "Client": Client,
  "Base64Parameter": Base64Parameter
};
EXPORTED_SYMBOLS = [
  'cal3eXmlRpc'
];
