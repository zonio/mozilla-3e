/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2012  Zonio s.r.o.
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

if (typeof Components !== 'undefined') {
  Components.utils.import('resource://gre/modules/ctypes.jsm');
}

Resolv = {};

Resolv.DNS = function DNS(resolver) {
  var dns = this;

  function getResources(name, typeClass) {
    return resolver.extract(name, typeClass);
  }

  function init() {
    if (!resolver) {
      resolver = Resolv.DNS.Resolver.factory();
    }
  }

  dns.resources = getResources;

  init();
};

Resolv.DNS.Resource = {};

Resolv.DNS.Resource.fromJson = function DNS_Resource_fromJson(json) {
  var data = JSON.parse(json);
  var resource = new Resolv.DNS.Resource[data['type']]();
  resource.apply.apply(resource, data['args']);

  return resource;
};

Resolv.DNS.Resource['TXT'] = function DNS_Resource_TXT(ttl, rdata) {
  var resource = this;

  function getTtl() {
    return ttl;
  }

  function getData() {
    return rdata;
  }

  function toJson() {
    return JSON.stringify({
      'type': 'TXT',
      'args': [ttl, rdata]
    });
  }

  function apply() {
    ttl = arguments[0];
    rdata = arguments[1];

    return resource;
  }

  resource.ttl = getTtl;
  resource.data = getData;
  resource.toJson = toJson;
  resource.apply = apply;
};

Resolv.DNS.Resolver = {};

Resolv.DNS.Resolver.factory = function Resolver_factory(osType, worker) {
  if (!osType) {
    osType = CURRENT_OS_TYPE;
  }

  if (!Resolv.DNS.Resolver[osType]) {
    throw new Error("Unsupported operating system '" + osType + "'.");
  }

  return new Resolv.DNS.Resolver[osType](worker);
};

