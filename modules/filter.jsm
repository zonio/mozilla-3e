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

function cal3eFilterController(window) {
  var controller = this;
  var element;
  var filter;
  var observers;

  function filterDidChange(event) {
    filter = '' + element.value;
    notify();
  }
  
  function addObserver(observer) {
    observers.push(observer);
  
    return controller;
  }
  
  function removeObserver(observer) {
    if (observers.indexOf(observer) < 0) {
      return controller;
    }
  
    observers.splice(observers.indexOf(observer), 1);
  
    return controller;
  }
  
  function notify() {
    observers.forEach(function(observer) {
      try {
        observer(controller);
      } catch (e) {
        //TODO log
      }
    });
  }
  
  function getFilter() {
    return filter;
  }

  function init() {
    filter = '';
    
    element = window.document.getElementById('search-pattern');
    element.addEventListener('input', filterDidChange, false);
    
    observers = [];

    window.addEventListener('unload', finalize, false);
  }

  function finalize() {
    window.removeEventListener('unload', finalize, false);
    
    observers = null;
    
    element.removeEventListener('input', filterDidChange, false);
    element = null;
  }

  controller.filter = getFilter;
  controller.addObserver = addObserver;
  controller.removeObserver = removeObserver;

  init();
}

EXPORTED_SYMBOLS = [
  'cal3eFilterController'
];
