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

Components.utils.import('resource://calendar3e/modules/resolv.jsm');

function cal3eDns() {
  var dns = this;
  var resolv;

  function resolveServer(domainName) {
    var records = resolv
      .resources(domainName, Resolv.DNS.Resource.TXT)
      .filter(function(resource) {
        return resource.data().match(/^eee /) &&
          resource.data().match(cal3eDns.EEE_SERVER_RESOURCE_RE);
      })
      .map(function(resource) {
        var match = cal3eDns.EEE_SERVER_RESOURCE_RE.exec(resource.data());
        return [
          match[1] || domainName,
          match[2] || cal3eDns.DEFAULT_PORT
        ];
      });

    if (records.length === 0) {
      records.push([domainName, cal3eDns.DEFAULT_PORT]);
    }

    return records[0];
  }

  function init() {
    resolv = new Resolv.DNS()
  }

  dns.resolveServer = resolveServer;

  init();
}
cal3eDns.DEFAULT_PORT = 4444;
cal3eDns.EEE_SERVER_RESOURCE_RE = /\bserver=([^:]+)(?::(\d{1,5}))?\b/;

EXPORTED_SYMBOLS = [
  'cal3eDns'
];
