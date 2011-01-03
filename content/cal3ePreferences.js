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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Components.utils.import("resource://calendar3e/cal3eUtils.jsm");

/**
 * Handler of 3e calendar preferences dialog.
 *
 * Currently, there's only option to enable 3e calendaring on selected
 * accounts.
 *
 * @class
 */
cal3ePreferences = function () {
  accountCollection = new cal3e.AccountCollection();
  accountCollection.addObserver(this);

  /**
   * Collection of accounts either with enabled 3e calendaring
   * features or those which can be enabled.
   *
   * @type cal3e.AccountCollection
   */
  this._accountCollection = accountCollection;

  /**
   * Map of identities and their 3e calendaring features statuses.
   *
   * @type {Object}
   */
  this._identityStatusMap: {};
}

cal3ePreferences.prototype = {

  /**
   * Stores enabled and disabled 3e calendaring features for particular
   * accounts.
   */
  store: function () {
    var map = this._identityStatusMap;
    var accounts = this._accountCollection.filter(
          cal3e.AccountCollection.filterAll),
        account, identity, enabled;
    for each (account in accounts) {
      identity = account.defaultIdentity;
      enabled = map[identity.key];
      identity.setBoolAttribute(cal3e.EEE_ENABLED_KEY, enabled);
    }
  },

  /**
   * Enables or disables 3e support for account default identity associated
   * with event's target (checkbox cell in tree).
   *
   * @param {Event} evt 
   */
  _eeeEnabledDidChange: function (evt) {
    var enabledCell = evt.target;

    if ((0 != evt.button) ||
        ('treechildren' != evt.originalTarget.localName)) {
      return;
    }
    var row = {}, col = {}, childElt = {},
        tree = document.getElementById('cal3e-accounts-tree');
    tree.treeBoxObject.getCellAt(evt.clientX, evt.clientY, row, col, childElt);
    if ((row.value == -1) || (row.value > tree.view.rowCount-1)) {
      return;
    }

    if ((('cal3e-accounts-tree-col-enable' != col.value.id) ||
        (2 == evt.detail)) &&
        (('cal3e-accounts-tree-col-enable' == col.value.id) ||
        (2 != evt.detail))) {
      return;
    }

    var identityNameColumn = col.value.getPrevious() || col.value,
        treeView = tree.view;
    var identityKey = treeView.getCellValue(row.value, identityNameColumn);

    var map = this._identityStatusMap,
        status = !map[identityKey];
    map[identityKey] = status;
    var rows = tree.getElementsByTagName('treerow'),
        identityRow = rows[row.value],
        identityEnabledCell = identityRow.lastElementChild;
    identityEnabledCell.setAttribute(
      'properties',
      status ? 'enabled' : 'not-enabled');
  },

  /**
   * Fills the UI with loaded accounts' default identities.
   *
   * Also registers handling to catch changes when user enables or diaables 3e
   * calendaring features on particular account default identity.
   */
  _fillAccountsTable: function () {
    var tree = document.getElementById('cal3e-accounts-tree-children');
    while (tree.firstChild) {
      tree.removeChild(tree.firstChild);
    }
    var calPrefs = this;
    var handler = function (evt) {
      calPrefs._eeeEnabledDidChange(evt);
    };
    tree.addEventListener('keypress', handler, false);
    tree.addEventListener('click', handler, false);

    var map = this._identityStatusMap;
    var accounts = this._accountCollection.filter(
          cal3e.AccountCollection.filterAll),
        account, identity, enabled;
    var identityNameCell, identityEnabledCell, treerow, treeitem;
    for each (account in this._accounts) {
      identity = account.defaultIdentity;

      identityNameCell = document.createElement('treecell');
      identityNameCell.setAttribute('value', identity.key);
      identityNameCell.setAttribute('label', identity.identityName);

      identityEnabledCell = document.createElement('treecell');
      enabled = map[identity.key];
      identityEnabledCell.setAttribute(
        'properties',
        enabled ? 'enabled' : 'not-enabled');

      treerow = document.createElement('treerow');
      treerow.appendChild(identityNameCell);
      treerow.appendChild(identityEnabledCell);

      treeitem = document.createElement('treeitem');
      treeitem.appendChild(treerow);
      tree.appendChild(treeitem);
    }
  },

  /**
   * Initializes map of identities and their status of enabled 3e calendaring
   * features.
   *
   * Already set identities are skipped. This can occur when accounts change.
   */
  _loadStatuses: function () {
    var map = this._identityStatusMap;
    var accounts = this._accountCollection.filter(
          cal3e.AccountCollection.filterAll),
        account, identity, enabled;
    for each (account in accounts) {
      identity = account.defaultIdentity;
      if ('undefined' !== typeof map[identity.key]) {
        continue;
      }

      enabled = identity.getBoolAttribute(cal3e.EEE_ENABLED_KEY);
      map[identity.key] = enabled;
    }
  },

  /**
   * Reloads accounts, whether they have enabled 3e calendaring
   * features and rebuilds preferences table with them.
   *
   * It called by cal3e.AccountsCollection when accounts did change.
   */
  onAccountsChange: function () {
    this._loadStatuses();
    this._fillAccountsTable();
  },

  /**
   * Releases resources used by preferences handler.
   *
   * Client code should assude that this method gets called.
   *
   * @todo is this necessary?
   */
  finalize: function () {
    this._accountCollection.removeObserver(this);
  }

};


var prefs;
Calendar3e.Preferences.onLoad = function () {
  prefs = new Calendar3e.Preferences();
}
Calendar3e.Preferences.onAccept = function () {
  prefs.store();

  return true;
}
Calendar3e.Preferences.onUnload = function () {
  prefs.finalize();
  prefs = null;
}
