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

Components.utils.import("resource://gre/modules/Services.jsm");

function Success(data) {
  return Object.create(Object.prototype, {
    "isSuccess": { "value": true },
    "isEeeError": { "value": false },
    "isTransportError": { "value": false },
    "data": { "value": data }
  });
}

function EeeError(data) {
  return Object.create(Object.prototype, {
    "isSuccess": { "value": false },
    "isEeeError": { "value": true },
    "isTransportError": { "value": false },
    "data": { "value": null },
    "errorCode": { "value": data.faultCode }
  });
}

function TransportError(data) {
  return Object.create(Object.prototype, {
    "isSuccess": { "value": false },
    "isEeeError": { "value": false },
    "isTransportError": { "value": true },
    "data": { "value": null }
  });
}

var errors = { "notLoaded": true };

function loadErrors() {
  if (!errors["notLoaded"]) {
    return;
  }

  var errorDocument = Components.classes[
    "@mozilla.org/xmlextras/domparser;1"
  ].createInstance(Components.interfaces.nsIDOMParser).
    parseFromString(getErrorsXml(), "text/xml");

  var errorElement = errorDocument.documentElement;
  if ('eeeErrors' !== errorElement.tagName) {
    throw Components.Exception(
      "Unexpected document element '" + errorElement.tagName + "'"
    );
  }

  var errorList = errorElement.getElementsByTagName('error');
  var codeElement, nameElement;
  for (var idx = 0; idx < errorList.length; idx += 1) {
    codeElement = errorList.item(idx).firstElementChild;
    if ('code' !== codeElement.tagName) {
      throw Components.Exception(
        "Unexpected element '" + codeElement.tagName + "' instead of 'code'"
      );
    }
    nameElement = codeElement.nextElementSibling
    if ('name' !== nameElement.tagName) {
      throw Components.Exception(
        "Unexpected element '" + nameElement.tagName + "' instead of 'code'"
      );
    }

    errors[nameElement.textContent] = 1 * codeElement.textContent;
  }

  delete errors["notLoaded"];
}

function getErrorsXml() {
  var stream = Components.classes[
    "@mozilla.org/scriptableinputstream;1"
  ].getService(Components.interfaces.nsIScriptableInputStream);

  var channel = Services.io.newChannel(
    "resource://calendar3e/eeeErrors.xml", null, null
  );
  var input = channel.open();
  stream.init(input);
  var str = stream.read(input.available());
  stream.close();
  input.close();

  return str;
}

function factory(xmlRpcResponse) {

  function getEeeResponseType(xmlRpcResponse) {
    if (null === xmlRpcResponse) {
      return TransportError;
    }
    if (xmlRpcResponse instanceof Components.interfaces.nsIXmlRpcFault) {
      return EeeError;
    }

    return Success;
  }

  return getEeeResponseType(xmlRpcResponse)(xmlRpcResponse);
}

var cal3eResponse = Object.create({
  "factory": factory
}, {
  "errors": {
    "get": function() {
      loadErrors();
      return errors;
    }
  }
});
EXPORTED_SYMBOLS = [
  'cal3eResponse'
];
