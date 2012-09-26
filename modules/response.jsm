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

Components.utils.import('resource://gre/modules/Services.jsm');

/**
 * Representation of successful response from EEE server.
 *
 * @param {cal3eRequest.Queue} queue
 *
 * @property {nsISupports} data
 * @class
 */
function Success(queue) {
  Object.defineProperty(this, 'data', {
    value: queue.lastResponse().parameter()
  });
}

/**
 * Representation of error response on level of EEE protocol.
 *
 * @param {cal3eRequest.Queue} queue
 *
 * @property {nsISupports} data always null
 * @property {Number} errorCode should be one of {@link eeeErrors}
 * @class
 */
function EeeError(queue) {
  Object.defineProperty(this, 'data', {
    value: null
  });
  Object.defineProperty(this, 'errorCode', {
    value: queue.lastResponse().faultCode()
  });
}

/**
 * Representation of transport response on level below EEE protocol.
 *
 * @param {cal3eRequest.Queue} queue method queue which executed
 * errorneous request
 *
 * @property {nsISupports} data always null
 * @property {Number} errorCode should be one of {@link Components.results}
 * @class
 */
function TransportError(queue) {
  Object.defineProperty(this, 'data', {
    value: null
  });
  Object.defineProperty(this, 'errorCode', {
    value: queue.status()
  });
}

/**
 * Representation of transport response on level below EEE protocol.
 *
 * @param {Number} errorCode one of errors from {@link userErrors}
 *
 * @property {nsISupports} data always null
 * @property {Number} errorCode exactly the same as constructor's
 * parameter
 * @class
 */
function UserError(errorCode) {
  Object.defineProperty(this, 'data', {
    value: null
  });
  Object.defineProperty(this, 'timestamp', {
    value: new Date()
  });
  Object.defineProperty(this, 'errorCode', {
    value: errorCode
  });
}

/**
 * Dynamically loaded error code maps.
 *
 * @property {Object} eeeErrors
 * @property {Object} userErrors
 */
var errors = {
  'eeeErrors': { 'notLoaded': true },
  'userErrors': { 'notLoaded': true }
};

function loadErrors(errorListName) {
  if (!errors[errorListName]['notLoaded']) {
    return;
  }

  var errorDocument = Components.classes[
    '@mozilla.org/xmlextras/domparser;1'
  ].createInstance(Components.interfaces.nsIDOMParser).
    parseFromString(getErrorsXml(errorListName), 'text/xml');

  var errorElement = errorDocument.documentElement;
  if (errorListName !== errorElement.tagName) {
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
    nameElement = codeElement.nextElementSibling;
    if ('name' !== nameElement.tagName) {
      throw Components.Exception(
        "Unexpected element '" + nameElement.tagName + "' instead of 'code'"
      );
    }

    errors[errorListName][nameElement.textContent] =
      1 * codeElement.textContent;
  }

  delete errors[errorListName]['notLoaded'];
}

function getErrorsXml(errorListName) {
  var stream = Components.classes[
    '@mozilla.org/scriptableinputstream;1'
  ].getService(Components.interfaces.nsIScriptableInputStream);

  var channel = Services.io.newChannel(
    'resource://calendar3e/' + errorListName + '.xml', null, null
  );
  var input = channel.open();
  stream.init(input);
  var str = stream.read(input.available());
  stream.close();
  input.close();

  return str;
}

function fromRequestQueue(queue) {

  function getEeeResponseType() {
    if (queue.isFault()) {
      return EeeError;
    } else if (!Components.isSuccessCode(queue.status())) {
      return TransportError;
    }

    return Success;
  }

  return new (getEeeResponseType())(queue);
}

function createErrorsGetter(errorListName) {
  return function errorsGetter() {
    loadErrors(errorListName);
    return errors[errorListName];
  }
}

function getExportedErrorProperties(errorListNames) {
  var properties = {};
  errorListNames.forEach(function(errorListName) {
    properties[errorListName] = { get: createErrorsGetter(errorListName) };
  });

  return properties;
}

var cal3eResponse = Object.create({
  fromRequestQueue: fromRequestQueue,
  Success: Success,
  EeeError: EeeError,
  TransportError: TransportError,
  UserError: UserError
}, getExportedErrorProperties(['eeeErrors', 'userErrors']));
EXPORTED_SYMBOLS = [
  'cal3eResponse'
];
