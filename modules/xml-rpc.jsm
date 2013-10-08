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

Components.utils.import('resource://gre/modules/ISO8601DateUtils.jsm');
Components.utils.import('resource://calendar3e/modules/logger.jsm');
Components.utils.import('resource://calendar3e/modules/http.jsm');

function Client(uri) {
  var client = this;
  var listener;
  var window;
  var request;
  var xhr;
  var response;
  var logger;

  function call(methodName, parameters, masked, context) {
    if (request) {
      throw Components.Exception(
        'Only one request at the same time',
        Components.results.NS_ERROR_IN_PROGRESS
      );
    }

    request = new Request(methodName, parameters, masked);
    doXhrSend(context);

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

  function doXhrSend(context) {
    if (!uri) {
      throw Components.Exception(
        'URI must be set',
        Components.results.NS_ERROR_NOT_INITIALIZED
      );
    }

    var channelCallbacks = new cal3eHttp.ChannelCallbacks(
      doXhrSend,
      passErrorToListener,
      context,
      window,
      logger
    );
    xhr = Components.classes[
      '@mozilla.org/xmlextras/xmlhttprequest;1'
    ].createInstance(Components.interfaces.nsIXMLHttpRequest);
    xhr.open('POST', uri.spec);
    xhr.setRequestHeader('Content-Type', 'text/xml');
    xhr.addEventListener('load', function(event) {
      onXhrLoad(event, context);
    }, false);
    xhr.addEventListener('error', function(event) {
      if (channelCallbacks.isActive()) {
        return;
      }

      onXhrError(event, context);
    }, false);
    xhr.channel.notificationCallbacks = channelCallbacks;

    logger.info('Calling method "' + request.name() + '" ' +
                'on "' + uri.spec + '"');
    logger.debug('Request body: ' + request.logBody());

    xhr.send(request.body());
  }

  function onXhrLoad(event, context) {
    if ((event.target.status !== 200) || !event.target.responseXML) {
      passErrorToListener(
        Components.Exception('Unknown network error'), context
      );
      return;
    }

    if (event.target.responseXML) {
      event.target.responseXML.normalize();

      logger.debug('Response body: ' +
                   Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                   .createInstance(Components.interfaces.nsIDOMSerializer)
                   .serializeToString(event.target.responseXML));
    } else {
      logger.debug('Response non XML body: ' + event.target.responseText);

      passErrorToListener(
        Components.Exception('Non XML response received', e.result), context
      );
    }

    try {
      response = createResponse(event.target.responseXML);
    } catch (e) {
      passErrorToListener(
        Components.Exception(e.message, e.result), context
      );
      return;
    }

    passResultToListener(context);
  }

  function onXhrError(event, context) {
    logger.info('Response error ' + event.target.statusText);

    passErrorToListener(
      Components.Exception('Unknown network error'), context
    );
  }

  function passResultToListener(context) {
    reset();
    if (isSuccess()) {
      logger.info('Successful response');
      listener.onResult(client, response, context);
    } else {
      logger.info('Fault response "' + response.faultCode() + '": ' +
                  response.faultString());
      listener.onFault(client, response, context);
    }
  }

  function passErrorToListener(error, context) {
    logger.error('Invalid response because of error ' + error);

    reset();
    listener.onError(client, error, context);
  }

  function reset() {
    request = null;
    xhr = null;
  }

  function getUri() {
    return uri;
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

  function init() {
    logger = cal3eLogger.create('extensions.calendar3e.log.xmlRpc');
  }

  client.call = call;
  client.abort = abort;
  client.uri = getUri;
  client.setListener = setListener;
  client.setWindow = setWindow;

  init();
}

function Request(name, parameters, masked) {
  var request = this;
  var body;
  var logBody;

  function appendMethodCallStartAndNameToBody() {
    append('<methodCall>');
    append('<methodName>' + name + '</methodName>');
  }

  function appendParametersToBody() {
    append('<params>');
    parameters.forEach(appendParameterToBody);
    append('</params>');
  }

  function appendParameterToBody(parameter, idx) {
    body += '<param><value>' + createValue(parameter) + '</value></param>';
    logBody += masked.indexOf(idx) < 0 ?
      '<param><value>' + createValue(parameter) + '</value></param>' :
      '<param>###MASKED###</param>';
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
      value = parameter.replace(/&/g, '&amp;').replace(/</g, '&lt;');
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

  function append(string) {
    body += string;
    logBody += string;
  }

  function getName() {
    return name;
  }

  function getBody() {
    return body;
  }

  function getLogBody() {
    return logBody;
  }

  function init() {
    if (!masked) {
      masked = [];
    }

    body = logBody = '';
    append('<?xml version="1.0" encoding="UTF-8"?>');

    appendMethodCallStartAndNameToBody();
    appendParametersToBody();
    appendMethodCallEndToBody();
  }

  request.name = getName;
  request.body = getBody;
  request.logBody = getLogBody;

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
  var logger;

  function normalizeType(valueElement) {
    if (!hasExplicitType(valueElement) &&
        !hasImplicitType(valueElement)) {
      logger.error('Unexpected content in value element: ' +
                   Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                   .createInstance(Components.interfaces.nsIDOMSerializer)
                   .serializeToString(valueElement));
      throw Components.Exception(
        'Unexpected type element',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return hasExplicitType(valueElement) ?
      valueElement.firstChild.tagName :
      'string';
  }

  function parseValue(valueElement, level) {
    logger.info('Parsing value on level ' + level);
    logger.debug('Parsing XML: ' +
                Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                .createInstance(Components.interfaces.nsIDOMSerializer)
                .serializeToString(valueElement));

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
      logger.error('Unknown value type in value element: ' +
                   Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                   .createInstance(Components.interfaces.nsIDOMSerializer)
                   .serializeToString(valueElement));
      throw Components.Exception(
        'Unexpected value type',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    logger.info('Value is of ' +
                '"' + types[normalizeType(valueElement)].name + '" type');

    return types[normalizeType(valueElement)](valueElement, level + 1);
  }

  function hasExplicitType(valueElement) {
    return valueElement.firstChild &&
      (valueElement.firstChild.nodeType ===
       Components.interfaces.nsIDOMNode.ELEMENT_NODE);
  }

  function hasImplicitType(valueElement) {
    return !valueElement.firstChild ||
      (valueElement.firstChild.nodeType ===
       Components.interfaces.nsIDOMNode.TEXT_NODE);
  }

  function hasNoData(valueElement) {
    return !getDataNode(valueElement);
  }

  function hasScalarData(valueElement) {
    return getDataNode(valueElement).nodeType ===
      Components.interfaces.nsIDOMNode.TEXT_NODE;
  }

  function getDataNode(valueElement) {
    if (hasExplicitType(valueElement)) {
      return valueElement.firstChild.firstChild;
    } else if (hasImplicitType(valueElement)) {
      return valueElement.firstChild;
    }
  }

  function scalarValue(valueElement) {
    var scalarValue;
    if (hasNoData(valueElement)) {
      scalarValue = null;
    } else if (hasScalarData(valueElement)) {
      scalarValue = getDataNode(valueElement).data;
    } else {
      logger.error('Unrecognizable scalar value in value element: ' +
                   Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                   .createInstance(Components.interfaces.nsIDOMSerializer)
                   .serializeToString(valueElement));
      throw Components.Exception(
        'Not a scalar value',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    logger.info('Scalar value retrieved "' + scalarValue + '"');

    return scalarValue;
  }

  function intValue(valueElement) {
    if (hasScalarData(valueElement) &&
        isNaN(parseInt(scalarValue(valueElement)))) {
      logger.error('Not an integer found in value element: ' +
                   Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                   .createInstance(Components.interfaces.nsIDOMSerializer)
                   .serializeToString(valueElement));
      throw Components.Exception(
        'Unexpected int value',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return hasScalarData(valueElement) ?
      parseInt(scalarValue(valueElement)) :
      null;
  }

  function booleanValue(valueElement) {
    if (hasScalarData(valueElement) &&
        (['0', '1'].indexOf(scalarValue(valueElement)) < 0)) {
      logger.error('Not a boolean found in value element: ' +
                   Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                   .createInstance(Components.interfaces.nsIDOMSerializer)
                   .serializeToString(valueElement));
      throw Components.Exception(
        'Unexpected boolean value',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return hasScalarData(valueElement) ?
      scalarValue(valueElement) === '1' :
      null;
  }

  function stringValue(valueElement) {
    return scalarValue(valueElement) !== null ?
      '' + scalarValue(valueElement) :
      null;
  }

  function doubleValue(valueElement) {
    if (hasScalarData(valueElement) &&
        isNaN(parseFloat(scalarValue(valueElement)))) {
      logger.error('Not a double found in value element: ' +
                   Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                   .createInstance(Components.interfaces.nsIDOMSerializer)
                   .serializeToString(valueElement));
      throw Components.Exception(
        'Unexpected float value',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return hasScalarData(valueElement) ?
      parseFloat(scalarValue(valueElement)) :
      null;
  }

  function dateTimeValue(valueElement) {
    var value;
    try {
      value = ISO8601DateUtils.parse(scalarValue(valueElement));
    } catch (e) {
      logger.error('Not a date found in value element: ' +
                   Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                   .createInstance(Components.interfaces.nsIDOMSerializer)
                   .serializeToString(valueElement));
      throw e;
    }

    return value;
  }

  function base64Value(valueElement) {
    return hasScalarData(valueElement) ?
      atob(scalarValue(valueElement)) :
      null;
  }

  function structValue(valueElement, level) {
    var struct = {};
    var structElement = valueElement.firstChild;
    var idx, member;
    for (idx = 0; idx < structElement.childNodes.length; idx += 1) {
      logger.info('Parsing member value');

      member = memberValue(
        valueElement, structElement.childNodes.item(idx), level
      );
      struct[member['name']] = member['value'];

      logger.info('Member named "' + member['name'] + '" ' +
                  'with value "' + member['value'] + '"');
    }

    return struct;
  }

  function memberValue(valueElement, memberElement, level) {
    if (!memberElement.tagName || (memberElement.tagName !== 'member')) {
      logger.error('Member is in element named ' +
                   '"' + memberElement.tagName + '" in value element: ' +
                   Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                   .createInstance(Components.interfaces.nsIDOMSerializer)
                   .serializeToString(valueElement));
      throw Components.Exception(
        'Member element expected in struct',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }
    if (memberElement.childNodes.length !== 2) {
      logger.error('Unexpected content of member element in value element: ' +
                   Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                   .createInstance(Components.interfaces.nsIDOMSerializer)
                   .serializeToString(valueElement));
      throw Components.Exception(
        'Only name and value elements expected in struct',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }
    if (!memberElement.firstChild || !memberElement.firstChild.tagName ||
        (memberElement.firstChild.tagName !== 'name')) {
      logger.error('No name element in member element in value element: ' +
                   Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                   .createInstance(Components.interfaces.nsIDOMSerializer)
                   .serializeToString(valueElement));
      throw Components.Exception(
        'Name element expected in struct',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    return {
      'name': scalarValue(memberElement.firstChild),
      'value': parseValue(memberElement.lastChild, level)
    };
  }

  function arrayValue(valueElement, level) {
    var dataElement = valueElement.firstChild.firstChild;
    if (!dataElement || !dataElement.tagName ||
        (dataElement.tagName !== 'data')) {
      logger.error('No data element in array value element: ' +
                   Components.classes['@mozilla.org/xmlextras/xmlserializer;1']
                   .createInstance(Components.interfaces.nsIDOMSerializer)
                   .serializeToString(valueElement));
      throw Components.Exception(
        'Data element expected in array',
        Components.results.NS_ERROR_UNEXPECTED
      );
    }

    var array = [];
    var idx;
    logger.info('Parsing ' + dataElement.childNodes.length + ' data ' +
                'elements in array');
    for (idx = 0; idx < dataElement.childNodes.length; idx += 1) {
      array.push(parseValue(dataElement.childNodes.item(idx), level + 1));
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
    logger = cal3eLogger.create('extensions.calendar3e.log.xmlRpcParser');
    type = normalizeType(valueElement);
    parsedValue = parseValue(valueElement, 0);
  }

  value.type = getType;
  value.value = getValue;

  init();
}

var cal3eXmlRpc = {
  Client: Client,
  Base64Parameter: Base64Parameter
};
EXPORTED_SYMBOLS = [
  'cal3eXmlRpc'
];
