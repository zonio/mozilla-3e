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
    "code": { "value": data.faultCode },
    "name": { "value": "Not Yet Implemented" },
    "description": { "value": "Not Yet Implemented" }
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

var cal3eResponse = {
  "factory": factory
};
EXPORTED_SYMBOLS = [
  'cal3eResponse'
];
