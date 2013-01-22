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

Components.utils.import('resource://calendar3e/modules/logger.jsm');
Components.utils.import('resource://calendar3e/modules/resolv.jsm');

function cal3eSd(resolv, cache) {
  var sd = this;
  var logger;

  function resolveServer(domainName, callback) {
    logger.info('Resolving domain name "' + domainName + '"');

    var resources;
    if (resources = cache.get(domainName)) {
      didGetResources(domainName, resources, callback);
      return;
    }

    logger.info('Asking resolver for "' + domainName + '"');

    resolv.addEventListener(
      'message', getOnMessageListener(resolv, domainName, callback), false
    );
    resolv.postMessage({
      name: 'resources',
      args: [domainName, 'TXT']
    });
  }

  function getOnMessageListener(resolv, domainName, callback) {
    return function onMessage(event) {
      resolv.removeEventListener('message', onMessage, false);

      logger.info('Data from resolver for "' + domainName + '" received');

      var resources = getEeeServerResourcesFromEvent(event, domainName);
      cache.set(domainName, resources);

      didGetResources(domainName, resources, callback);
    };
  }

  function getEeeServerResourcesFromEvent(event, domainName) {
    var resources = event.data.result
      .map(function(data) {
        return Resolv.DNS.Resource.fromJson(data);
      })
      .filter(function(resource) {
        return resource.data().match(/^eee /) &&
          resource.data().match(cal3eSd.EEE_SERVER_RESOURCE_RE);
      });

    if (resources.length === 0) {
      if (event.data.result.length === 0) {
        logger.warn('No data found for "' + domainName + '", trying default');
      }
      resources.push(new Resolv.DNS.Resource['TXT'](
        cal3eSd.DEFAULT_TTL,
        'eee server=' + domainName + ':' + cal3eSd.DEFAULT_PORT
      ));
    }

    return resources;
  }

  function didGetResources(domainName, resources, callback) {
    var records = resources.map(function(resource) {
      var match = cal3eSd.EEE_SERVER_RESOURCE_RE.exec(resource.data());
      if (!match[1]) {
        logger.warn('No host found for "' + domainName + '", trying default');
      }
      if (!match[2]) {
        logger.warn('No port found for "' + domainName + '", trying default');
      }

      return {
        'host': match[1] || domainName,
        'port': match[2] || cal3eSd.DEFAULT_PORT
      };
    });

    logger.info('Domain name "' + domainName + '" resolved as "' +
                records[0]['host'] + ':' + records[0]['port'] + '"');

    callback(records[0]);
  }

  function getDefaultResolv() {
    var resolv;

    if (typeof ChromeWorker !== 'undefined') {
      resolv = new ChromeWorker('resource://calendar3e/modules/resolv.jsm');
    } else {
      resolv = Components.classes['@mozilla.org/threads/workerfactory;1']
        .createInstance(Components.interfaces.nsIWorkerFactory)
        .newChromeWorker('resource://calendar3e/modules/resolv.jsm');
    }

    return resolv;
  }

  function init() {
    logger = cal3eLogger.create('extensions.calendar3e.log.sd');

    if (!cache) {
      cache = new Cache(logger);
    }

    if (!resolv) {
      resolv = getDefaultResolv();
      resolv.postMessage({
        name: 'init',
        args: [
          Components.classes['@mozilla.org/xre/app-info;1']
            .getService(Components.interfaces.nsIXULRuntime).OS]
      });
    }
  }

  sd.resolveServer = resolveServer;

  init();
}
cal3eSd.DEFAULT_PORT = 4444;
cal3eSd.DEFAULT_TTL = 86400;
cal3eSd.EEE_SERVER_RESOURCE_RE = /\bserver=([^:]+)(?::(\d{1,5}))?\b/;

function Cache(logger) {
  var cache = this;
  var store;

  function get(name) {
    cleanup();

    if (store[name]) {
      logger.info('Cache hit for "' + name + '"');
    }

    return store[name] ? store[name]['resources'] : null;
  }

  function set(name, resources) {
    store[name] = {
      'until': getUntil(resources),
      'resources': resources
    };
    cleanup();

    if (store[name]) {
      logger.info('Cache set for "' + name + '"');
    }
  }

  function getUntil(resources) {
    var ttl = resources.reduce(function(min, resource) {
      if (min > resource.ttl()) {
        min = resource.ttl();
      }

      return min;
    }, Number.POSITIVE_INFINITY);

    if ((ttl < 0) || (ttl === Number.POSITIVE_INFINITY)) {
      ttl = 0;
    }

    return new Date(Date.now() + 1000 * ttl);
  }

  function cleanup() {
    var name;
    for (name in store) {
      if (!store.hasOwnProperty(name)) {
        continue;
      }

      if (store[name]['until'] < new Date()) {
        delete store[name];
      }
    }
  }

  function init() {
    store = {};
  }

  cache.get = get;
  cache.set = set;

  init();
}

EXPORTED_SYMBOLS = [
  'cal3eSd'
];
