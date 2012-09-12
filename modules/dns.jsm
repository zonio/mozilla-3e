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
  var EEE_SERVER_RESOURCE_RE = / server=([^:]+)(?::(\d{1,5}))?\b/;
  var resolv;

  function resolveServer(domainName) {
    var records = resolv
      .resources(domainName, Resolv.DNS.Resource.TXT)
      .filter(function(resource) {
        return resource.data().match(/^eee /) &&
          resource.data().match(EEE_SERVER_RESOURCE_RE);
      })
      .map(function(resource) {
        var match = EEE_SERVER_RESOURCE_RE.exec(resource.data());
        return [
          match[1] || domainName,
          match[2] || cal3eDns.DEFAULT_PORT
        ];
      });

    return records.length > 0 ? records[0] : [null, null];
  }

  function init() {
    resolv = new Resolv.DNS()
  }

  dns.resolveServer = resolveServer;

  init();
}

EXPORTED_SYMBOLS = [
  'cal3eDns'
];
