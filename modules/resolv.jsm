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
  var resolver;

  function getResources(name, typeclass) {
    return resolver.extract(name, typeclass);
  }

  function init() {
    resolver = Resolv.DNS.Resolver.find();
  }

  dns.resources = getResources;

  init();
}

Resolv.DNS.Resource = {}

Resolv.DNS.Resource.TXT =
function DNS_Resource_TXT(ttl) {
  var resource = this;
  var constructorArguments = Array.prototype.slice.apply(arguments);

  function getTtl() {
    return ttl;
  }

  function getStrings() {
    return constructorArguments.slice(1);
  }

  function data() {
    return strings[0];
  }

  resource.ttl = getTtl;
  resource.strings = getStrings;
  resource.data = data;
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
      'dn_skipname',
      ctypes.default_abi,
      ctypes.int,
      ctypes.unsigned_char.ptr,
      ctypes.unsigned_char.ptr
    );
    ns_get16 = libresolv.declare(
      'ns_get16',
      ctypes.default_abi,
      ctypes.unsigned_int,
      ctypes.unsigned_char.ptr
    );
    ns_get32 = libresolv.declare(
      'ns_get32',
      ctypes.default_abi,
      ctypes.unsigned_long,
      ctypes.unsigned_char.ptr
    );
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

  function typeclassToConstant(typeclass) {
    var constants;
    if (typeclass === Resolv.DNS.Resource.TXT) {
      constant = ns_t_txt;
    } else {
      constant = null;
    }

    return constant;
  }

  function readString(src, length) {
  }

  function extract(name, typeclass, callback) {
    loadLibrary();

    var dname = ctypes.char.array(name.length)(name);
    var answer = ctypes.unsigned_char.array(anslen)();
    var questionType = typeclassToConstant(typeclass);
    var len = res_query(
      dname, ns_c_in, questionType, answer.addressOfElement(0), anslen
    );

    var qdcount = ns_get16(answer.addressOfElement(0) + 4);
    var ancount = ns_get16(answer.addressOfElement(0) + 6);

    var eom = answer.addressOfElement(0);
    eom += len;
    var src = answer.addressOfElement(0);
    src += NS_HFIXEDSZ;

    while (qdcount-- && (src < eom)) {
      src += dn_skipname(src, eom) + QFIXEDSZ;
    }

    var resources = [];
    var answerType, answerClass, answerTtl, rdataLength;
    while (ancount-- && (src < eom)) {
      src += dn_skipname(src, eom);
      answerType = ns_get16(src + 0);
      answerClass = ns_get16(src + 1);
      answerTtl = ns_get32(src + 2);
      rdataLength = ns_get16(src + 8);
      src += NS_RRFIXEDSZ;

      if (answerType.value != questionType) {
        src += rdataLength;
        continue;
      }

      resources.push(new typeclass(answerTtl, readString(src, rdataLength)));
    }

    closeLibrary();
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
