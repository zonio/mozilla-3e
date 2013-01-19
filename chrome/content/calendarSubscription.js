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

Components.utils.import('resource://calendar/modules/calUtils.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/model.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/response.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');
Components.utils.import('resource://calendar3e/modules/xul.jsm');

function cal3eSubscription(subscriberController, filterController,
                           calendarsController, subscriptionDelegate,
                           dialogStateDelegate) {
  var controller = this;
  var stringBundle;

  function identityDidChange() {
    calendarsController.setIdentity(subscriberController.identity());
  }

  function filterDidChange() {
    calendarsController.setFilter(filterController.filter());
  }

  function calendarsDidChange() {
    dialogStateDelegate.update(calendarsController);
  }

  function subscribe() {
    document.getElementById('notifications').removeAllNotifications();
    calendarsController.freezSelection();
    subscriptionDelegate.subscribe(
      subscriberController.identity(),
      calendarsController.selection(),
      didSubscribe
    );

    return false;
  }

  function didSubscribe(errors) {
    if (errors.length > 0) {
      didError();
      return;
    }

    window.close();
  }

  function didError() {
    calendarsController.unfreezSelection();

    document.getElementById('notifications').appendNotification(
      document.getElementById('calendar3e-strings').getString(
        'cal3eCalendarSubscribe.errors.subscribe'
      ),
      0,
      null,
      document.getElementById('notifications').PRIORITY_WARNING_MEDIUM,
      null
    );
  }

  function init() {
    stringBundle = document.getElementById('calendar3e-strings');

    window.addEventListener('unload', finalize, false);

    subscriberController.addObserver(identityDidChange);
    identityDidChange();
    filterController.addObserver(filterDidChange);
    filterDidChange();
    calendarsController.addObserver(calendarsDidChange);
    calendarsDidChange();
  }

  function finalize() {
    subscriberController.removeObserver(identityDidChange);
    filterController.removeObserver(filterDidChange);

    window.removeEventListener('unload', finalize, false);

    stringBundle = null;
  }

  controller.subscribe = subscribe;

  init();
}

function cal3eSubscriptionDelegate() {
  var subscriptionDelegate = this;

  function subscribe(identity, selection, callback) {
    var errors = [];
    var processed = 0;

    function onNext(error) {
      processed += 1;
      if (error) {
        errors.push(error);
      }

      if (selection.length === processed) {
        callback(errors);
      }
    }

    selection.forEach(function(element) {
      subscribeCalendar(identity, element, onNext);
    });
  }

  function subscribeCalendar(identity, element, onNext) {
    function didSubscribeCalendar(result) {
      if (!(result instanceof cal3eResponse.Success)) {
        onNext(result);
        return;
      }

      Components.classes['@mozilla.org/calendar/manager;1']
        .getService(Components.interfaces.calICalendarManager)
        .registerCalendar(calendar);

      calendar.setProperty('imip.identity.key', identity.key);
      calendar.name = cal3eModel.fullCalendarLabel(
        element.owner, element.calendar
      );
      calendar.readOnly = element.calendar['perm'] === 'read';
      calendar.setProperty(
        'color', cal3eModel.attribute(element.calendar, 'color')
      );

      onNext();
    }

    var calendar = Components.classes['@mozilla.org/calendar/manager;1']
      .getService(Components.interfaces.calICalendarManager)
      .createCalendar('eee', cal3eModel.buildUri({
        'protocol': 'eee',
        'user': identity.email,
        'owner': element.owner['username'],
        'name': element.calendar['name']
      }));

    cal3eRequest.Client.getInstance().subscribeCalendar(
      identity,
      didSubscribeCalendar,
      calendar
    );
  }

  subscriptionDelegate.subscribe = subscribe;
}

function cal3eDialogStateDelegate() {
  var dialogStateDelegate = this;
  var subscribeButton;

  function update(calendarsController) {
    subscribeButton.disabled = !calendarsController.hasSelection();
  }

  function init() {
    subscribeButton = document.getElementById('calendar3e-subscription-dialog')
      .getButton('accept');
  }

  dialogStateDelegate.update = update;

  init();
}

