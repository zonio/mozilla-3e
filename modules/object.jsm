/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2013  Zonio s.r.o.
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

function asXpcom(constructor, classInfoDefinition, categories) {
  if (!classInfoDefinition.interfaces) {
    classInfoDefinition.interfaces = [];
  }
  classInfoDefinition.interfaces.push(Components.interfaces.nsIClassInfo);

  var classInfo = XPCOMUtils.generateCI(classInfoDefinition);
  constructor.classInfo = classInfo;
  constructor.prototype.classInfo = classInfo;
  constructor.prototype.classDescription = classInfo.classDescription;
  constructor.prototype.classID = classInfo.classID;
  constructor.prototype.contractID = classInfo.contractID;
  constructor.prototype.QueryInterface = XPCOMUtils.generateQI(
    classInfo.getInterfaces({})
  );

  if (categories) {
    constructor.prototype._xpcom_categories = [];
    categories.forEach(function(category) {
      constructor.prototype._xpcom_categories.push({ category: category });
    });
  }

  return XPCOMUtils.generateNSGetFactory([constructor]);
}

function asXpcomObserver(callback) {
  return {
    QueryInterface: XPCOMUtils.generateQI([
      Components.interfaces.nsIObserver
    ]),
    observe: callback
  };
}

function exportMethod(object, name, method) {
  if (!method) {
    method = name;
    name = undefined;
  }
  if (!name) {
    name = method.name;
  }
  if (!name) {
    throw TypeError('Method must have a name');
  }

  object[name] = method;
}

function exportProperty(object, name, getter, setter) {
  var descriptor = {};
  descriptor.get = getter;
  if (setter) {
    descriptor.set = setter;
  }
  Object.defineProperty(object, name, descriptor);
}

var cal3eObject = {
  asXpcom: asXpcom,
  asXpcomObserver: asXpcomObserver,
  exportMethod: exportMethod,
  exportProperty: exportProperty
};

EXPORTED_SYMBOLS = [
  'cal3eObject'
];
