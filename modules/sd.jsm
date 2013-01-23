/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2013  Zonio s.r.o.
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
Components.utils.import('resource://calendar3e/modules/synchronization.jsm');

function cal3eSd(providers, cache) {
  var sd = this;
  var logger;

  function resolveServer(domainName, callback) {
    var queue = new cal3eSynchronization.Queue();
    queue
      .push(getPassOrTryNextCallback(queue, domainName, callback))
      .push(getTryToGetServiceCallback(queue, domainName, callback));
    queue.call();
  }

  function getPassOrTryNextCallback(queue, domainName, callback) {
    var idx = 0;

    return function passOrTryNextCallback(service) {
      providers[idx].resolvServer(domainName, function(result) {
        idx += 1;
        if (!result && providers[idx]) {
          passOrTryNextCallback(service);
        } else if (result) {
          service = result;
        }

        queue.next()(service);
      });
    };
  }

  function getTryToGetServiceCallback(queue, domainName, callback) {
    var tryCount = 0;

    return function tryToGetServiceCallback(service) {
      if (!service &&
          (tryCount <
           Services.prefs.getIntPref('extensions.calendar3e.sd_try_limit'))) {
        tryCount += 1;
        queue.reset().next()(service);
      }

      callback(service);
    };
  }

  function init() {
    logger = cal3eLogger.create('extensions.calendar3e.log.sd');

    if (!providers) {
      providers = [
        new DnsSd(),
        new WellKnownSd()
      ];
    }

    if (!cache) {
      cache = new Cache();
    }
  }

  sd.resolveServer = resolveServer;

  init();
}
cal3eSd.DEFAULT_PORT = 4444;
cal3eSd.DEFAULT_TTL = 86400;

function DnsSd(resolv) {
  var dnsSd = this;
  var resolv;
  var logger;

  function resolveServer(domainName, callback) {
    logger.info('Resolving domain name "' + domainName + '"');

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

      didGetResources(
        domainName,
        getEeeServiceResourceFromEvent(event),
        callback
      );
    };
  }

  function getEeeServiceResourceFromEvent(event) {
    if (event.data.result.length === 0) {
      return null;
    }

    var dnsResources = event.data.result
      .map(function(data) {
        return Resolv.DNS.Resource.fromJson(data);
      })
      .filter(function(resource) {
        return resource.data().match(/^eee /);
      });

    var resource = dnsResources
      .reduce(function(combinedData, resource) {
        return combinedData + ' ' + resource.data();
      }, '')
      .split(/\s+/)
      .reduce(function(brokenData, keyValuePair) {
        var pair = keyValuePair.split('=', 2);

        return brokenData[pair[0]] = pair[1];
      }, {});

    if (dnsResources.length > 0) {
      resource['ttl'] = dnsResources[0].ttl();
    }

    return resource;
  }

  function didGetResources(domainName, resource, callback) {
    if (!resource) {
      logger.info('No DNS records found for "' + domainName + '"');
      callback();
    }

    if (!resource['host']) {
      logger.warn('No host found for "' + domainName + '", trying default');
    }
    if (!resource['port']) {
      logger.warn('No port found for "' + domainName + '", trying default');
    }
    if (!resource['ttl']) {
      logger.info('No TTL found for "' + domainName + '", trying default');
    }

    logger.info('Domain name "' + domainName + '" resolved as "' +
                resource['host'] + ':' + resource['port'] + '" with TTL ' +
                resource['ttl']);

    callback(new Service(domainName, resource['host'],
                                     resource['port'],
                                     resource['ttl']));
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
    resolv.postMessage({
      name: 'init',
      args: [
        Components.classes['@mozilla.org/xre/app-info;1']
          .getService(Components.interfaces.nsIXULRuntime).OS]
    });

    return resolv;
  }

  function init() {
    logger = cal3eLogger.create('extensions.calendar3e.log.sd');

    if (!resolv) {
      resolv = getDefaultResolv();
    }
  }

  dnsSd.resolveServer = resolveServer;

  init();
}

function WellKnownSd() {
  var wellKnownSd = this;

  function resolveServer(domainName, callback) {
    callback(new Service(domainName));
  }

  wellKnownSd.resolveServer = resolveServer;
}

function Service(domainName, host, port, ttl) {
  var service = this;

  function getDomainName() {
    return domainName;
  }

  function getHost() {
    return host || domainName;
  }

  function getPort() {
    return port || cal3eSd.DEFAULT_PORT;
  }

  function getTtl() {
    return ttl || cal3eSd.DEFAULT_TTL;
  }

  service.domainName = getDomainName();
  service.host = getHost();
  service.port = getPort();
  service.ttl = getTtl();
}

function Cache() {
  var cache = this;
  var store;
  var logger;

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

    logger = cal3eLogger.create('extensions.calendar3e.log.sd');
  }

  cache.get = get;
  cache.set = set;

  init();
}

EXPORTED_SYMBOLS = [
  'cal3eSd'
];
