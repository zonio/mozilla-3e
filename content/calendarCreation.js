/* ***** BEGIN LICENSE BLOCK *****
 * Mozilla 3e Calendar Extension
 * Copyright © 2010  Zonio s.r.o.
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

Components.utils.import("resource://calendar3e/cal3eUtils.jsm");

var cal3eCreation = {};

/**
 * Checks value of selected calendar format and modifies dialog
 * accordingly.
 *
 * If calendar format is 3e, then URI textbox is hidden because URI is
 * computed automatically. Previous value is stored in case user
 * changes her mind.
 */
cal3eCreation.selectionChanged = function selectionChanged() {
  var calendarFormat = document.getElementById('calendar-format');
  if ('eee' == calendarFormat.value) {
    cal3eCreation._activate3eContext();
  } else {
    cal3eCreation._deactivate3eContext();
  }
};

/**
 * Activates context for creation of 3e calendar.
 *
 * Activation is done by hiding row with calendar location textbox and
 * by showing menulist to select 3e account which will be used for
 * calendar creation.
 */
cal3eCreation._activate3eContext = function activate3eContext() {
  var calendarUri = document.getElementById('calendar-uri');

  // hide URI textbox and store current value
  cal3eCreation._originalUri = calendarUri.value || "";
  calendarUri.parentNode.setAttribute('hidden', 'true');
  cal3eCreation.computeUri();

  // hide lightning identity menu list if it is there
  //var identityRow = document.getElementById('calendar-email-identity-row');
  //if (null !== identityRow) {
  //  calendarUri.parentNode.setAttribute('hidden', 'true');
  //}

  // fixes problem with setting calendar URI value for the first time
  // when XUL doesn't dispatch command event properly
  var commandEvent = document.createEvent('Event');
  commandEvent.initEvent('command', true, true);
  calendarUri.dispatchEvent(commandEvent);

  // show account menulist with 3e-enabled accounts
  cal3eCreation._load3eAccounts();
  var calendar3eRow = document.getElementById('calendar3e-account-row');
  calendar3eRow.setAttribute('hidden', 'false');
};

/**
 * Loads fixtures of 3e accounts to accounts menu.
 *
 * @todo account loading this should be united for calendar
 * preferences, calendar creation and other dialogs in some util
 * function or found elsewhere
 */
cal3eCreation._load3eAccounts = function load3eAccounts() {
  var calendar3eAccounts = document.getElementById('calendar3e-account'),
      menuPopup = calendar3eAccounts.firstChild;
  var selectedIdentity = calendar3eAccounts.value;
  while (menuPopup.lastChild) {
    menuPopup.removeChild(menuPopup.lastChild);
  }

  var accountCollection = new cal3e.AccountCollection();
  var accounts = accountCollection.filter(
        cal3e.AccountCollection.filterEnabled),
      idx = accounts.length, account, identity, item;
  while (idx--) {
    account = accounts[idx];
    identity = account.defaultIdentity;
    item = calendar3eAccounts.appendItem(
      identity.fullName + " <" + identity.email + ">",
      identity.key);

    if (identity.key == selectedIdentity) {
      calendar3eAccounts.selectedItem = item;
    }
  }
};

/**
 * Deactivates context for creation of 3e calendar.
 *
 * Deactivation is done by hiding menulist to select 3e account which
 * will be used for calendar creation and by showing row with calendar
 * location textbox.
 */
cal3eCreation._deactivate3eContext = function deactivate3eContext() {
  // hide account menulist
  var accountRow = document.getElementById('calendar3e-account-row');
  accountRow.setAttribute('hidden', 'true');

  // hide lightning identity menu list if it is there
  //var identityRow = document.getElementById('calendar-email-identity-row');
  //if (null !== identityRow) {
  //  calendarUri.parentNode.setAttribute('hidden', 'false');
  //}

  // show location textbox with previously entered URI
  var calendarUri = document.getElementById('calendar-uri');
  calendarUri.value = cal3eCreation._originalUri || calendarUri.value || "";
  calendarUri.parentNode.setAttribute('hidden', 'false');
};