function cal3eSubscriberController() {
  var controller = this;
  var identity;
  var element;
  var identityObserver;
  var observers;

  function addObserver(observer) {
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
    clearElement();
    if (cal3eIdentity.Collection().getEnabled().hasOnlyOne()) {
      fillElementWithOne();
    } else {
      fillElementWithMany();
    }
    identityDidChange();
  }

  function fillElementWithOne() {
    element.appendChild(document.createElementNS(
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      'label'
    ));
    element.lastChild.flex = 1;

    cal3eIdentity.Collection()
      .getEnabled()
      .forEach(function(identity) {
        element.lastChild.value =
          identity.fullName + ' <' + identity.email + '>';
      });
  }

  function fillElementWithMany() {
    element.appendChild(document.createElementNS(
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      'menulist'
    ));
    element.lastChild.id = 'subscriber-menulist';
    element.lastChild.flex = 1;
    var firstItem;

    cal3eIdentity.Collection()
      .getEnabled()
      .forEach(function(identity) {
        var item = element.lastChild.appendItem(
          identity.fullName + ' <' + identity.email + '>',
          identity.key
        );

        if (!firstItem) {
          firstItem = item;
        }
      });

    element.lastChild.selectedItem = firstItem;
    element.lastChild.addEventListener('command', identityDidChange, false);
  }

  function clearElement() {
    if (hasManyIdentities()) {
      element.lastElementChild.removeEventListener(
        'command', identityDidChange, false
      );
    }
    if (hasOneIdentity() || hasManyIdentities()) {
      element.lastElementChild.parentNode.removeChild(
        element.lastElementChild
      );
    }
  }

  function hasOneIdentity() {
    return element.lastChild &&
      (element.lastChild.nodeType ===
       Components.interfaces.nsIDOMNode.ELEMENT_NODE) &&
      (element.lastChild !== element.firstElementChild) &&
      (element.lastChild.tagName === 'label');
  }

  function hasManyIdentities() {
    return element.lastChild &&
      (element.lastChild.nodeType ===
       Components.interfaces.nsIDOMNode.ELEMENT_NODE) &&
      (element.lastChild.tagName === 'menulist');
  }

  function identityDidChange() {
    var identities = cal3eIdentity.Collection().getEnabled();
    if (hasManyIdentities()) {
      identities = identities.filter(function(identity) {
        return identity.key === element.lastChild.value;
      });
    }

    identity = identities.length > 0 ? identities[0] : null;
    if (identity) {
      notify();
    }
  }

  function getIdentity() {
    return identity;
  }

  function init() {
    identity = null;

    element = document.getElementById('calendar3e-subscriber-row');

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

    clearElement();
    element = null;

    identity = null;
  }

  controller.identity = getIdentity;
  controller.addObserver = addObserver;
  controller.removeObserver = removeObserver;

  init();
}