Resolv.DNS.Resolver.libresolv = function Resolver_libresolv(worker) {
  var resolver = this;

  var ns_c_in = 1;
  var ns_t_txt = 16;
  var ns_s_qd = 0;
  var ns_s_an = 1;

  var anslen = 1024;
  var NS_MAXDNAME = 1025;
  var NS_HFIXEDSZ = 12;
  var NS_QFIXEDSZ = 4;
  var NS_RRFIXEDSZ = 10;

  var libresolv;
  var res_search;
  var dn_expand;
  var dn_skipname;
  var ns_get16;
  var ns_get32;

  function extract(name, typeConstructor) {
    typeConstructor = typeSymbolToConstructor(typeConstructor);

    loadLibrary();

    var resources = [];
    var answer = ctypes.unsigned_char.array(anslen)();
    var length = res_search(
      ctypes.char.array()(name),
      ns_c_in,
      typeConstructorToConstant(typeConstructor),
      answer,
      anslen
    );
    if (length < 0) {
      return returnResources(resources);
    }

    var idx = NS_HFIXEDSZ;

    var questionCount = ns_get16(answer.addressOfElement(4));
    var questionIdx;
    for (questionIdx = 0;
         (questionIdx < questionCount) && (idx < length);
         questionIdx += 1) {
      idx += dn_skipname(answer.addressOfElement(idx),
                         answer.addressOfElement(length)) + NS_QFIXEDSZ;
    }

    var answerCount = ns_get16(answer.addressOfElement(6));
    var answerIdx, answerType, answerClass, answerTtl, rdataLength;
    for (answerIdx = 0;
         (answerIdx < answerCount) && (idx < length);
         answerIdx += 1) {
      idx += dn_skipname(answer.addressOfElement(idx),
                         answer.addressOfElement(length));

      answerType = ns_get16(answer.addressOfElement(idx));
      answerClass = ns_get16(answer.addressOfElement(idx + 2));
      answerTtl = 1 * ns_get32(answer.addressOfElement(idx + 4));
      rdataLength = ns_get16(answer.addressOfElement(idx + 8));

      idx += NS_RRFIXEDSZ;

      if (answerType !== typeConstructorToConstant(typeConstructor)) {
        idx += rdataLength;
        continue;
      }

      resources.push(new typeConstructor(
        answerTtl, readRdata(answer, idx, rdataLength)
      ));
    }

    return returnResources(resources);
  }

  function returnResources(resources) {
    if (worker) {
      worker.postMessage({
        result: resources.map(function(resource) { return resource.toJson() })
      });
    }

    return resources;
  }

  function typeSymbolToConstructor(typeSymbol) {
    return typeof typeSymbol === 'string' ?
      Resolv.DNS.Resource[typeSymbol] :
      typeSymbol;
  }

  function typeConstructorToConstant(typeConstructor) {
    var constant;

    if (typeConstructor === Resolv.DNS.Resource['TXT']) {
      constant = ns_t_txt;
    } else {
      constant = null;
    }

    return constant;
  }

  function readRdata(buffer, start, length) {
    var string = '';
    var idx;
    for (idx = start + 1; idx < (start + length); idx += 1) {
      string += String.fromCharCode(buffer.addressOfElement(idx).contents);
    }

    return string;
  }

  function loadLibrary() {
    libresolv = ctypes.open(ctypes.libraryName('resolv'));
    res_search = libresolv.declare(
      symbolName(libresolv, 'res_search'),
      ctypes.default_abi,
      ctypes.int,
      ctypes.char.ptr,
      ctypes.int,
      ctypes.int,
      ctypes.unsigned_char.ptr,
      ctypes.int
    );
    dn_expand = libresolv.declare(
      symbolName(libresolv, 'dn_expand'),
      ctypes.default_abi,
      ctypes.int,
      ctypes.unsigned_char.ptr,
      ctypes.unsigned_char.ptr,
      ctypes.unsigned_char.ptr,
      ctypes.char.ptr,
      ctypes.int
    );
    dn_skipname = libresolv.declare(
      symbolName(libresolv, 'dn_skipname'),
      ctypes.default_abi,
      ctypes.int,
      ctypes.unsigned_char.ptr,
      ctypes.unsigned_char.ptr
    );
    ns_get16 = libresolv.declare(
      symbolName(libresolv, 'ns_get16'),
      ctypes.default_abi,
      ctypes.unsigned_int,
      ctypes.unsigned_char.ptr
    );
    ns_get32 = libresolv.declare(
      symbolName(libresolv, 'ns_get32'),
      ctypes.default_abi,
      ctypes.unsigned_long,
      ctypes.unsigned_char.ptr
    );
  }

  function symbolName(library, name) {
    var foundPrefix = null;
    var lastException;

    ['', '__', 'res_9_'].forEach(function(prefix) {
      if (foundPrefix !== null) {
        return;
      }

      try {
        library.declare(
          prefix + name,
          ctypes.default_abi,
          ctypes.void_t
        );
        foundPrefix = prefix;
      } catch (e) {
        lastException = e;
      }
    });

    if (foundPrefix === null) {
      throw lastException;
    }

    return foundPrefix + name;
  }

  function closeLibrary() {
    libresolv.close();
    res_search = null;
    dn_expand = null;
    dn_skipname = null;
    ns_get16 = null;
    ns_get32 = null;
    libresolv = null;
  }

  function init() {
    if (worker) {
      worker.postMessage(true);
    }
  }

  resolver.extract = extract;

  init();
};

Resolv.DNS.Resolver['Linux'] = Resolv.DNS.Resolver.libresolv;
Resolv.DNS.Resolver['Darwin'] = Resolv.DNS.Resolver.libresolv;

