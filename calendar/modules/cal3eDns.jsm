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
    
  }

}

function Resolver() {
  this.os = Components.classes["@mozilla.org/xre/app-info;1"].
    getService(Components.interfaces.nsIXULRuntime).OS;
  this.resolver = null;
    switch (this.os) {
    case 'Darwin':
      this.resolver = new ResolverMac();
      break;
    case 'Linux':
      this.resolver = new ResolverLin();
      break;
    case 'WINNT':
      this.resolver = new ResolverWin();
      break;
    }
}

Resolver.prototype = {

  resolveServer: function Resolver_resolveServer() {
    var answers = this.resolver.
  }

}

function ResolverMac() {
  var ns_c_in = 1;
  var ns_t_txt = 16;
  var ns_s_qd = 0;
  var ns_s_an = 1;

  var anslen = 1024;
  var NS_HFIXEDSZ = 12;
  var NS_RRFIXEDSZ = 10;

  var library = null;
  var res_query = null;

  function loadLibrary() {
    library = ctypes.open("resolv");
    res_query = library.declare(
      'res_query',
      ctypes.default_abi,
      ctypes.int,
      ctypes.char.ptr,
      ctypes.int,
      ctypes.int,
      ctypes.unsigned_char.ptr,
      ctypes.int
    );
  },

  function closeLibrary() {
    library.close();
    res_query = null;
    library = null;
  }

  function readNumberBytes(answer, start, length) {
    var number = 0;
    for (var i = 0; i < length; i++) {
      number += answer[start + i] << ((length - i - 1) * 8);
    }
    return number;
  }

  this.resolve = function ResolverMac_resolve(dname) {
    loadLibrary();
    var answer = "";
    answer.length = anslen;
    var len = res_query(dname, ns_c_in, ns_t_txt, answer, answer.length);
    closeLibrary();

    answer.length = len;
    var qdcount = readNumberBytes(
      answer, 2 * ctypes.uint16_t.size, ctypes.uint16_t.size
    );
    var ancount = readNumberBytes(
      answer, 3 * ctypes.uint16_t.size, ctypes.uint16_t.size
    );

    //TODO implementation

    closeLibrary();
  }

}

ResolverLin = ResolverMac

function ResolverWin() {
}
