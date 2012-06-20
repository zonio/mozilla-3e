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

Components.utils.import("resource://calendar3e/modules/resolv.jsm");

function test_resolver_injection() {
  var resolver = create_resolver_spy();
  var dns = new Resolv.DNS(resolver);

  dns.each_resource(
    "nightly.zonio.net",
    Resolv.DNS.Resource.TXT,
    function() {}
  );

  resolver.check();
}

function create_resolver_spy() {
  return new (function() {
    var called = false;

    this.extract = function() {
      called = true;
      return;
    }

    this.check = function() {
      do_check_true(called);
    }
  });
}

function run_test() {
  test_resolver_injection();
}
