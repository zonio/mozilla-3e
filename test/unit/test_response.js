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

Components.utils.import("resource://calendar3e/modules/response.jsm");

function test_response_success() {
  var xmlRpc = create_xml_rpc_success_response();
  var eee = cal3eResponse.factory(xmlRpc);

  do_check_true(eee.isSuccess);
  do_check_false(eee.isEeeError);
  do_check_false(eee.isTransportError);
  do_check_eq(xmlRpc, eee.data);
}

function test_response_eee_error() {
  var xmlRpc = create_xml_rpc_fault_response();
  var eee = cal3eResponse.factory(xmlRpc);

  do_check_false(eee.isSuccess);
  do_check_true(eee.isEeeError);
  do_check_false(eee.isTransportError);
  do_check_true(null === eee.data);
  do_check_eq(cal3eResponse.errors.AUTH_FAILED, eee.errorCode);
}

function test_response_transport_error() {
  var xmlRpc = create_xml_rpc_error_response();
  var eee = cal3eResponse.factory(xmlRpc);

  do_check_false(eee.isSuccess);
  do_check_false(eee.isEeeError);
  do_check_true(eee.isTransportError);
  do_check_true(null === eee.data);
}

function create_xml_rpc_success_response() {
  var value = Components.classes[
    "@mozilla.org/supports-PRBool;1"
  ].createInstance(Components.interfaces.nsISupportsPRBool);
  value.data = true;

  return value;
}

function create_xml_rpc_fault_response() {
  var fault = Components.classes[
    "@mozilla.org/xml-rpc/fault;1"
  ].createInstance(Components.interfaces.nsIXmlRpcFault);
  fault.init(2, "./server.xdl:1181:Authentication failed.")

  return fault;
}

function create_xml_rpc_error_response() {
  return null;
}

function run_test() {
  test_response_success();
  test_response_eee_error();
  test_response_transport_error();
}
