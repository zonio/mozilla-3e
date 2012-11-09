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

Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/xul.jsm');

function cal3eCreation(ownerController, calendarController, overlayDelegate) {
  var controller = this;

  function calendarTypeDidChange() {
    if (document.getElementById('calendar-format').value === 'eee') {
      overlayDelegate.activate();
    } else {
      overlayDelegate.deactivate();
    }
  }

  function ownerDidChange() {
    calendarController.setIdentity(ownerController.identity());
    overlayDelegate.set3eUri(calendarController.uri());
  }

  function init() {
    ownerController.addObserver(ownerDidChange);
    ownerDidChange();

    document.getElementById('calendar-format').addEventListener(
      'command', calendarTypeDidChange, false
    );

    window.addEventListener('unload', finalize, false);
  }

  function finalize() {
    window.removeEventListener('unload', finalize, false);

    document.getElementById('calendar-format').removeEventListener(
      'command', calendarTypeDidChange, false
    );

    ownerController.removeObserver(controller.ownerDidChange);
  }

  init();
}

function cal3eOverlayDelegate() {
  var delegate = this;
  var cal3eUri;
  var lightningUri;
  var uri;
  var lightningInitCustomizePage;

  function load() {
    var calendarUriRow = document.getElementById('calendar-uri').parentNode;
    var accountRow = calendarUriRow.parentNode.insertBefore(
      cal3eXul.createElement(document, 'row'), calendarUriRow
    );
    accountRow.id = 'calendar3e-account-row';
    accountRow.align = 'center';
    accountRow.collapsed = true;

    var accountLabel = accountRow.appendChild(
      cal3eXul.createElement(document, 'label')
    );
    accountLabel.control = 'calendar3e-account';
    accountLabel.value = document.getElementById('calendar3e-strings')
      .getString('cal3eCalendarProperties.account.label');

    var accountMenuList = accountRow.appendChild(
      cal3eXul.createElement(document, 'menulist')
    );
    accountMenuList.appendChild(cal3eXul.createElement(document, 'menupopup'));
    accountMenuList.id = 'calendar3e-account';
    accountMenuList.flex = 1;

    lightningInitCustomizePage = initCustomizePage;
    initCustomizePage = function() {
      lightningInitCustomizePage();
      ensureLightningIdentityCollapsedState();
    };

    cal3eUri = { value: '' };
    lightningUri = { value: document.getElementById('calendar-uri').value };
    uri = lightningUri;
  }

  function unload() {
    cal3eUri = null;
    lightningUri = null;
    uri = null;

    initCustomizePage = lightningInitCustomizePage;
    lightningInitCustomizePage = null;

    document.getElementById('calendar3e-account-row').parentNode.removeChild(
      document.getElementById('calendar3e-account-row')
    );
  }

  function activate() {
    uri.value = document.getElementById('calendar-uri').value || '';
    uri = cal3eUri;
    forceUriChange();

    var commandEvent = document.createEvent('Event');
    commandEvent.initEvent('command', true, true);
    document.getElementById('calendar-uri').dispatchEvent(commandEvent);

    document.getElementById('calendar-uri').parentNode.collapsed = true;
    document.getElementById('calendar-email-identity-row').collapsed = true;
    document.getElementById('calendar3e-account-row').collapsed = false;
  }

  function deactivate() {
    uri.value = document.getElementById('calendar-uri').value || '';
    uri = lightningUri;
    forceUriChange();

    document.getElementById('calendar-uri').parentNode.collapsed = false;
    document.getElementById('calendar-email-identity-row').collapsed = false;
    document.getElementById('calendar3e-account-row').collapsed = true;
  }

  function ensureLightningIdentityCollapsedState() {
    if (uri !== cal3eUri) {
      return;
    }

    document.getElementById('calendar-email-identity-row').collapsed = true;
  }

  function forceUriChange() {
    document.getElementById('calendar-uri').value = uri.value;

    var commandEvent = document.createEvent('Event');
    commandEvent.initEvent('command', true, true);
    document.getElementById('calendar-uri').dispatchEvent(commandEvent);
  }

  function set3eUri(newUri) {
    cal3eUri.value = newUri;
    if (uri === cal3eUri) {
      document.getElementById('calendar-uri').value = uri.value;
    }

    return delegate;
  }

  delegate.load = load;
  delegate.unload = unload;
  delegate.activate = activate;
  delegate.deactivate = deactivate;
  delegate.set3eUri = set3eUri;
}

function cal3eOwnerController() {
  var controller = this;
  var identity;
  var element;
  var lightningInitCustomizePage;
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
    cal3eXul.clearMenu(element);

    cal3eIdentity.Collection().getEnabled().forEach(function(identity) {
      element.appendItem(
        identity.fullName + ' <' + identity.email + '>',
        identity.key
      );
    });
    element.selectedIndex = 0;

    identityDidChange();
  }

  function identityDidChange() {
    var identities = cal3eIdentity.Collection()
      .getEnabled()
      .filter(function(identity) {
        return identity.key === element.value;
      });

    if (identity !== identities[0]) {
      identity = identities[0] || null;
      notify();
    }
  }

  function getIdentity() {
    return identity;
  }

  function init() {
    identity = null;

    element = document.getElementById('calendar3e-account');
    element.addEventListener('command', identityDidChange, false);

    lightningInitCustomizePage = initCustomizePage;
    initCustomizePage = function() {
      lightningInitCustomizePage();
      document.getElementById('email-identity-menulist').value = identity.key;
    };

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

    initCustomizePage = lightningInitCustomizePage;
    lightningInitCustomizePage = null;

    observers = null;

    element.removeEventListener('command', identityDidChange, false);
    cal3eXul.clearMenu(element);
    element = null;

    identity = null;
  }

  controller.identity = getIdentity;
  controller.addObserver = addObserver;
  controller.removeObserver = removeObserver;

  init();
}

function cal3eCalendarController() {
  var controller = this;
  var identity;

  function setIdentity(newIdentity) {
    identity = newIdentity;

    if (gCalendar) {
      gCalendar.uri = Services.io.newURI(getUri(), null, null);
    }

    return controller;
  }

  function getUri() {
    var uri = 'eee://';
    if (identity) {
      uri += identity.email;
    }
    uri += '/';

    return uri;
  }

  function init() {
    identity = null;

    window.addEventListener('unload', finalize, false);
  }

  function finalize() {
    window.removeEventListener('unload', finalize, false);

    identity = null;
  }

  controller.setIdentity = setIdentity;
  controller.uri = getUri;

  init();
}

cal3eCreation.onLoad = function cal3eCreation_onLoad() {
  cal3eCreation.overlay = new cal3eOverlayDelegate();
  cal3eCreation.overlay.load();

  cal3eCreation.controller = new cal3eCreation(
    new cal3eOwnerController(),
    new cal3eCalendarController(),
    cal3eCreation.overlay
  );

  window.addEventListener('unload', cal3eCreation.onUnload, false);
};
cal3eCreation.onUnload = function cal3eCreation_onUnload() {
  window.removeEventListener('unload', cal3eCreation.onUnload, false);

  cal3eCreation.overlay.unload();
  delete cal3eCreation.overlay;

  delete cal3eCreation.controller;
};

window.addEventListener('load', cal3eCreation.onLoad, false);
