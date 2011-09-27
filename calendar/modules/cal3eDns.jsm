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

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/ctypes.jsm");

EXPORTED_SYMBOLS = [
  'cal3eDns'
];

function cal3eDns() {
}

cal3eDns.prototype = {

  resolveServer: function cal3eDns_resolveServer(domainName) {
    var foundEeeRecord = [null, null];
    var dns = new Resolv.DNS();
    var eeeMatch = /\beee server=(\S+)(:(\d{1,4}))?/;
    dns.each_resource(
      domainName, Resolv.DNS.Resource.TXT, function (resource) {
        if (foundEeeRecord[0])
        let match = eeeMatch.exec(resource.data());
        if (!match) return;
        foundEeeRecord[0] = match[1];
        foundEeeRecord[1] = match[3];
      }
    );
  }

}

Resolv = {};

Resolv.DNS = function DNS() {
  var os = Components.classes["@mozilla.org/xre/app-info;1"].
    getService(Components.interfaces.nsIXULRuntime).OS;
  var resolver;
  switch (this.os) {
  case 'Darwin':
    resolver = new ResolverMac();
    break;
  case 'Linux':
    resolver = new ResolverLin();
    break;
  case 'WINNT':
    resolver = new ResolverWin();
    break;
  default:
    resolver = null;
    break;
  }

  this.each_resource = function DNS_each_resource(name, typeclass, callback) {
    resolver.extract(name, typeclass, callback);
  }

  this.getresource = function DNS_getresource(name, typeclass) {
    var found_resource;
    this.each_resource(name, typeclass, function (resource) {
      found_resource = resource;
    });
    if (!resources) {
      throw new Error("Resource for " + name + " not found.");
    }

    return found_resource;
  }

  this.getresources = function DNS_getresources(name, typeclass) {
    var resources = [];
    this.each_resource(name, typeclass, function (resource) {
      resources.push(resource);
    });

    return resources;
  }
}

Resolv.DNS.Resource = {}

Resolv.DNS.Resource.TXT =
function DNS_Resource_TXT(ttl) {
  var instance_ttl = ttl;
  var instance_strings = Array.prototype.slice.call(arguments, 1);

  get ttl() {
    return instance_ttl;
  }

  get strings() {
    return instance_strings;
  }

  this.data = function DNS_Resource_TXT_data() {
    return instance_strings[0];
  }

}

function ResolverMac() {
  var ns_c_in = 1;
  var ns_t_txt = 16;
  var ns_s_qd = 0;
  var ns_s_an = 1;

  var anslen = 1024;
  var NS_MAXDNAME = 1025;
  var NS_HFIXEDSZ = 12;
  var NS_QFIXEDSZ = 4;
  var NS_RRFIXEDSZ = 10;

  var libresolv = null;
  var res_query = null;
  var dn_expand = null;
  var dn_skipname = null;
  var ns_get16 = null;
  var ns_get32 = null;

  function loadLibrary() {
    libresolv = ctypes.open("resolv");
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
  },

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
    if (typeclass instanceof Resolv.DNS.Resource.TXT) {
      constant = ns_t_txt;
    } else {
      constant = null;
    }

    return constant;
  }

  function readString(src, length) {
  }

  this.extract = function ResolverMac_resolve(name, typeclass, callback) {
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
      len = dn_skipname(src, eom);
      src += len + QFIXEDSZ;
    }

    var answerType, answerClass, answerTtl, rdataLength;
    var resource, returnValue;
    while (ancount-- && (src < eom)) {
      len = dn_skipname(src, eom);
      src += len;
      answerType = ns_get16(src + 0);
      answerClass = ns_get16(src + 1);
      answerTtl = ns_get32(src + 2);
      rdataLength = ns_get16(src + 8);
      src += NS_RRFIXEDSZ;

      if (answerType.value != questionType) {
        src += rdataLength;
        continue;
      }

      resource = new typecast(answerTtl, readString(src, rdataLength));
      returnValue = callback.call(this, resource);
      if (false === returnValue) break;
    }

    closeLibrary();
  }

}

ResolverLin = ResolverMac

function ResolverWin() {
}