Resolv.DNS.Resolver.WinDNS = function Resolver_WinDNS(worker) {
  var resolver = this;

  var VOID = ctypes.void_t;
  var PVOID = ctypes.voidptr_t;
  var INT8 = ctypes.char;
  var INT16 = ctypes.short;
  var DWORD = ctypes.unsigned_long;
  var WORD = ctypes.unsigned_short;
  var WCHAR = ctypes.jschar;
  var PWSTR = WCHAR.ptr;
  var LPCWSTR = WCHAR.ptr;
  var PCTSTR = LPCWSTR;
  var DNS_STATUS = ctypes.long;

  var ERROR_SUCCESS;

  var DNS_FREE_TYPE = ctypes.int;
  var DnsFreeFlat = 0;
  var DnsFreeRecordList = 1;
  var DnsFreeParsedMessageFields = 2;

  var DnsAPI;
  var DnsQuery;
  var DnsRecordListFree;

  var DNS_TYPE_TEXT = 16;
  var DNS_QUERY_STANDARD = 0;

  var DNS_TXT_DATA;
  var DNS_RECORD;
  var PDNS_RECORD;

  function extract(name, typeConstructor) {
    typeConstructor = typeSymbolToConstructor(typeConstructor);

    loadLibrary();

    var resources = [];
    var queryResultsSet = PDNS_RECORD();
    var dnsStatus = DnsQuery(
      PCTSTR.targetType.array()(name),
      typeConstructorToConstant(typeConstructor),
      DNS_QUERY_STANDARD,
      null,
      queryResultsSet.address(),
      null
    );
    if (ctypes.Int64.compare(dnsStatus, ERROR_SUCCESS)) {
      return returnResources(resources);
    }

    var result = queryResultsSet.contents;
    while (result) {
      if (result['wType'] !== typeConstructorToConstant(typeConstructor)) {
        result = nextResult(result);
        continue;
      }

      var idx;
      for (idx = 0; idx < result['Data']['dwStringCount']; idx += 1) {
        resources.push(new typeConstructor(
          result['dwTtl'], result['Data']['pStringArray'][idx].readString()
        ));
      }

      result = nextResult(result);
    }

    DnsRecordListFree(queryResultsSet, DnsFreeRecordList);
    closeLibrary();

    return returnResources(resources);
  }

  function returnResources(resources) {
    if (worker) {
      worker.postMessage({
        result: resources.map(function(resource) { return resource.toJson() })
      });
    }

    return resources;
  }

  function typeSymbolToConstructor(typeSymbol) {
    return typeof typeSymbol === 'string' ?
      Resolv.DNS.Resource[typeSymbol] :
      typeSymbol;
  }

  function typeConstructorToConstant(typeConstructor) {
    var constant;

    if (typeConstructor === Resolv.DNS.Resource['TXT']) {
      constant = DNS_TYPE_TEXT;
    } else {
      constant = null;
    }

    return constant;
  }

  function nextResult(result) {
    return !result['pNext'].isNull() ?
      ctypes.cast(result['pNext'], DNS_RECORD.ptr).contents :
      null;
  }

  function loadLibrary() {
    ERROR_SUCCESS = ctypes.Int64(0);

    DnsAPI = ctypes.open(ctypes.libraryName('DnsAPI'));

    DNS_TXT_DATA = ctypes.StructType('DNS_TXT_DATA', [
      {'dwStringCount': DWORD},
      {'pStringArray': PWSTR.array(1)}
    ]);

    DNS_RECORD = ctypes.StructType('DNS_RECORD', [
      {'pNext': PVOID}, //XXX DNS_RECORD.ptr
      {'pName': PWSTR},
      {'wType': WORD},
      {'wDataLength': WORD},
      {'Flags': DWORD}, // union { DWORD DW, DNS_RECORD_FLAGS S }
                        // while DNS_RECORD_FLAGS have the same size
      {'dwTtl': DWORD},
      {'dwReserved': DWORD},
      {'Data': DNS_TXT_DATA}
    ]);
    PDNS_RECORD = ctypes.PointerType(DNS_RECORD);

    DnsQuery = DnsAPI.declare(
      'DnsQuery_W',
      ctypes.winapi_abi,
      DNS_STATUS,
      PCTSTR,
      WORD,
      DWORD,
      PVOID,
      PDNS_RECORD.ptr,
      PVOID.ptr
    );

    DnsRecordListFree = DnsAPI.declare(
      'DnsRecordListFree',
      ctypes.winapi_abi,
      VOID,
      PDNS_RECORD,
      DNS_FREE_TYPE
    );
  }

  function closeLibrary() {
    DnsAPI.close();
    DnsQuery = null;
    DnsRecordListFree = null;
    DNS_RECORD = null;
    PDNS_RECORD = null;
    DNS_TXT_DATA = null;
    DnsAPI = null;
    ERROR_SUCCESS = null;
  }

  function init() {
    function init() {
      worker.postMessage(true);
    }
  }

  resolver.extract = extract;

  init();
};

Resolv.DNS.Resolver['WINNT'] = Resolv.DNS.Resolver.WinDNS;

var CURRENT_OS_TYPE, EXPORTED_SYMBOLS, resolv;
if (typeof Components !== 'undefined') {
  CURRENT_OS_TYPE = Components.classes['@mozilla.org/xre/app-info;1']
    .getService(Components.interfaces.nsIXULRuntime).OS;
  EXPORTED_SYMBOLS = [
    'Resolv'
  ];
}
if (typeof self !== 'undefined') {
  self.addEventListener('message', function(event) {
    switch (event.data.name) {
    case 'create':
      CURRENT_OS_TYPE = event.data.args[0];
      resolv = new Resolv.DNS(Resolv.DNS.Resolver.factory(
        event.data.args[0], self
      ));
      break;
    default:
      resolv[event.data.name].apply(resolv, event.data.args);
      break;
    }
  }, false);
}
