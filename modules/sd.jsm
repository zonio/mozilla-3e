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

  function resolveServer(domainName) {
    logger.info('Resolving domain name "' + domainName + '"');

    var promise = new cal3eSynchronization.Promise();

    var service;
    if (service = cache.get(domainName)) {
      getPassServiceCallback(queue, domainName, promise)(service);
      return promise.returnValue();
    }

    var queue = new cal3eSynchronization.Queue();
    queue
      .push(getPassOrTryNextProviderCallback(queue, domainName, promise))
      .push(getTryToGetServiceCallback(queue, domainName, promise))
      .push(getCacheServiceCallback(queue, domainName, promise))
      .push(getPassServiceCallback(queue, domainName, promise));
    queue.call(service);

    return promise.returnValue();
  }

  function getPassOrTryNextProviderCallback(queue, domainName, promise) {
    return function passOrTryNextProviderCallback(service, idx) {
      function nextTry() {
        idx += 1;
        if (providers[idx]) {
          passOrTryNextProviderCallback(null, idx);
        } else {
          queue.next()();
        }
      }

      if (!idx) {
        idx = 0;
      }

      var timedout = false;
      var promisedService =
        providers[idx].resolveServer(domainName).then(function(service) {
          if (timedout) {
            return;
          }

          idx += 1;
          queue.next()(service);
        }, function() {
          if (timedout) {
            return;
          }

          nextTry();
        });
      providerFailed(promisedService).then(function() {
        timedout = true;
        nextTry();
      });
    };
  }

  function getTryToGetServiceCallback(queue, domainName, promise) {
    var tryCount = 0;

    return function tryToGetServiceCallback(service) {
      if (!service &&
          (tryCount <
           Services.prefs.getIntPref('extensions.calendar3e.sd_try_limit'))) {
        logger.info('Try #' + tryCount + ' to get service parameters for ' +
                    '"' + domainName + '" failed');

        tryCount += 1;
        queue.reset();
        getDeferredNextCall(queue)();
        return;
      }

      if (!service) {
        service = Service.notFound();
      }

      queue.next()(service);
    };
  }

  function getCacheServiceCallback(queue, domainName, promise) {
    return function cacheServiceCallback(service) {
      cache.set(domainName, service);

      queue.next()(service);
    };
  }

  function getPassServiceCallback(queue, domainName, promise) {
    return function passServiceCallback(service) {
      if (service.isResolved()) {
        logger.info('Passing back service parameters for ' +
                    '"' + domainName + '" as "' + service + '"');
        promise.fulfill(service);
      } else {
        logger.info('No service discovered on "' + domainName + '"');
        promise.fail();
      }
    };
  }

  function providerFailed(promisedService) {
    var timer = Components.classes['@mozilla.org/timer;1']
      .createInstance(Components.interfaces.nsITimer);
    var promise = new cal3eSynchronization.Promise();

    function resolved() {
      timer.cancel();
      promise.fail();
    }

    promisedService.then(resolved, resolved);

    timer.initWithCallback(
      { notify: function() {
        logger.info('Service not resolved before timeout');
        promise.fulfill();
      } },
      Services.prefs.getIntPref(
        'extensions.calendar3e.sd_resolve_timeout'),
      Components.interfaces.nsITimer.TYPE_ONE_SHOT
    );

    return promise.returnValue();
  }

  function getDeferredNextCall(queue) {
    // Timer must be reused otherwise is might be activated for some
    // strange reason
    if (!getDeferredNextCall.timer) {
      getDeferredNextCall.timer = Components.classes['@mozilla.org/timer;1']
        .createInstance(Components.interfaces.nsITimer);
    }

    return function() {
      getDeferredNextCall.timer.initWithCallback(
        { notify: function() { queue.next()() }},
        Services.prefs.getIntPref('extensions.calendar3e.sd_deferred_interval'),
        Components.interfaces.nsITimer.TYPE_ONE_SHOT
      );
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

function DnsSd(resolvConstructor) {
  var dnsSd = this;
  var logger;

  function resolveServer(domainName) {
    logger.info('Resolving domain name "' + domainName + '" using DNS');

    var promise = new cal3eSynchronization.Promise();
    new resolvConstructor()
      .resources(domainName, 'TXT')
      .then(function(jsonResources) {
        logger.info('Data from resolver for "' + domainName + '" received ' +
                    'from DNS');

        didGetProviderData(
          domainName,
          getProviderData(jsonResources),
          promise
        );
      });

    return promise.returnValue();
  }

  function getProviderData(jsonResources) {
    var dnsResources = jsonResources
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

  function didGetProviderData(domainName, data, promise) {
    if (!data) {
      logger.info('No DNS records found for "' + domainName + '"');
      promise.fail();
      return;
    }

    logger.info('Domain name "' + domainName + '" resolved via DNS as "' +
                data['server'] + '" with TTL ' +
                data['ttl']);

    promise.fulfill(Service.fromProviderData(domainName, data, logger));
  }

  function init() {
    logger = cal3eLogger.create('extensions.calendar3e.log.sd');

    if (!resolvConstructor) {
      resolvConstructor = Resolv.DNS;
    }
  }

  dnsSd.resolveServer = resolveServer;

  init();
}

function WellKnownSd() {
  var wellKnownSd = this;
  var logger;

  function resolveServer(domainName) {
    logger.info('Resolving domain name "' + domainName + '" using ' +
                'well-known URI');

    var promise = new cal3eSynchronization.Promise();
    doXhrSend({
      'domainName': domainName,
      'promise': promise
    });

    return promise.returnValue();
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
      context['promise']
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

  function didGetProviderData(domainName, data, promise) {
    if (!data) {
      logger.info('No data found for "' + domainName + '" on ' +
                  'well-known URI');
      promise.fail();
      return;
    }

    logger.info('Domain name "' + domainName + '" resolved via well-known ' +
                'URI as "' + data['server'] + '" with TTL ' +
                data['ttl']);

    promise.fulfill(Service.fromProviderData(domainName, data, logger));
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
    return host;
  }

  function getPort() {
    return port;
  }

  function isResolved() {
    return getHost() && getPort();
  }

  function getValidUntil() {
    return new Date(validUntil);
  }

  function toString() {
    var string = '';
    if (getHost()) {
      string += getHost();
    }
    if (getPort()) {
      string += ':' + getPort();
    }

    return string;
  }

  function init() {
    validUntil = Date.now() + ttl;
  }

  service.domainName = getDomainName;
  service.host = getHost;
  service.port = getPort;
  service.isResolved = isResolved;
  service.validUntil = getValidUntil;
  service.toString = toString;

  init();
}
Service.fromProviderData = function fromProviderData(domainName, data,
                                                     logger) {
  var hostPort = (data['server'] || '').split(':', 2);
  var defaultPort =
    Components.classes['@mozilla.org/network/protocol;1?name=eee']
    .createInstance(Components.interfaces.nsIProtocolHandler)
    .defaultPort;
  var defaultTtl = Services.prefs.getIntPref(
    'extensions.calendar3e.default_sd_ttl'
  );

  if (!data['server']) {
    logger.warn('No server value found for "' + domainName + '"');
  }
  if (data['server'] && !hostPort[0]) {
    logger.warn('No host found for "' + domainName + '"');
  }
  if (data['server'] && !hostPort[1]) {
    logger.warn('No port found for "' + domainName + '"');
  }

  return new Service(
    domainName,
    hostPort[0] || domainName,
    hostPort[1] || defaultPort,
    data['ttl'] || defaultTtl
  );
}
Service.notFound = function(domainName) {
  return new Service(domainName, null, null, Services.prefs.getIntPref(
    'extensions.calendar3e.default_sd_ttl'
  ));
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