function cal3eCalendarsFilterController() {
  var controller = this;
  var filter;
  var element;
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

    element = document.getElementById('search-pattern');
    element.addEventListener('input', filterDidChange, false);

    observers = [];

    window.removeEventListener('unload', finalize, false);
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

function cal3eSharedCalendarsController() {
  var controller = this;
  var element;
  var identity;
  var filter;
  var calendars;
  var owners;
  var isLoaded;
  var fixingSelection;
  var selection;
  var observers;

  function addObserver(observer) {
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

  function freezSelection() {
    element.disabled = true;
  }

  function unfreezSelection() {
    element.disabled = false;
  }

  function fillElement() {
    if (!identity) {
      fillElementNoIdentity();
    } else if (!isLoaded) {
      fillElementLoading();
    } else if (owners.length === 0) {
      fillElementNoCalendars();
    } else if (getFilteredUsers().length === 0) {
      fillElementNoMatch();
    } else {
      fillElementLoaded();
    }
  }

  function fillElementNoIdentity() {
    cal3eXul.clearTree(element);
    cal3eXul.addItemsToTree(
      element, [{
        'label': document.getElementById('calendar3e-strings').getString(
          'cal3eCalendarSubscribe.calendars.noIdentity'
        )
      }]
    );
  }

  function fillElementLoading() {
    cal3eXul.clearTree(element);
    cal3eXul.addItemsToTree(
      element, [{
        'label': document.getElementById('calendar3e-strings').getString(
          'cal3eCalendarSubscribe.calendars.loading'
        )
      }]
    );
  }

  function fillElementNoCalendars() {
    cal3eXul.clearTree(element);
    cal3eXul.addItemsToTree(
      element, [{
        'label': document.getElementById('calendar3e-strings').getString(
          'cal3eCalendarSubscribe.calendars.noCalendars'
        )
      }]
    );
  }

  function fillElementNoMatch() {
    cal3eXul.clearTree(element);
    cal3eXul.addItemsToTree(
      element, [{
        'label': document.getElementById('calendar3e-strings').getString(
          'cal3eCalendarSubscribe.calendars.noMatch'
        )
      }]
    );
  }

  function fillElementError() {
    document.getElementById('notifications').appendNotification(
      document.getElementById('calendar3e-strings').getString(
        'cal3eCalendarSubscribe.errors.data'
      ),
      0,
      null,
      document.getElementById('notifications').PRIORITY_WARNING_MEDIUM,
      null,
      function() { window.close() }
    );
  }

  function fillElementLoaded() {
    cal3eXul.clearTree(element);

    var parentElement;
    getFilteredUsers().forEach(function(owner) {
      parentElement = cal3eXul.addItemsToTree(
        element, [{
          'label': cal3eModel.userLabel(owner)
        }]
      );
      getFilteredCalendars(owner).forEach(function(calendar) {
        cal3eXul.addItemsToTree(
          parentElement, [{
            'label': cal3eModel.calendarLabel(calendar),
            'value': calendar['owner'] + ':' + calendar['name']
          }, {
            'label': cal3eModel.permissionLabel(calendar)
          }]
        );
      });
    });
  }

  function matchesFilter(string) {
    return normalizeString(string).indexOf(normalizeString(filter)) >= 0;
  }

  function normalizeString(string) {
    return ('' + string).toLowerCase().replace(/s+/, ' ');
  }

  function getFilteredUsers() {
    return owners.filter(function(user) {
        return matchUser(user) || matchUserCalendars(user);
      });
  }

  function getFilteredCalendars(user) {
    return matchAllCalendarsByUser(user) ?
      calendars[user['username']] :
      calendars[user['username']].filter(matchCalendar);
  }

  function matchAllCalendarsByUser(user) {
    return !calendars[user['username']].some(matchCalendar) &&
      matchUser(user);
  }

  function matchUser(user) {
    return matchesFilter(user['username']) ||
      matchesFilter(cal3eModel.attribute(user, 'realname'));
  }

  function matchUserCalendars(user) {
    return calendars[user['username']].some(matchCalendar);
  }

  function matchCalendar(calendar) {
    return matchesFilter(calendar['name']) ||
      matchesFilter(cal3eModel.attribute(calendar, 'title'));
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
      var [username, calendarName] = element.view.getCellValue(
        idx, element.columns.getPrimaryColumn()
      ).split(':', 2);
      var owner = owners.filter(function(user) {
        return user['username'] === username;
      });
      var calendar = calendars[username].filter(function(calendar) {
        return calendar['name'] === calendarName;
      });
      selection.push({ owner: owner[0], calendar: calendar[0] });
    });

    notify();
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

  function didError(error) {
    resetData(true);
    fillElementError();
  }

  function loadSharedCalendars() {
    resetData(false);
    fillElement();

    cal3eRequest.Client.getInstance()
      .getSharedCalendars(identity, sharedCalendarsDidLoad, '');
  }

  function sharedCalendarsDidLoad(result) {
    if (!(result instanceof cal3eResponse.Success)) {
      didError(result);
      return;
    }

    result.data.forEach(function(calendar) {
      if (!calendars[calendar['owner']]) {
        calendars[calendar['owner']] = [];
      }
      calendars[calendar['owner']].push(calendar);
    });

    loadSubscribedCalendars();
  }

  function loadSubscribedCalendars() {
    cal3eRequest.Client.getInstance()
      .getCalendars(identity, subscribedCalendarsDidLoad, 'subscribed()');
  }

  function subscribedCalendarsDidLoad(result) {
    if (!(result instanceof cal3eResponse.Success)) {
      didError(result);
      return;
    }

    result.data.forEach(function(subscriberCalendar) {
      if (!calendars[subscriberCalendar['owner']]) {
        return;
      }
      calendars[subscriberCalendar['owner']] =
        calendars[subscriberCalendar['owner']].filter(function(calendar) {
          return calendar['name'] !== subscriberCalendar['name'];
        });
      if (calendars[subscriberCalendar['owner']].length === 0) {
        delete calendars[subscriberCalendar['owner']];
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
      .getUsers(identity, calendarsOwnersDidLoad, query);
  }

  function calendarsOwnersDidLoad(result) {
    if (!(result instanceof cal3eResponse.Success)) {
      didError(result);
      return;
    }

    result.data.forEach(function(owner) {
      if (!calendars.hasOwnProperty(owner['username'])) {
        return;
      }

      owners.push(owner);
    });

    isLoaded = true;
    fillElement();
  }

  function setFilter(newFilter) {
    filter = newFilter;
    fillElement();

    return controller;
  }

  function setIdentity(newIdentity) {
    identity = newIdentity;

    if (identity) {
      loadSharedCalendars();
    }

    return controller;
  }

  function hasSelection() {
    return selection.length > 0;
  }

  function getSelection() {
    return selection;
  }

  function resetData(isLoaded) {
    calendars = {};
    owners = [];
    isLoaded = isLoaded;
  }

  function init() {
    window.addEventListener('unload', finalize, false);

    element = document.getElementById('calendars-tree');
    element.addEventListener('select', selectionDidChange, false);

    observers = [];

    fixingSelection = false;
    selection = [];

    filter = '';
    resetData(false);

    identity = null;
  }

  function finalize() {
    window.removeEventListener('unload', finalize, false);

    observers = null;

    identity = null;

    filter = null;
    calendars = null;
    owners = null;

    selection = null;

    element.addEventListener('select', selectionDidChange, false);
    element = null;
  }

  controller.freezSelection = freezSelection;
  controller.unfreezSelection = unfreezSelection;
  controller.hasSelection = hasSelection;
  controller.selection = getSelection;
  controller.setIdentity = setIdentity;
  controller.setFilter = setFilter;
  controller.addObserver = addObserver;
  controller.removeObserver = removeObserver;

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
  cal3eSubscription.controller = new cal3eSubscription(
    new cal3eSubscriberController(),
    new cal3eCalendarsFilterController(),
    new cal3eSharedCalendarsController(),
    new cal3eSubscriptionDelegate(),
    new cal3eDialogStateDelegate()
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
