/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2011  Zonio s.r.o.
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

Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/model.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');
Components.utils.import('resource://calendar3e/modules/xul.jsm');

function cal3eSubscription(subscriberController, filterController,
                           calendarsController) {
  var controller = this;
  var stringBundle;

  function filterDidChange() {
    calendarsController.applyFilter(filterController.filter());
    loadSharedCalendars();
  }

  function subscribe() {
    dump('[3e] Calendars: ');
    calendarsController.selection().forEach(function selectionDump(calendar) {
      if (selectionDump.notFirst) {
        dump(', ');
      } else {
        selectionDump.notFirst = true;
      }
      dump(calendar);
    });
    dump('\n');

    return true;
  }

  function init() {
    stringBundle = document.getElementById('calendar3e-strings');

    window.addEventListener('unload', finalize, false);

    filterController.addObserver(filterDidChange);
  }

  function finalize() {
    filterController.removeObserver(filterDidChange);

    window.removeEventListener('unload', finalize, false);

    stringBundle = null;
  }

  controller.subscribe = subscribe;

  init();
}

function cal3eSubscriberController() {
  var controller = this;
  var identity;
  var element;
  var identityObserver;
  var observers;

  function addObserver() {
    observers.push(observer);

    return controller;
  }

  function removeObserver() {
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

  function fillElement() {
    cal3eXul.clearMenu(element);

    var identityChanged = false;
    cal3eIdentity.Collection()
      .getEnabled()
      .forEach(function(identity) {
        var item = element.appendItem(
          identity.fullName + ' <' + identity.email + '>',
          identity.key
        );

        if ((identity.key === element.value) || (!element.value)) {
          element.selectedItem = item;
          identityChanged = true;
        }
      });

    if (identityChanged) {
      identityDidChange();
    }
  }

  function identityDidChange() {
    var identities = cal3eIdentity.Collection().
      getEnabled().
      filter(function(identity) {
        return identity.key === element.value;
      });

    identity = identities.length > 0 ? identities[0] : null;
    if (identity) {
      notify();
    }
    dump('[3e] Identity changed: ' + identity.email + '\n');
  }

  function getIdentity() {
    return identity;
  }

  function init() {
    identity = null;

    element = document.getElementById('subscriber-menulist');
    element.addEventListener('change', identityDidChange, false);

    observers = [];

    identityObserver = cal3eIdentity.Observer();
    identityObserver.addObserver(fillElement);
    fillElement();
    window.addEventListener('unload', finalize, false);
  }

  function finalize() {
    identityObserver.destroy();
    identityObserver = null;
    window.removeEventListener('unload', finalize, false);

    observers = null;

    element.removeEventListener('change', identityDidChange, false);
    element = null;

    identity = null;
  }

  controller.identity = getIdentity;

  init();
}

function cal3eCalendarsFilterController() {
  var controller = this;
  var filter;
  var element;
  var observers;

  function filterDidChange() {
    filter = element.value || '';
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

    element = document.getElementById('search-pattern');
    element.addEventListener('change', filterDidChange, false);

    observers = [];

    window.removeEventListener('unload', finalize, false);
  }

  function finalize() {
    window.removeEventListener('unload', finalize, false);

    observers = null;

    element.removeEventListener('change', filterDidChange, false);
    element = null;
  }

  controller.filter = getFilter;
  controller.addObserver = addObserver;
  controller.removeObserver = removeObserver;

  init();
}

function cal3eSharedCalendarsController(subscriberController) {
  var controller = this;
  var element;
  var identity;
  var calendars;
  var owners;
  var fixingSelection;
  var selection;

  function identityDidChange() {
    identity = subscriberController.identity();
    loadSharedCalendars();
  }

  function fillElement() {
    if (!identity) {
      fillElementNoIdentity();
    } else if (calendars.length === 0) {
      fillElementLoading();
    } else {
      fillElementLoaded();
    }
  }

  function fillElementNoIdentity() {
    cal3eXul.clearTree(element);

    //TODO select identity message
  }

  function fillElementLoading() {
    cal3eXul.clearTree(element);

    //TODO loading calendars message
  }

  function fillElementLoaded() {
    cal3eXul.clearTree(element);

    var parentElement;
    owners.forEach(function(owner) {
      parentElement = cal3eXul.addItemToTree(
        element,
        cal3eModel.userLabel(owner),
        null
      );
      calendars[owner['username']].forEach(function(calendar) {
        cal3eXul.addItemToTree(
          parentElement,
          cal3eModel.calendarLabel(calendar),
          'eee://' + calendar['owner'] + '/' + calendar['name']
        );
      });
    });
  }

  function applyFilter(filter) {
    dump('[3e] Filter changed: ' + filter + '\n');
  }

  function selectionDidChange() {
    if (fixingSelection) {
      return;
    }

    fixingSelection = true;
    fixSelection();
    fixingSelection = false;

    selection.splice(0, selection.length);
    selectionForEach(function(idx) {
      selection.push(
        element.view.getCellValue(idx, element.columns.getPrimaryColumn())
      );
    });
  }

  function fixSelection() {
    var invalid = [];
    selectionForEach(function(idx) {
      if (element.view.isContainer(idx)) {
        invalid.push(idx);
      }
    });
    invalid.forEach(function(idx) {
      element.view.selection.toggleSelect(idx);
    });
  }

  function selectionForEach(callback) {
    var i;
    var j;
    var start = { value: 0 };
    var end = { value: 0 };
    for (i = 0; i < element.view.selection.getRangeCount(); i += 1) {
      element.view.selection.getRangeAt(i, start, end);
      for (j = start.value; j <= end.value; j += 1) {
        callback(j);
      }
    }
  }

  function loadSharedCalendars() {
    fillElement();

    cal3eRequest.Client.getInstance()
      .getSharedCalendars(identity, sharedCalendarsDidLoad);
  }

  function sharedCalendarsDidLoad(queue, result) {
    if (!(result instanceof cal3eResponse.Success)) {
      //TODO display error
      return;
    }

    calendars = {};
    owners = [];
    result.forEach(function(calendar) {
      if (!calendars[calendar['owner']]) {
        calendars[calendar['owner']] = [];
      }
    });

    loadCalendarOwners();
  }

  function loadCalendarOwners() {
    var query = '';
    var owner;
    for (owner in calendars) {
      if (!calendars.hasOwnProperty(owner)) {
        continue;
      }

      if (query !== '') {
        query += ' OR ';
      }
      query += "match_username('" + owner + "')";
    }

    cal3eRequest.Client.getInstance()
      .getSharedCalendars(identity, calendarsOwnersDidLoad, query);
  }

  function calendarsOwnersDidLoad(queue, result) {
    if (!(result instanceof cal3eResponse.Success)) {
      //TODO display error
      return;
    }

    results.forEach(function(owner) {
      owners.push(owner);
    });

    fillElement();
  }

  function getSelection() {
    return selection;
  }

  function init() {
    window.addEventListener('unload', finalize, false);

    element = document.getElementById('calendars-tree');
    element.addEventListener('select', selectionDidChange, false);

    fixingSelection = false;
    selection = [];

    identity = null;
    subscriberController.addObserver(identityDidChange);
    identityDidChange();
   }

  function finalize() {
    window.removeEventListener('unload', finalize, false);

    subscriberController.removeObserver(identityDidChange);
    identity = null;

    selection = null;

    element.addEventListener('select', selectionDidChange, false);
    element = null;
  }

  controller.selection = getSelection;
  controller.applyFilter = applyFilter;

  init();
}

cal3eSubscription.open = function cal3eSubscription_open() {
  openDialog(
    'chrome://calendar3e/content/calendarSubscription.xul',
    'cal3eSubscription',
    'chrome,titlebar,modal,resizable'
  );
};

cal3eSubscription.onLoad = function cal3eSubscription_onLoad() {
  var subscriberController = new cal3eSubscriberController();

  cal3eSubscription.controller = new cal3eSubscription(
    subscriberController,
    new cal3eCalendarsFilterController(),
    new cal3eSharedCalendarsController(subscriberController)
  );
  window.addEventListener('unload', cal3eSubscription.onUnload, false);
};
cal3eSubscription.onDialogAccept =
function cal3eSubscription_onDialogAccept() {
  return cal3eSubscription.controller.subscribe();
};
cal3eSubscription.onUnload = function cal3eSubscription_onUnload() {
  window.removeEventListener('unload', cal3eSubscription.onUnload, false);
  delete cal3eSubscription.controller;
};
