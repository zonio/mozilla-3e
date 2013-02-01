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

Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://calendar3e/modules/logger.jsm');
Components.utils.import('resource://calendar3e/modules/http.jsm');
Components.utils.import('resource://calendar3e/modules/resolv.jsm');
Components.utils.import('resource://calendar3e/modules/synchronization.jsm');

function cal3eSd(providers, cache) {
  var sd = this;
  var logger;

  function resolveServer(domainName, callback) {
    logger.info('Resolving domain name "' + domainName + '"');

    var service;
    if (service = cache.get(domainName)) {
      getPassServiceCallback(queue, domainName, callback)(service);
      return;
    }

    var queue = new cal3eSynchronization.Queue();
    queue
      .push(getPassOrTryNextProviderCallback(queue, domainName, callback))
      .push(getTryToGetServiceCallback(queue, domainName, callback))
      .push(getDefaultServiceCallback(queue, domainName, callback))
      .push(getCacheServiceCallback(queue, domainName, callback))
      .push(getPassServiceCallback(queue, domainName, callback));
    queue.call(service);
  }

  function getPassOrTryNextProviderCallback(queue, domainName, callback) {
    return function passOrTryNextProviderCallback(service, idx) {
      if (!idx) {
        idx = 0;
      }

      providers[idx].resolveServer(domainName, function(result) {
        idx += 1;
        if (!result && providers[idx]) {
          passOrTryNextProviderCallback(service, idx);
          return;
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
        logger.info('Try #' + tryCount + ' to get service parameters fro ' +
                    '"' + domainName + '" failed');

        tryCount += 1;
        queue.reset();
      }

      queue.next()(service);
    };
  }

  function getDefaultServiceCallback(queue, domainName, callback) {
    return function defaultServiceCallback(service) {
      if (!service) {
        logger.warn('Cannot resolve service parameter for ' +
                    '"' + domainName + '"');

        service = new Service(domainName);
      }

      queue.next()(service);
    };
  }

  function getCacheServiceCallback(queue, domainName, callback) {
    return function cacheServiceCallback(service) {
      cache.set(domainName, service);

      queue.next()(service);
    };
  }

  function getPassServiceCallback(queue, domainName, callback) {
    return function passServiceCallback(service) {
      logger.info('Passing back service parameters for "' + domainName + '" ' +
                  'as "' + service + '"');

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

function DnsSd(resolv) {
  var dnsSd = this;
  var resolv;
  var logger;

  function resolveServer(domainName, callback) {
    logger.info('Resolving domain name "' + domainName + '" using DNS');

    resolv.addEventListener(
      'message', getDidCreateListener(resolv, domainName, callback), false
    );
    resolv.postMessage({
      name: 'create',
      args: [
        Components.classes['@mozilla.org/xre/app-info;1']
          .getService(Components.interfaces.nsIXULRuntime).OS]
    });
  }

  function getDidCreateListener(resolv, domainName, callback) {
    return function didCreateListener(event) {
      resolv.removeEventListener('message', didCreateListener, false);

      resolv.addEventListener(
        'message', getOnMessageListener(resolv, domainName, callback), false
      );
      resolv.postMessage({
        name: 'resources',
        args: [domainName, 'TXT']
      });
    };
  }

  function getOnMessageListener(resolv, domainName, callback) {
    return function onMessage(event) {
      resolv.removeEventListener('message', onMessage, false);

      logger.info('Data from resolver for "' + domainName + '" received ' +
                  'from DNS');

      didGetProviderData(
        domainName,
        getProviderDataFromEvent(event),
        callback
      );
    };
  }

  function getProviderDataFromEvent(event) {
    var dnsResources = event.data.result
      .map(function(data) {
        return Resolv.DNS.Resource.fromJson(data);
      })
      .filter(function(resource) {
        return resource.data().match(/^eee /);
      });
    if (dnsResources.length === 0) {
      return null;
    }

    var parser = new ProviderDataParser(
      dnsResources.map(function(res) { return res.data() }).join(' '),
      getTtlFromDnsResources(dnsResources)
    );

    return parser.parsedData();
  }

  function getTtlFromDnsResources(dnsResources) {
    return 1000 * dnsResources.reduce(function(ttl, dnsResource) {
      if (ttl > dnsResource.ttl()) {
        ttl = dnsResource.ttl();
      }

      return ttl;
    }, Number.POSITIVE_INFINITY);
  }

  function didGetProviderData(domainName, data, callback) {
    if (!data) {
      logger.info('No DNS records found for "' + domainName + '"');
      callback();
      return;
    }

    logger.info('Domain name "' + domainName + '" resolved via DNS as "' +
                data['server'] + '" with TTL ' +
                data['ttl']);

    callback(Service.fromProviderData(domainName, data, logger));
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

    if (!resolv) {
      resolv = getDefaultResolv();
    }
  }

  dnsSd.resolveServer = resolveServer;

  init();
}

function WellKnownSd() {
  var wellKnownSd = this;
  var logger;

  function resolveServer(domainName, callback) {
    logger.info('Resolving domain name "' + domainName + '" using ' +
                'well-known URI');

    doXhrSend({
      'domainName': domainName,
      'callback': callback
    });
  }

  function doXhrSend(context) {
    var channelCallbacks = new cal3eHttp.ChannelCallbacks(
      doXhrSend,
      onXhrLoad,
      context,
      null,
      logger
    );

    var xhr = Components.classes['@mozilla.org/xmlextras/xmlhttprequest;1']
      .createInstance(Components.interfaces.nsIXMLHttpRequest);
    xhr.open(
      'GET',
      'http://' + context['domainName'] + WellKnownSd.WELL_KNOWN_URI_PATH
    );
    xhr.setRequestHeader('Content-Type', 'text/plain');
    xhr.addEventListener('load', function(event) {
      onXhrLoad(event, context);
    }, false);
    xhr.addEventListener('error', function(event) {
      if (channelCallbacks.isActive()) {
        return;
      }

      onXhrLoad(event, context);
    }, false);
    xhr.channel.notificationCallbacks = channelCallbacks;

    xhr.send();
  }

  function onXhrLoad(eventOrError, context) {
    didGetProviderData(
      context['domainName'],
      getProviderDataFromEvent(eventOrError),
      context['callback']
    );
  }

  function getProviderDataFromEvent(event) {
    if (!event || !event.target || !event.target.status ||
        (event.target.status !== 200)) {
      return null;
    }

    var parser = new ProviderDataParser(
      event.target.responseText,
      getTtlFromXhr(event.target)
    );

    return parser.parsedData();
  }

  function getTtlFromXhr(xhr) {
    var ttl;
    var cacheControl =
      (xhr.getResponseHeader('Cache-Control') || '')
      .split(/\s*,\s*/)
      .reduce(function(brokenDirectives, keyValuePair) {
        var pair = keyValuePair.split(/\s*=\s*/, 2);
        if (pair[0]) {
          brokenDirectives[pair[0]] = pair[1];
        }

        return brokenDirectives;
      }, {});
    if (cacheControl['s-maxage']) {
      ttl = 1000 * cacheControl['s-maxage'];
    } else if (cacheControl['max-age']) {
      ttl = 1000 * cacheControl['max-age'];
    } else if (xhr.getResponseHeader('Expires')) {
      ttl = new Date(xhr.getResponseHeader('Expires')) - new Date();
    }

    return ttl;
  }

  function didGetProviderData(domainName, data, callback) {
    if (!data) {
      logger.info('No data found for "' + domainName + '" on ' +
                  'well-known URI');
      callback();
      return;
    }

    logger.info('Domain name "' + domainName + '" resolved via well-known ' +
                'URI as "' + data['server'] + '" with TTL ' +
                data['ttl']);

    callback(Service.fromProviderData(domainName, data, logger));
  }

  function init() {
    logger = cal3eLogger.create('extensions.calendar3e.log.sd');
  }

  wellKnownSd.resolveServer = resolveServer;

  init();
}
WellKnownSd.WELL_KNOWN_URI_PATH = '/.well-known/eee';

function Service(domainName, host, port, ttl) {
  var service = this;
  var validUntil;

  function getDomainName() {
    return domainName;
  }

  function getHost() {
    return host || domainName;
  }

  function getPort() {
    return port ||
      Components.classes['@mozilla.org/network/protocol;1?name=eee']
      .createInstance(Components.interfaces.nsIProtocolHandler)
      .defaultPort;
  }

  function getValidUntil() {
    return new Date(validUntil);
  }

  function toString() {
    return getHost() + ':' + getPort();
  }

  function init() {
    validUntil = Date.now() +
      (ttl ||
       Services.prefs.getIntPref('extensions.calendar3e.default_sd_ttl'));
  }

  service.domainName = getDomainName;
  service.host = getHost;
  service.port = getPort;
  service.validUntil = getValidUntil;
  service.toString = toString;

  init();
}
Service.fromProviderData = function fromProviderData(domainName, data,
                                                     logger) {
  var hostPort = (data['server'] || '').split(':', 2);

  if (!data['server']) {
    logger.warn('No server value found for "' + domainName + '"');
  }
  if (data['server'] && !hostPort[0]) {
    logger.warn('No host found for "' + domainName + '"');
  }
  if (data['server'] && !hostPort[1]) {
    logger.warn('No port found for "' + domainName + '"');
  }

  return new Service(domainName, hostPort[0], hostPort[1], data['ttl']);
}

function ProviderDataParser(data, ttl) {
  var providerDataParser = this;
  var parsedData;

  function parse() {
    parsedData = data
      .split(/\s+/)
      .reduce(function(brokenData, keyValuePair) {
        var pair = keyValuePair.split('=', 2);
        if (pair[0]) {
          brokenData[pair[0]] = pair[1];
        }

        return brokenData;
      }, {});
    parsedData['ttl'] = ttl;
  }

  function getParsedData() {
    return parsedData;
  }

  function init() {
    parse();
  }

  providerDataParser.parsedData = getParsedData;

  init();
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

    return store[name] ? store[name] : null;
  }

  function set(name, service) {
    store[name] = service;
    cleanup();

    if (store[name]) {
      logger.info('Cache set for "' + name + '"');
    }
  }

  function cleanup() {
    var name;
    for (name in store) {
      if (!store.hasOwnProperty(name)) {
        continue;
      }

      if (store[name].validUntil() < new Date()) {
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
