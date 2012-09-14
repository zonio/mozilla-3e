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

function cal3eDns(resolv) {
  var dns = this;

  function resolveServer(domainName, callback) {
    resolv.addEventListener('message', function onResult(event) {
      resolv.removeEventListener('message', onResult, false);
      didGetResources(domainName, event.data.result, callback);
    }, false);
    resolv.postMessage({
      name: 'resources',
      args: [domainName, 'TXT']
    });
  }

  function didGetResources(domainName, resources, callback) {
    var records = resources
      .map(function(data) {
        return Resolv.DNS.Resource.fromJson(data);
      })
      .filter(function(resource) {
        return resource.data().match(/^eee /) &&
          resource.data().match(cal3eDns.EEE_SERVER_RESOURCE_RE);
      })
      .map(function(resource) {
        var match = cal3eDns.EEE_SERVER_RESOURCE_RE.exec(resource.data());
        return {
          'host': match[1] || domainName,
          'port': match[2] || cal3eDns.DEFAULT_PORT
        };
      });

    if (records.length === 0) {
      records.push({
        'host': domainName,
        'port': cal3eDns.DEFAULT_PORT
      });
    }

    callback(records[0]);
  }

  function init() {
    if (!resolv) {
      resolv = new ChromeWorker(
        'resource://calendar3e/modules/resolv.jsm'
      );
      resolv.postMessage({
        name: 'init',
        args: [
          Components.classes['@mozilla.org/xre/app-info;1']
            .getService(Components.interfaces.nsIXULRuntime).OS]
      });
    }
  }

  dns.resolveServer = resolveServer;

  init();
}
cal3eDns.DEFAULT_PORT = 4444;
cal3eDns.EEE_SERVER_RESOURCE_RE = /\bserver=([^:]+)(?::(\d{1,5}))?\b/;

EXPORTED_SYMBOLS = [
  'cal3eDns'
];
