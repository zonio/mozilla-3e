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

/**
 * Debugging object with methods heavily inspired by ddump function
 * from session roaming extension.
 */
function dumpObject(obj, name, maxDepth, curDepth) {
  if (curDepth === undefined) {
    curDepth = 0;
  }
  if (maxDepth !== undefined && curDepth > maxDepth) {
    return;
  }

  var i = 0;
  for (let prop in obj) {
    i += 1;
    if (typeof obj[prop] === 'object') {
      if (obj[prop] && (obj[prop].length !== undefined)) {
        dump(
          name + '.' + prop + '=' +
            '[probably array, length ' + obj[prop].length + ']\n'
        );
      } else {
        dump(name + '.' + prop + '=[' + typeof obj[prop] + ']\n');
      }
      dumpObject(obj[prop], name + '.' + prop, maxDepth, curDepth + 1);
    } else if (typeof obj[prop] === 'function') {
      dump(name + '.' + prop + '=[function]\n');
    } else {
      dump(name + '.' + prop + '=' + obj[prop] + '\n');
    }
  }
  if ((i === 0) && (obj === undefined)) {
    dump(name + ' is undefined\n');
  } else if (i === 0) {
    dump(name + ' is empty\n');
  }
}

function dumpStack(frame) {
  if (frame === undefined) {
    frame = Components.stack.caller;
  }
  if (!frame) {
    return;
  }

  dump(frame.filename + ':' + frame.lineNumber + ' ' + frame.name + '()\n');
  dumpStack(frame.caller);
}

var cal3eDebug = {
  dumpObject: dumpObject,
  dumpStack: dumpStack
};
EXPORTED_SYMBOLS = [
  'cal3eDebug'
];
