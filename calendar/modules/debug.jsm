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
cal3eDebug = {};
cal3eDebug.enable = true;
cal3eDebug.dump = function Debug_dump(text) {
  if (this.enable) {
    dump(text + "\n");
  }
}
cal3eDebug.dumpObject =
function Debug_dumpObject(obj, name, maxDepth, curDepth) {
  if (!this.enable) {
    return;
  }
  if (curDepth == undefined) {
    curDepth = 0;
  }
  if (maxDepth != undefined && curDepth > maxDepth) {
    return;
  }

  var i = 0;
  for (let prop in obj) {
    i++;
    if (typeof(obj[prop]) == "object") {
      if (obj[prop] && obj[prop].length != undefined) {
        this.dump(name + "." + prop + "=[probably array, length "
                  + obj[prop].length + "]");
      } else {
        this.dump(name + "." + prop + "=[" + typeof(obj[prop]) + "]");
      }
      this.dumpObject(obj[prop], name + "." + prop, maxDepth, curDepth+1);
    } else if (typeof(obj[prop]) == "function") {
      this.dump(name + "." + prop + "=[function]");
    } else {
      this.dump(name + "." + prop + "=" + obj[prop]);
    }
  }
  if (!i) {
    this.dump(name + " is empty");
  }
}
cal3eDebug.dumpStack = function Debug_dumpStack() {
  if (!this.enable) {
    return;
  }

  for (var frame = Components.stack; frame; frame = frame.caller)
    dump(frame.filename + ":" + frame.lineNumber + "\n");
};

EXPORTED_SYMBOLS = [
  'cal3eDebug'
];
