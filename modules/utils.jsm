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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * Wraps given function to object acting as calIGenericOperationListener
 *
 * @param {Function} onResult
 * @returns {calIGenericOperationListener}
 */
function createOperationListener(onResult) {
  return {
    QueryInterface: XPCOMUtils.generateQI([
      Components.interfaces.calIGenericOperationListener
    ]),
    onResult: onResult
  };
}

/**
 * Takes NSPR time and returns EEE date as used in queries.
 *
 * @param {PRTime} nsprTime
 * @returns {String}
 */
function nsprTimeToEeeDate(nsprTime) {
  function zeropad(number, length) {
    var string = '' + number;
    while (string.length < length) {
      string = '0' + string;
    }

    return string;
  }

  var jsDate = new Date(nsprTime / 1000);

  return '' +
    zeropad(jsDate.getUTCFullYear(), 4) + '-' +
    zeropad(jsDate.getUTCMonth() + 1, 2) + '-' +
    zeropad(jsDate.getUTCDate(), 2) + ' ' +
    zeropad(jsDate.getUTCHours(), 2) + ':' +
    zeropad(jsDate.getUTCMinutes(), 2) + ':' +
    zeropad(jsDate.getUTCSeconds(), 2);
}

var cal3eUtils = {
  createOperationListener: createOperationListener,
  nsprTimeToEeeDate: nsprTimeToEeeDate
};
EXPORTED_SYMBOLS = [
  'cal3eUtils'
];
