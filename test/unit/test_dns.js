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

Components.utils.import("resource://calendar3e/modules/dns.jsm");

function test_successful_dns_resolv() {
  var dns = new cal3eDns();
  var [host, port] = dns.resolveServer("nightly.zonio.net");
  do_check_eq(host, "nightly.zonio.net");
  do_check_eq(port, 4445);
}

function test_default_response() {
  var dns = new cal3eDns();
  var [host, port] = dns.resolveServer("3e.nonexistent");
  do_check_eq(host, "3e.nonexistent");
  do_check_eq(port, 4444);
}

function run_test() {
  test_successful_dns_resolv();
  test_default_response();
}
