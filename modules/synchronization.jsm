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

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

function Method() {
  var method = this;
  var calls;
  var callScheduled;
  var running;
  var wait;

  function create(callable, future) {
    return function() {
      var callObject = {};

      callObject['function'] = callable;

      if (future && future.apply) {
        callObject['future'] = future.apply(null, arguments);
      } else if (future) {
        callObject['future'] = future;
      }

      callObject['arguments'] = Array.prototype.slice.apply(arguments);
      if (callObject['future'] !== undefined) {
        callObject['arguments'].push(callObject['future']);
      }

      calls.push(callObject);
      scheduleCall();

      return callObject['future'];
    }
  }

  function waitUntilFinished() {
    if (!running) {
      return method;
    }

    wait = true;

    return method;
  }

  function finished() {
    wait = false;
    running = false;
    scheduleCall();

    return method;
  }

  function getFuture(functionArguments) {
    return Array.prototype.slice.apply(functionArguments).pop();
  }

  function call() {
    if (calls.length === 0) {
      return;
    }

    running = true;

    var callObject = calls.shift();
    callObject['function'].apply(null, callObject['arguments']);

    if (!wait) {
      running = false;
      scheduleCall();
    }
  }

  function scheduleCall() {
    if (callScheduled) {
      return;
    }
    callScheduled = true;

    Components.classes['@mozilla.org/timer;1']
      .createInstance(Components.interfaces.nsITimer)
      .init({
        QueryInterface: XPCOMUtils.generateQI([
          Components.interfaces.nsIObserver
        ]),
        observe: function() {
          callScheduled = false;
          call();
        }
      }, 1, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
  }

  function init() {
    calls = [];
    callScheduled = false;
    running = false;
    wait = false;
  }

  method.create = create;
  method.waitUntilFinished = waitUntilFinished;
  method.finished = finished;
  method.future = getFuture;

  init();
}

function Queue() {
  var queue = this;
  var callables;
  var idx;

  function push(callable) {
    var newIdx = callables.length;
    callables.push(function() {
      idx = newIdx + 1;
      return callable.apply({ next: getNext }, arguments);
    });

    return queue;
  }

  function call() {
    return callables[idx].apply(null, arguments);
  }

  function getNext() {
    return callables[idx];
  }

  function init() {
    callables = [];
    idx = 0;
  }

  queue.push = push;
  queue.call = call;
  queue.next = getNext;

  init();
}

var cal3eSynchronization = {
  Method: Method,
  Queue: Queue
};
EXPORTED_SYMBOLS = [
  'cal3eSynchronization'
];
