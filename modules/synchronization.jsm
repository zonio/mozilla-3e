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

function Queue() {
  var queue = this;
  var calls;
  var callScheduled;
  var running;
  var wait;

  function extend(callable, future) {
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
      return queue;
    }

    wait = true;

    return queue;
  }

  function finished() {
    wait = false;
    running = false;
    scheduleCall();

    return queue;
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

  queue.extend = extend;
  queue.waitUntilFinished = waitUntilFinished;
  queue.finished = finished;
  queue.future = getFuture;

  init();
}

var cal3eSynchronization = {
  Queue: Queue
};
EXPORTED_SYMBOLS = [
  'cal3eSynchronization'
];
