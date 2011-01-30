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

/**
 * Synchronizer of calendars present in Mozilla client application
 * (i.e. Lightning) with those on EEE server.
 */
function calEeeSynchronizer() {}

calEeeSynchronizer.prototype = {

  QueryInterface: XPCOMUtils.generateQI([
    Ci.calEeeISynchronizer
  ]),


  /**
   * Synchronizes calendars of client's identity with those on EEE
   * server.
   *
   * @param {calEeeIClient} client
   * @returns {calEeeISynchronizer} receiver
   */
  synchronize: function calEeeSynchronizer_synchronize(client) {
    throw new Error("Not yet implemented");
  }

};