/**
 * Sets EEE URI to location textbox according to currently available
 * information about created 3e calendar.
 *
 * Does nothing if created calendar isn't 3e calendar.
 */
cal3eCreation.computeUri = function computeUri() {
  var calendarFormat = document.getElementById('calendar-format');
  if ('eee' != calendarFormat.value) {
    return;
  }

  var account = document.getElementById('calendar3e-account'),
      uri = "eee://";

  var accountCollection = new cal3e.AccountCollection();
  var accounts = accountCollection.filter(
        cal3e.AccountCollection.filterEnabled),
      idx = accounts.length, account, identity;
  while (idx--) {
    identity
  }
  uri += account.value + '/';

  //XXX debug only
  //TODO implementation should create custom unique calendar name a
  //use name entered by user as name property value
  var name = document.getElementById('calendar-name');
  if (name.value) {
    uri += name.value;
  }

  var calendarUri = document.getElementById('calendar-uri');
  calendarUri.value = uri;
};

/**
 * Synces identity set on 3e overlay controls to Lightning overlay
 * controls.
 *
 * This ensures that calendar gets proper identity set.
 */
cal3eCreation.syncIdentity = function syncIdentity() {
  var cal3eIdentity = document.getElementById('calendar3e-account');
  var lightningIdentity = document.getElementById('email-identity-menulist');

  cal3e.Debug.dump("Selected: " + cal3eIdentity.value);
  var idx = lightningIdentity.itemCount, item;
  while (idx--) {
    item = lightningIdentity.getItemAtIndex(idx);
    cal3e.Debug.dump("Compare to: " + item.value);
    if (item.value == cal3eIdentity.value) {
      lightningIdentity.selectedItem = item;
      break;
    }
  }
};

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
cal3eCreation.overlay = function overlay() {
  var accountMenuList = document.createElement('menulist');
  accountMenuList.id = 'calendar3e-account';
  accountMenuList.flex = 1;
  accountMenuList.appendChild(document.createElement('menupopup'));
  
  var accountLabel = document.createElement('label');
  accountLabel.control = 'calendar3e-account';

  var accountRow = document.createElement('row');
  accountRow.id = 'calendar3e-account-row';
  accountRow.align = 'center';
  accountRow.insertBefore(accountMenuList, null);
  accountRow.insertBefore(accountLabel, accountMenuList);

  var notifications = document.getElementById('location-notifications');
  notifications.parentNode.insertBefore(accountRow, notifications);

  // doesn't work when set before actually being in the document
  var stringBundle = document.getElementById('calendar3e-strings');
  accountLabel.value = stringBundle.getString(
    'cal3eCalendarProperties.account.label');

  accountMenuList.addEventListener('command', cal3eCreation.computeUri, false);

  var nameTextbox = document.getElementById('calendar-name');  
  nameTextbox.addEventListener('input', cal3eCreation.computeUri, false);

  // sadly, this is better solution but cannot there's no way to make
  // event handler hadle page show in the right time (after
  // Lightning's page initialization)
  //var calendarWizard = document.getElementById('calendar-wizard');
  //calendarWizard.getPageById('customizePage').addEventListener(
  //  'pageshow', cal3eCreation.syncIdentity, false);
  // ... so we have to override that Lightning's page initialization
  cal3eCreation._ltn_initCustomizePage = initCustomizePage;
  initCustomizePage = function cal3e_initCustomizePage() {
    cal3eCreation._ltn_initCustomizePage();
    cal3eCreation.syncIdentity();
  };
};

/**
 * Initializes calendar creation dialog with 3e extesion specific
 * behavior.
 */
cal3eCreation.init = function init() {
  cal3eCreation.overlay();

  var calendarFormat = document.getElementById('calendar-format');
  calendarFormat.addEventListener(
    'command', cal3eCreation.selectionChanged, false);
  cal3eCreation.selectionChanged();
};

window.addEventListener('load', cal3eCreation.init, false);
