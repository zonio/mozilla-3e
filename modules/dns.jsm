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

Components.utils.import("resource://calendar3e/modules/resolv.jsm");

function cal3eDns() {
}

cal3eDns.DEFAULT_PORT = 4444;

cal3eDns.prototype = {

  resolveServer: function cal3eDns_resolveServer(domainName) {
    var foundEeeRecord = [null, null];
    var dns = new Resolv.DNS();
    var eeeServerRe = /\beee server=([^:]+)(?::(\d{1,5}))?/, match;
    dns.getresource(
      domainName, Resolv.DNS.Resource.TXT, function (resource) {
        match = eeeServerRe.exec(resource.data());
        if (!match) return;
        foundEeeRecord[0] = match[1];
        foundEeeRecord[1] = match[2];
        return false;
      }
    );
    if (!foundEeeRecord[0]) foundEeeRecord[0] = domainName;
    if (!foundEeeRecord[1]) foundEeeRecord[1] = cal3eDns.DEFAULT_PORT;

    return foundEeeRecord;d
  }

}

EXPORTED_SYMBOLS = [
  'cal3eDns'
];
