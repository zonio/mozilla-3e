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

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

function Method() {
  var method = this;
  var calls;
  var callScheduled;
  var running;
  var wait;

  function create(callable, promise) {
    return function() {
      var callObject = {};

      callObject['function'] = callable;

      if (promise && promise.apply) {
        callObject['promise'] = promise.apply(null, arguments);
      } else if (promise) {
        callObject['promise'] = promise;
      }

      callObject['arguments'] = Array.prototype.slice.apply(arguments);
      if (callObject['promise'] !== undefined) {
        callObject['arguments'].push(callObject['promise']);
      }

      calls.push(callObject);

      if (!wait) {
        scheduleCall();
      }

      return callObject['promise'];
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

  function getPromise(functionArguments) {
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
  method.promise = getPromise;

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
      return callable.apply(queue, arguments);
    });

    return queue;
  }

  function call() {
    return callables[idx].apply(null, arguments);
  }

  function reset() {
    idx = 0;

    return queue;
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
  queue.reset = reset;
  queue.next = getNext;

  init();
}

function Promise() {
  var UNDONE = 0x0;    // 0000
  var FULFILLED = 0x1; // 0001
  var FAILED = 0x2;    // 0010
  var DONE = 0xf;      // 1111

  var promise = this;
  var state;
  var values;
  var handlers;

  function fulfill(resolveValue) {
    done(FULFILLED, arguments);
  }

  function fail(rejectError) {
    done(FAILED, arguments);
  }

  function done(newState, newValues) {
    if (state & DONE) {
      throw new Error('Promise already done');
    }

    state = newState;
    values = newValues;
    callHandlers();
  }

  function then(fulfilledHandler, errorHandler) {
    var promise = new Promise();

    if (fulfilledHandler) {
      handlers[FULFILLED].push({
        'promise': promise,
        'handler': fulfilledHandler,
        'called': false
      });
    }
    if (errorHandler) {
      handlers[FAILED].push({
        'promise': promise,
        'handler': errorHandler,
        'called': false
      });
    }

    if (state & DONE) {
      callHandlers();
    }

    return promise.returnValue();
  }

  function callHandlers() {
    if (!handlers[state]) {
      return;
    }

    handlers[state]
      .filter(function (handler) {
        return !handler['called'];
      })
      .forEach(function (handler) {
        handler['called'] = true;

        var handlerState;
        var handlerValue;
        try {
          handlerValue = handler['handler'].apply(null, values);
          handlerState = FULFILLED;
        } catch (e) {
          handlerValue = e;
          handlerState = FAILED;
        }

        if (handler['promise'] && (handlerState & FULFILLED)) {
          handler['promise'].fulfill(handlerValue);
        } else if (handler['promise'] && (handlerState & FAILED)) {
          handler['promise'].fail(handlerValue);
        }
      });
  }

  function getReturnValue() {
    return {
      then: then
    };
  }

  function init() {
    state = UNDONE;
    values = [];
    handlers = {};
    handlers[FULFILLED] = [];
    handlers[FAILED] = [];
  }

  promise.fulfill = fulfill;
  promise.fail = fail;
  promise.returnValue = getReturnValue;

  init();
}

var cal3eSynchronization = {
  Method: Method,
  Queue: Queue,
  Promise: Promise
};
EXPORTED_SYMBOLS = [
  'cal3eSynchronization'
];
