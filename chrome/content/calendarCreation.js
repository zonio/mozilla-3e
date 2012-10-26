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
Components.utils.import('resource://calendar3e/modules/feature.jsm');
Components.utils.import('resource://calendar3e/modules/xul.jsm');

function cal3eNewCreation(ownerController, calendarController,
                          overlayDelegate) {
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
    ownerController.addObserver(controller.ownerDidChange);
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
  var lightningIdentityElement;
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

  function setLightningIdentity() {
    var idx = lightningIdentity.itemCount;
    while (idx--) {
      if (lightningIdentityElement.getItemAtIndex(idx).value ===
          identity.key) {
        lightningIdentityElement.selectedIndex = idx;
        break;
      }
    }
  }

  function getIdentity() {
    return identity;
  }

  function init() {
    identity = null;

    element = document.getElementById('calendar3e-account');
    element.addEventListener('command', identityDidChange, false);
    lightningIdentityElement =
      document.getElementById('email-identity-menulist');

    lightningInitCustomizePage = initCustomizePage;
    initCustomizePage = function() {
      lightningInitCustomizePage();
      setLightningIdentity();
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
    lightningIdentityElement = null;

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

function cal3eCreation() {
  var originalUri = '';
  var ltn_initCustomizePage;

  /**
   * Activates context for creation of 3e calendar.
   *
   * Activation is done by hiding row with calendar location textbox and
   * by showing menulist to select 3e account which will be used for
   * calendar creation.
   */
  function activate3eContext() {
    var calendarUriElement = document.getElementById('calendar-uri');

    // hide URI textbox and store current value
    originalUri = calendarUriElement.value || '';
    calendarUriElement.parentNode.setAttribute('hidden', 'true');
    computeUri();

    // hide lightning identity menu list if it is there
    var identityRow = document.getElementById('calendar-email-identity-row');
    if (null !== identityRow) {
      identityRow.setAttribute('hidden', 'true');
    }

    // fixes problem with setting calendar URI value for the first time
    // when XUL doesn't dispatch command event properly
    var commandEvent = document.createEvent('Event');
    commandEvent.initEvent('command', true, true);
    calendarUriElement.dispatchEvent(commandEvent);

    // show account menulist with 3e-enabled accounts
    load3eAccounts();
    var calendar3eRow = document.getElementById('calendar3e-account-row');
    calendar3eRow.setAttribute('hidden', 'false');
  }

  /**
   * Loads fixtures of 3e accounts to accounts menu.
   *
   * @todo account loading this should be united for calendar
   * preferences, calendar creation and other dialogs in some util
   * function or found elsewhere
   */
  function load3eAccounts() {
    var calendar3eAccounts = document.getElementById('calendar3e-account'),
    menuPopup = calendar3eAccounts.firstChild;
    var selectedIdentity = calendar3eAccounts.value;
    while (menuPopup.lastChild) {
      menuPopup.removeChild(menuPopup.lastChild);
    }

    cal3eIdentity.Collection().
      getEnabled().
      forEach(function(identity) {
        var item = calendar3eAccounts.appendItem(
          identity.fullName + ' <' + identity.email + '>',
          identity.key
        );

        if (!selectedIdentity) {
          selectedIdentity = identity.key;
        }
        if (identity.key === selectedIdentity) {
          calendar3eAccounts.selectedItem = item;
        }
      });
  }

  /**
   * Deactivates context for creation of 3e calendar.
   *
   * Deactivation is done by hiding menulist to select 3e account which
   * will be used for calendar creation and by showing row with calendar
   * location textbox.
   */
  function deactivate3eContext() {
    // hide account menulist
    var accountRow = document.getElementById('calendar3e-account-row');
    accountRow.setAttribute('hidden', 'true');

    // hide lightning identity menu list if it is there
    var identityRow = document.getElementById('calendar-email-identity-row');
    if (null !== identityRow) {
      identityRow.setAttribute('hidden', 'false');
    }

    // show location textbox with previously entered URI
    var calendarUriElement = document.getElementById('calendar-uri');
    if ('undefined' !== typeof originalUri) {
      calendarUriElement.value = originalUri;
    } else {
      calendarUriElement.value = calendarUriElement.value || '';
    }
    calendarUriElement.parentNode.setAttribute('hidden', 'false');
  }

  /**
   * Checks value of selected calendar format and modifies dialog
   * accordingly.
   *
   * If calendar format is 3e, then URI textbox is hidden because URI
   * is computed automatically. Previous value is stored in case user
   * changes her mind.
   */
  function selectionChanged() {
    var calendarFormat = document.getElementById('calendar-format');
    if ('eee' == calendarFormat.value) {
      activate3eContext();
    } else {
      deactivate3eContext();
    }
  }

  /**
   * Dynamically creates elements necessary for 3e calendar creation.
   *
   * Ovelay isn't used in this situation because calendar creation
   * wizard makes it hard to provide custom UI on the page where
   * calendar type and location are edited.
   *
   * Menulist and its label along with a row where they will reside are
   * created and inserted on the page mentioned before. Row is
   * identified as 'calendar3e-account-row' and menulist as
   * 'calendar3e-account'.
   */
  function overlay() {
    var accountMenuList = document.createElementNS(
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      'menulist'
    );
    accountMenuList.id = 'calendar3e-account';
    accountMenuList.flex = 1;
    accountMenuList.appendChild(document.createElementNS(
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      'menupopup'
    ));

    var accountLabel = document.createElementNS(
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      'label'
    );
    accountLabel.control = 'calendar3e-account';

    var accountRow = document.createElementNS(
      'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      'row'
    );
    accountRow.id = 'calendar3e-account-row';
    accountRow.align = 'center';
    accountRow.insertBefore(accountMenuList, null);
    accountRow.insertBefore(accountLabel, accountMenuList);

    var cacheRow = document.getElementById('cache').parentNode;
    cacheRow.parentNode.insertBefore(accountRow, cacheRow);

    // doesn't work when set before actually being in the document
    var stringBundle = document.getElementById('calendar3e-strings');
    accountLabel.value = stringBundle.getString(
      'cal3eCalendarProperties.account.label'
    );

    accountMenuList.addEventListener('command', computeUri, false);

    var nameTextbox = document.getElementById('calendar-name');
    nameTextbox.addEventListener('input', computeUri, false);

    // sadly, this is better solution but cannot there's no way to make
    // event handler hadle page show in the right time (after
    // Lightning's page initialization)
    //var calendarWizard = document.getElementById('calendar-wizard');
    //calendarWizard.getPageById('customizePage').addEventListener(
    //  'pageshow', cal3eCreation.syncIdentity, false);
    // ... so we have to override that Lightning's page initialization
    ltn_initCustomizePage = initCustomizePage;
    initCustomizePage = function cal3e_initCustomizePage() {
      ltn_initCustomizePage();
      syncIdentity();
    };
  }

  /**
   * Sets EEE URI to location textbox according to currently available
   * information about created 3e calendar.
   *
   * Does nothing if created calendar isn't 3e calendar.
   */
  function computeUri() {
    if ('eee' !== document.getElementById('calendar-format').value) {
      return;
    }

    var identities = cal3eIdentity.Collection().
      getEnabled().
      filter(function(identity) {
        return identity.key ===
          document.getElementById('calendar3e-account').value;
      });

    uri = 'eee://';
    if (identities.length > 0) {
      uri += identities[0].email;
    }
    uri += '/';
    document.getElementById('calendar-uri').value = uri;

    if (gCalendar) {
      var ioService = Components.classes['@mozilla.org/network/io-service;1'].
        getService(Components.interfaces.nsIIOService);
      gCalendar.uri = ioService.newURI(uri, null, null);
    }
  }

  /**
   * Synces identity set on 3e overlay controls to Lightning overlay
   * controls.
   *
   * This ensures that calendar gets proper identity set.
   */
  function syncIdentity() {
    var cal3eIdentity = document.getElementById('calendar3e-account');
    var lightningIdentity = document.getElementById('email-identity-menulist');

    var idx = lightningIdentity.itemCount;
    while (idx--) {
      if (lightningIdentity.getItemAtIndex(idx).getAttribute('value') ==
          cal3eIdentity.value) {
        lightningIdentity.selectedItem = lightningIdentity.getItemAtIndex(idx);
        break;
      }
    }
  }

  overlay();
  document.getElementById('calendar-format').addEventListener(
    'command', selectionChanged, false
  );
  selectionChanged();
}

cal3eCreation.onLoad = function cal3eCreation_onLoad() {
  try {
  if (cal3eFeature.isSupported('creation_fix')) {
    cal3eCreation.overlay = new cal3eOverlayDelegate();
    cal3eCreation.overlay.load();

    cal3eCreation.controller = new cal3eNewCreation(
      new cal3eOwnerController(),
      new cal3eCalendarController(),
      cal3eCreation.overlay
    );

    window.addEventListener('unload', cal3eCreation.onUnload, false);
  } else {
    new cal3eCreation();
  }
  } catch (e) {
    Services.console.logStringMessage('[3e] ' + e);
  }
};
cal3eCreation.onUnload = function cal3eCreation_onUnload() {
  window.removeEventListener('unload', cal3eCreation.onUnload, false);

  cal3eCreation.overlay.unload();
  delete cal3eCreation.overlay;

  delete cal3eCreation.controller;
};

window.addEventListener('load', cal3eCreation.onLoad, false);
