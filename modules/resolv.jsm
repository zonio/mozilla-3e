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

Components.utils.import('resource://gre/modules/ctypes.jsm');

Resolv = {};

Resolv.DNS = function DNS(resolver) {
  var dns = this;

  function getResources(name, typeClass) {
    return resolver.extract(name, typeClass);
  }

  function init() {
    if (!resolver) {
      resolver = Resolv.DNS.Resolver.find();
    }
  }

  dns.resources = getResources;

  init();
}

Resolv.DNS.Resource = {}

Resolv.DNS.Resource.TXT =
function DNS_Resource_TXT(ttl, rdata) {
  var resource = this;

  function getTtl() {
    return ttl;
  }

  function getData() {
    return rdata;
  }

  resource.ttl = getTtl;
  resource.data = getData;
}

Resolv.DNS.Resolver = {}

Resolv.DNS.Resolver.find = function Resolver_find() {
  var os = Components.classes['@mozilla.org/xre/app-info;1']
    .getService(Components.interfaces.nsIXULRuntime).OS;

  if (!Resolv.DNS.Resolver[os]) {
    throw new Error("Unsupported operating system '" + os + "'.");
  }

  return new Resolv.DNS.Resolver[os]();
}

Resolv.DNS.Resolver.libresolv = function Resolver_libresolv() {
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
  var res_query;
  var dn_expand;
  var dn_skipname;
  var ns_get16;
  var ns_get32;

  function loadLibrary() {
    libresolv = ctypes.open(ctypes.libraryName('resolv'));
    res_query = libresolv.declare(
      'res_query',
      ctypes.default_abi,
      ctypes.int,
      ctypes.char.ptr,
      ctypes.int,
      ctypes.int,
      ctypes.unsigned_char.ptr,
      ctypes.int
    );
    dn_expand = libresolv.declare(
      'dn_expand',
      ctypes.default_abi,
      ctypes.int,
      ctypes.unsigned_char.ptr,
      ctypes.unsigned_char.ptr,
      ctypes.unsigned_char.ptr,
      ctypes.char.ptr,
      ctypes.int
    );
    dn_skipname = libresolv.declare(
      symbolName('dn_skipname'),
      ctypes.default_abi,
      ctypes.int,
      ctypes.unsigned_char.ptr,
      ctypes.unsigned_char.ptr
    );
    ns_get16 = libresolv.declare(
      symbolName('ns_get16'),
      ctypes.default_abi,
      ctypes.unsigned_int,
      ctypes.unsigned_char.ptr
    );
    ns_get32 = libresolv.declare(
      symbolName('ns_get32'),
      ctypes.default_abi,
      ctypes.unsigned_long,
      ctypes.unsigned_char.ptr
    );
  }

  function symbolName(name) {
    var prefix = 'Darwin' === Components.classes['@mozilla.org/xre/app-info;1']
      .getService(Components.interfaces.nsIXULRuntime).OS ?
      'res_9_' :
      '';

    return prefix + name;
  }

  function closeLibrary() {
    libresolv.close();
    res_query = null;
    dn_expand = null;
    dn_skipname = null;
    ns_get16 = null;
    ns_get32 = null;
    libresolv = null;
  }

  function typeClassToConstant(typeClass) {
    var constants;
    if (typeClass === Resolv.DNS.Resource.TXT) {
      constant = ns_t_txt;
    } else {
      constant = null;
    }

    return constant;
  }

  function getCString(string) {
    return string + String.fromCharCode(0);
  }

  function readRdata(buffer, start, length) {
    var string = '';
    var idx;
    for (idx = start + 1; idx < (start + length); idx += 1) {
      string += String.fromCharCode(buffer.addressOfElement(idx).contents);
    }

    return string;
  }

  function extract(name, typeClass) {
    loadLibrary();

    var resources = [];
    var answer = ctypes.unsigned_char.array(anslen)();
    var length = res_query(
      getCString(name), ns_c_in, typeClassToConstant(typeClass), answer, anslen
    );
    if (length < 0) {
      return resources;
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
      answerClass = ns_get16(answer.addressOfElement(idx + 1));
      answerTtl = ns_get32(answer.addressOfElement(idx + 2));
      rdataLength = ns_get16(answer.addressOfElement(idx + 8));
      idx += NS_RRFIXEDSZ;

      if (answerType !== typeClassToConstant(typeClass)) {
        idx += rdataLength;
        continue;
      }

      resources.push(new typeClass(
        answerTtl, readRdata(answer, idx, rdataLength)
      ));
    }

    closeLibrary();

    return resources;
  }

  resolver.extract = extract;
}

Resolv.DNS.Resolver['Linux'] = Resolv.DNS.Resolver.libresolv;
Resolv.DNS.Resolver['Darwin'] = Resolv.DNS.Resolver.libresolv;

Resolv.DNS.Resolver.WinDns = function Resolver_WinDns() {
}

Resolv.DNS.Resolver['WINNT'] = Resolv.DNS.Resolver.WinDNS;

EXPORTED_SYMBOLS = [
  'Resolv'
];
