/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2012 - 2013  Zonio s.r.o.
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

Components.utils.import("resource://calendar3e/modules/resolv.jsm");

function test_resolver_injection() {
  var domain = "nightly.zonio.net";
  var type = Resolv.DNS.Resource.TXT;
  var callback = function() {};
  var resolver = create_resolver_spy(domain, type, callback);
  var dns = new Resolv.DNS(resolver);

  dns.each_resource(domain, type, callback);

  resolver.check();
}

function test_library_detection() {
  var resolver = Resolv.DNS.Resolver.find();
  do_check_eq(
    resolver.constructor,
    Resolv.DNS.Resolver[Components.classes["@mozilla.org/xre/app-info;1"].
                        getService(Components.interfaces.nsIXULRuntime).OS]
  );
}

function create_resolver_spy() {
  var callArgs = arguments;

  return new (function() {
    var called = false;

    this.extract = function() {
      called = arguments.length == callArgs.length;
      for (var i = 0; called && (i < arguments.length); i++) {
        called = arguments[i] === callArgs[i];
      }
      return;
    }

    this.check = function() {
      do_check_true(called);
    }
  });
}

function run_test() {
  test_resolver_injection();
  test_library_detection();
}
