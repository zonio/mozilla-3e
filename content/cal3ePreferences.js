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

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

/**
 * Top-level 3e calendar provider namespace.
 *
 * @namespace
 * @name Calendar3e
 */
if ('undefined' === typeof Calendar3e) {
  var Calendar3e = {};
}

/**
 * Handler of 3e calendar preferences dialog.
 *
 * Currently, there's only option to enable 3e calendaring on selected
 * accounts.
 *
 * @class
 */
Calendar3e.Preferences = function () {
  var console = Cc["@mozilla.org/consoleservice;1"].getService(
      Ci.nsIConsoleService
    );
  this._console = console;

  this._loadAccounts();
  this._loadStatuses();
  this._fillAccountsTable();
}

/**
 * Prefence key which holds flag whether 3e calendaring features are enabled
 * on particular account.
 *
 * @constant
 */
Calendar3e.Preferences.EEE_ENABLED_KEY = 'eee_enabled';

Calendar3e.Preferences.prototype = {

  /**
   * Thunderbird's account manager.
   *
   * @type nsIConsoleService
   * @todo replace by Log4Moz
   */
  _console: undefined,

  /**
   * Map of identities and their 3e calendaring features statuses.
   *
   * @type {Object}
   */
  _identityStatusMap: {},

  /**
   * Stores enabled and disabled 3e calendaring features for particular
   * accounts.
   */
  store: function () {
    var map = this._identityStatusMap,
        account, identity, enabled;
    for each (account in this._accounts) {
      identity = account.defaultIdentity;
      enabled = map[identity.key];
      identity.setBoolAttribute(
          Calendar3e.Preferences.EEE_ENABLED_KEY, enabled
        );
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
        status ? 'enabled' : 'not-enabled'
      );
  },

  /**
   * Loads accounts currently registred in Thunderbird.
   */
  _loadAccounts: function () {
    var mgr = Cc["@mozilla.org/messenger/account-manager;1"].getService(
        Ci.nsIMsgAccountManager
      );

    var accounts = [
      a for each (a in fixIterator(mgr.accounts, Ci.nsIMsgAccount))
    ];
    //XXX incomingServer server check due to 41133
    accounts = accounts.filter(function (a) {
      return a.incomingServer &&
            (a.incomingServer.type != "nntp") &&
            (a.incomingServer.type != "none");
    });


    function sortAccounts(a, b) {
      if (a.key == mgr.defaultAccount.key) {
        return -1;
      }
      if (b.key == mgr.defaultAccount.key) {
        return  1;
      }
      return 0;
    }
    accounts.sort(sortAccounts);
    this._accounts = accounts;
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

    var map = this._identityStatusMap,
        account, identity, enabled,
        identityNameCell, identityEnabledCell, treerow, treeitem;
    for each (account in this._accounts) {
      identity = account.defaultIdentity;

      identityNameCell = document.createElement('treecell');
      identityNameCell.setAttribute('value', identity.key);
      identityNameCell.setAttribute('label', identity.identityName);

      identityEnabledCell = document.createElement('treecell');
      enabled = map[identity.key];
      identityEnabledCell.setAttribute(
          'properties',
          enabled ? 'enabled' : 'not-enabled'
        );

      treerow = document.createElement('treerow');
      treerow.appendChild(identityNameCell);
      treerow.appendChild(identityEnabledCell);

      treeitem = document.createElement('treeitem');
      treeitem.appendChild(treerow);
      tree.appendChild(treeitem);
    }
  },

  _loadStatuses: function () {
    var map = this._identityStatusMap,
        account, identity, enabled;
    for each (account in this._accounts) {
      identity = account.defaultIdentity;
      enabled = identity.getBoolAttribute(
          Calendar3e.Preferences.EEE_ENABLED_KEY
        );
      map[identity.key] = enabled;
    }
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
  prefs = null;
}
