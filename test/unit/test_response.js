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

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://calendar3e/modules/response.jsm");

function test_response_success() {
  var methodQueue = create_success_method_queue();
  var response = cal3eResponse.fromMethodQueue(methodQueue);

  do_check_true(response instanceof cal3eResponse.Success);
  do_check_eq(methodQueue.lastResponse, eee.data);
}

function test_response_eee_error() {
  var methodQueue = create_fault_method_queue();
  var response = cal3eResponse.fromMethodQueue(methodQueue);

  do_check_true(response instanceof cal3eResponse.EeeError);
  do_check_true(null === eee.data);
  do_check_eq(cal3eResponse.eeeErrors.AUTH_FAILED, eee.errorCode);
}

function test_response_transport_error() {
  var methodQueue = create_transport_error_method_queue();
  var response = cal3eResponse.fromMethodQueue(methodQueue);

  do_check_true(response instanceof cal3eResponse.TransportError);
  do_check_true(null === eee.data);
  do_check_eq(Components.results.NS_ERROR_FAILURE, eee.errorCode);
}

function test_response_user_error() {
  var response = new cal3eResponse.UserError(
    cal3eResponse.userErrors.NO_PASSWORD
  );

  do_check_true(null === eee.data);
  do_check_eq(cal3eResponse.userErrors.NO_PASSWORD, eee.errorCode);
}

function create_success_method_queue() {
  return Object.create({
    "QueryInterface": XPCOMUtils.generateQI([
      Components.interfaces.calEeeIMethodQueue
    ]),
    "enqueueMethod": function() { },
    "execute": function() { },
    "cancel": function(status) { }
  }, {
    "serverUri": {
      "value": Services.io.newURI(
        "https://alfa.zonio.net:4444/RPC2", null, null
      ),
      "writable": true
    },
    "lastResponse": {
      "value": create_xml_rpc_success_response()
    },
    "isFault": {
      "value": false
    },
    "id": {
      "value": "https://alfa.zonio.net:4444/RPC2:ESClient.authenticate"
    },
    "isPending": {
      "value": false
    },
    "status": {
      "value": Components.results.NS_OK
    }
  });
}

function create_xml_rpc_success_response() {
  var value = Components.classes[
    "@mozilla.org/supports-PRBool;1"
  ].createInstance(Components.interfaces.nsISupportsPRBool);
  value.data = true;

  return value;
}

function create_fault_method_queue() {
  return Object.create({
    "QueryInterface": XPCOMUtils.generateQI([
      Components.interfaces.calEeeIMethodQueue
    ]),
    "enqueueMethod": function() { },
    "execute": function() { },
    "cancel": function(status) { }
  }, {
    "serverUri": {
      "value": Services.io.newURI(
        "https://alfa.zonio.net:4444/RPC2", null, null
      ),
      "writable": true
    },
    "lastResponse": {
      "value": create_xml_rpc_fault_response()
    },
    "isFault": {
      "value": true
    },
    "id": {
      "value": "https://alfa.zonio.net:4444/RPC2:ESClient.authenticate"
    },
    "isPending": {
      "value": false
    },
    "status": {
      "value": Components.results.NS_OK
    }
  });
}

function create_xml_rpc_fault_response() {
  var fault = Components.classes[
    "@mozilla.org/xml-rpc/fault;1"
  ].createInstance(Components.interfaces.nsIXmlRpcFault);
  fault.init(2, "./server.xdl:1181:Authentication failed.")

  return fault;
}

function create_transport_error_method_queue() {
  return Object.create({
    "QueryInterface": XPCOMUtils.generateQI([
      Components.interfaces.calEeeIMethodQueue
    ]),
    "enqueueMethod": function() { },
    "execute": function() { },
    "cancel": function(status) { }
  }, {
    "serverUri": {
      "value": Services.io.newURI(
        "https://alfa.zonio.net:4444/RPC2", null, null
      ),
      "writable": true
    },
    "lastResponse": {
      "value": null
    },
    "isFault": {
      "value": false
    },
    "id": {
      "value": "https://alfa.zonio.net:4444/RPC2:ESClient.authenticate"
    },
    "isPending": {
      "value": false
    },
    "status": {
      "value": Components.results.NS_ERROR_FAILURE
    }
  });
}

function run_test() {
  test_response_success();
  test_response_eee_error();
  test_response_transport_error();
}
