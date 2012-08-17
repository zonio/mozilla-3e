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

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://gre/modules/ISO8601DateUtils.jsm');

function Client() {
  var client = this;
  var uri;
  var listener;
  var window;
  var request;
  var xhr;
  var response;
  var channelCallbacks;

  function send(methodName, parameters) {
    if (request) {
      throw Components.Exception(
        'Only one request at the same time',
        Components.results.NS_ERROR_IN_PROGRESS
      );
    }

    request = new Request(methodName, parameters);
    doXhrSend();

    return client;
  }

  function abort() {
    if (!xhr) {
      return;
    }

    var oldXhr = xhr;
    reset();
    oldXhr.abort();
  }

  function doXhrSend() {
    if (!uri) {
      throw Components.Exception(
        'URI must be set',
        Components.results.NS_ERROR_NOT_INITIALIZED
      );
    }

    channelCallbacks = new ChannelCallbacks(
      doXhrSend,
      passErrorToListener,
      window
    );

    xhr = Components.classes[
      '@mozilla.org/xmlextras/xmlhttprequest;1'
    ].createInstance(Components.interfaces.nsIXMLHttpRequest);
    xhr.open('POST', uri.spec);
    xhr.setRequestHeader('Content-Type', 'text/xml');
    xhr.addEventListener('load', onXhrLoad, false);
    xhr.addEventListener('error', onXhrError, false);
    xhr.channel.notificationCallbacks = channelCallbacks;

    xhr.send(request.body());
  }

  function onXhrLoad(event) {
    if ((event.target.status !== 200) || !event.target.responseXML) {
      passErrorToListener(
        Components.results.NS_ERROR_FAILURE, 'Unknown network error'
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
    if (channelCallbacks.isBadCertListenerActive()) {
      return;
    }

    passErrorToListener(
      Components.results.NS_ERROR_FAILURE, 'Unknown network error'
    );
  }

  function passResultToListener() {
    reset();
    if (isSuccess()) {
      listener.onResult(client, response);
    } else {
      listener.onFault(client, response);
    }
  }

  function passErrorToListener(result, description) {
    reset();
    listener.onError(client, Components.Exception(description, result));
  }

  function reset() {
    request = null;
    xhr = null;
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
    body += '<methodCall>';
    body += '<methodName>' + name + '</methodName>';
  }

  function appendParametersToBody() {
    body += '<params>';
    parameters.forEach(appendParameterToBody);
    body += '</params>';
  }

  function appendParameterToBody(parameter) {
    body += '<param><value>' + createValue(parameter) + '</value></param>';
  }

  function createValue(parameter) {
    var value;
    switch (typeof parameter) {
    case 'number':
      if ((parameter % 1) === 0) {
        value = '<int>' + parameter + '</int>';
      } else {
        value = '<double>' + parameter + '</double>';
      }
      break;
    case 'boolean':
      value = '<boolean>' + parameter + '</boolean>';
      break;
    case 'string':
      value = parameter;
      break;
    case 'object':
      if (parameter instanceof Date) {
        value = createDateTimeParameter(parameter);
      } else if (parameter instanceof Array) {
        value = createArrayParameter(parameter);
      } else if (parameter instanceof Base64Parameter) {
        value = parameter.toString();
      } else if (parameter === null) {
        value = '';
      } else {
        value = createStructParameter(parameter);
      }
      break;
    case 'undefined':
      value = '';
      break;
    default:
      throw Components.Exception(
        'Unsupported value type.',
        Components.results.NS_ERROR_ILLEGAL_VALUE
      );
      break;
    }

    return value;
  }

  function createDateTimeParameter(parameter) {
    var dateTime = '<dateTime.iso8601>';
    dateTime += date.getFullYear();
    dateTime += date.getMonth();
    dateTime += date.getDate();
    dateTime += 'T';
    dateTime += date.getHours();
    dateTime += ':';
    dateTime += date.getMinutes();
    dateTime += ':';
    dateTime += date.getSeconds();
    dateTime += '</dateTime.iso8601>';

    return dateTime;
  }

  function createStructParameter(parameter) {
    var struct = '<struct>';
    var name;
    for (name in parameter) {
      if (!parameter.hasOwnProperty(name)) {
        continue;
      }
      struct += '<member>';
      struct += '<name>' + name + '</name>';
      struct += '<value>' + createValue(parameter[name]) + '</value>';
      struct += '</member>';
    }
    struct += '</struct>';

    return struct;
  }

  function createArrayParameter(parameter) {
    var array = '<array><data>';
    var idx;
    for (idx = 0; idx < parameter.length; idx += 1) {
      array += '<value>' + createValue(parameter[idx]) + '</value>';
    }
    array += '</data></array>';

    return array;
  }

  function appendMethodCallEndToBody() {
    body += '</methodCall>';
  }

  function getBody() {
    return body;
  }

  function init() {
    appendMethodCallStartAndNameToBody();
    appendParametersToBody();
    appendMethodCallEndToBody();
  }

  request.body = getBody;

  init();
}

function Base64Parameter(parameter) {
  var base64Parameter = this;

  function toString() {
    return '<base64>' + btoa(parameter) + '</base64>';
  }

  base64Parameter.toString = toString;
}

function createResponse(xmlDocument) {
  if (!xmlDocument.documentElement ||
      (xmlDocument.documentElement.tagName !== 'methodResponse')) {
    throw Components.Exception(
      'No root element in XML response',
      Components.results.NS_ERROR_UNEXPECTED
    );
  }

  var decisionElement = xmlDocument.documentElement.firstChild;
  if (!decisionElement || !decisionElement.tagName ||
      (['params', 'fault'].indexOf(decisionElement.tagName) < 0)) {
    throw Components.Exception(
      'No params nor fault element found in XML response',
      Components.results.NS_ERROR_UNEXPECTED
    );
  }

  return decisionElement.tagName === 'params' ?
    new Response(xmlDocument) :
    new FaultResponse(xmlDocument);
}

function Response(xmlDocument) {
  var response = this;
  var parameter;

  function parseDocument() {
    var paramElement = xmlDocument.documentElement.firstChild.firstChild;
    if (!paramElement || (paramElement.tagName !== 'param')) {
      throw Components.Exception(
        'No param element found in XML response',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    var valueElement = paramElement.firstChild;
    if (!valueElement || (valueElement.tagName !== 'value')) {
      throw Components.Exception(
        'No value element found in XML response',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    parameter = new Value(valueElement);
  }

  function getParameter() {
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

  response.parameter = getParameter;
  response.isSuccess = isSuccess;
  response.isFault = isFault;

  init();
}

function FaultResponse(xmlDocument) {
  var faultResponse = this;
  var fault;

  function parseDocument() {
    var valueElement = xmlDocument.documentElement.firstChild.firstChild;
    if (!valueElement || (valueElement.tagName !== 'value')) {
      throw Components.Exception(
        'No value element found in XML response',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    fault = new Value(valueElement);
    if ((fault.type() !== 'struct') || !('faultCode' in fault.value()) ||
        !('faultString' in fault.value())) {
      throw Components.Exception(
        'Unexpected fault struct in XML response',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }
  }

  function getFaultCode() {
    return fault.value()['faultCode'];
  }

  function getFaultString() {
    return fault.value()['faultString'];
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

  faultResponse.faultCode = getFaultCode;
  faultResponse.faultString = getFaultString;
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
        'Empty value element',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }
    if ([Components.interfaces.nsIDOMNode.TEXT_NODE,
         Components.interfaces.nsIDOMNode.ELEMENT_NODE]
        .indexOf(valueElement.firstChild.nodeType) < 0) {
      throw Components.Exception(
        'Unexpected type element',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return valueElement.firstChild.nodeType ===
      Components.interfaces.nsIDOMNode.ELEMENT_NODE ?
      valueElement.firstChild.tagName :
      'string';
  }

  function parseValue(valueElement) {
    var types = {
      'i4': intValue,
      'int': intValue,
      'boolean': booleanValue,
      'string': stringValue,
      'double': doubleValue,
      'dateTime.iso8601': dateTimeValue,
      'base64': base64Value,
      'struct': structValue,
      'array': arrayValue
    };

    if (!types[normalizeType(valueElement)]) {
      throw Components.Exception(
        'Unexpected value type',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return types[normalizeType(valueElement)](valueElement);
  }

  function scalarValue(valueElement) {
    var scalarValue;
    if (!valueElement.firstChild &&
        !valueElement.firstChild.firstChild) {
      scalarValue = '';
    } else if (valueElement.firstChild.nodeType ===
               Components.interfaces.nsIDOMNode.TEXT_NODE) {
      scalarValue = valueElement.firstChild.data;
    } else if (valueElement.firstChild.firstChild &&
               (valueElement.firstChild.firstChild.nodeType ===
                Components.interfaces.nsIDOMNode.TEXT_NODE)) {
      scalarValue = valueElement.firstChild.firstChild.data;
    } else {
      throw Components.Exception(
        'Not a scalar value',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return scalarValue;
  }

  function intValue(valueElement) {
    var value = parseInt(scalarValue(valueElement));
    if (isNaN(value)) {
      throw Components.Exception(
        'Unexpected int value',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return value;
  }

  function booleanValue(valueElement) {
    if (['0', '1'].indexOf(scalarValue(valueElement)) < 0) {
      throw Components.Exception(
        'Unexpected boolean value',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return scalarValue(valueElement) === '1';
  }

  function stringValue(valueElement) {
    return '' + scalarValue(valueElement);
  }

  function doubleValue(valueElement) {
    var value = parseFloat(scalarValue(valueElement));
    if (isNaN(value)) {
      throw Components.Exception(
        'Unexpected float value',
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
    for (idx = 0; idx < structElement.childNodes.length; idx += 1) {
      member = memberValue(structElement.childNodes.item(idx));
      struct[member['name']] = member['value'];
    }

    return struct;
  }

  function memberValue(memberElement) {
    if (!memberElement.tagName || (memberElement.tagName !== 'member')) {
      throw Components.Exception(
        'Member element expected in struct',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }
    if (memberElement.childNodes.length !== 2) {
      throw Components.Exception(
        'Only name and value elements expected in struct',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }
    if (!memberElement.firstChild || !memberElement.firstChild.tagName ||
        (memberElement.firstChild.tagName !== 'name')) {
      throw Components.Exception(
        'Name element expected in struct',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return {
      'name': scalarValue(memberElement.firstChild),
      'value': parseValue(memberElement.lastChild)
    };
  }

  function arrayValue(valueElement) {
    var dataElement = valueElement.firstChild.firstChild;
    if (!dataElement || !dataElement.tagName ||
        (dataElement.tagName !== 'data')) {
      throw Components.Exception(
        'Data element expected in array',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    var array = [];
    var idx;
    for (idx = 0; idx < dataElement.childNodes.length; idx += 1) {
      array.push(parseValue(dataElement.childNodes.item(idx)));
    }

    return array;
  }

  function getType() {
    return type;
  }

  function getValue() {
    return parsedValue;
  }

  function init() {
    type = normalizeType(valueElement);
    parsedValue = parseValue(valueElement);
  }

  value.type = getType;
  value.value = getValue;

  init();
}

function ChannelCallbacks(repeatCall, onError, window) {
  var channelCallbacks = this;
  var badCertListener;

  function getInterface(iid, result) {
    if (!iid.equals(Components.interfaces.nsIBadCertListener2)) {
      throw Components.Exception(
        'Given interface is not supported',
        Components.results.NS_ERROR_NO_INTERFACE
      );
    }

    if (!badCertListener) {
      badCertListener = new BadCertListener(repeatCall, onError, window);
    }

    return badCertListener;
  }

  function isBadCertListenerActive() {
    return badCertListener && badCertListener.isActive();
  }

  channelCallbacks.QueryInterface = XPCOMUtils.generateQI([
    Components.interfaces.nsIInterfaceRequestor
  ]);
  channelCallbacks.getInterface = getInterface;
  channelCallbacks.isBadCertListenerActive = isBadCertListenerActive;
}

function BadCertListener(repeatCall, onError, window) {
  var badCertListener = this;
  var active;

  function notifyCertProblem(socketInfo, status, targetSite) {
    active = true;
    window.setTimeout(function() {
      showBadCertDialogAndRetryCall({
        'exceptionAdded': false,
        'prefetchCert': true,
        'location': targetSite
      });
    }, 0);
  }

  function showBadCertDialogAndRetryCall(parameters) {
    window.openDialog(
      'chrome://pippki/content/exceptionDialog.xul',
      '',
      'chrome,centerscreen,modal',
      parameters
    );

    active = false;
    if (parameters['exceptionAdded']) {
      repeatCall();
    } else {
      onError(
        Components.results.NS_ERROR_FAILURE,
        'Server certificate exception not added'
      );
    }
  }

  function isActive() {
    return active;
  }

  function init() {
    if (!window) {
      window = Services.wm.getMostRecentWindow(null);
    }
    active = false;
  }

  badCertListener.QueryInterface = XPCOMUtils.generateQI([
    Components.interfaces.nsIInterfaceRequestor
  ]);
  badCertListener.notifyCertProblem = notifyCertProblem;
  badCertListener.isActive = isActive;

  init();
}

var cal3eXmlRpc = {
  Client: Client,
  Base64Parameter: Base64Parameter
};
EXPORTED_SYMBOLS = [
  'cal3eXmlRpc'
];
