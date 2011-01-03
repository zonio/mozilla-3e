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

Cu.import("resource://gre/modules/iteratorUtils.jsm");

EXPORTED_SYMBOLS = [
  'cal3e'
];

/**
 * Utility prototypes and functions for 3e calendar provider.
 *
 * @namespace
 */
var cal3e = {};

cal3e.EEE_ENABLED_KEY = 'eee_enabled';

cal3e.EnabledAccounts = function cal3eEnabledAccounts() {
  var accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
        .getService(Ci.nsIMsgAccountManager);
  accountManager.addIncomingServerListener(this);
  this._accountManager = accountManager;
  this._accounts = [];
  this._enabledAccounts = [];
  this._observers = [];
}

cal3e.EnabledAccounts.prototype = {

  addObserver: function cal3eEnabledAccounts_addObserver(observer) {
    if (0 <= this._observers.indexOf(observer)) {
      return this;
    }
    this._observers.push(observer);
  },

  removeObserver: function cal3eEnabledAccounts_removeObserver(observer) {
    var idx = this._observers.indexOf(observer);
    if (0 > idx) {
      return;
    }
    this._observers = this._observers.splice(idx, 1);
  },

  notify: function cal3eEnabledAccounts_notify() {
    var observers = this._observers,
        observer, idx = observers.length;
    while (idx--) {
      observer = observers[idx];
      if ('function' !== typeof observer.onAccountsChange) {
        continue;
      }

      observer.onAccountsChange(this);
    }
  },

  forEach: function cal3eEnabledAccounts_forEach(callback, thisObject) {
    var accounts = this._enabledAccounts,
        account, idx = -1, limit = accounts.length;
    while (++idx < limit) {
      callback.call(thisObject, accounts[idx], idx, this);
    }
  },

  /**
   * Loads accounts currently registred in Thunderbird.
   */
  _loadAccounts: function cal3eEnabledAccounts_loadAccounts() {
    var accountManager = this._accountManager;
    var accounts = [
      a for each (a in fixIterator(accountManager.accounts, Ci.nsIMsgAccount))
    ];
    //XXX incomingServer server check due to 41133
    accounts = accounts.filter(function (a) {
      return a.incomingServer &&
            (a.incomingServer.type != "nntp") &&
            (a.incomingServer.type != "none");
    });

    function sortAccounts(a, b) {
      if (a.key == accountManager.defaultAccount.key) {
        return -1;
      }
      if (b.key == accountManager.defaultAccount.key) {
        return  1;
      }
      return 0;
    }
    accounts.sort(sortAccounts);
    this._accounts = accounts;
  },

  /**
   * Filters accounts with enabled 3e calendaring features from all
   * loaded accounts.
   */
  _filterEnabledAccounts:
      function cal3eEnabledAccounts_filterEnabledAccounts() {
    this._enabledAccounts = this._accounts.filter(
      function cal3eEnabledAccounts_filterEnabledAccount(account) {
        return account.defaultIdentity.getBoolAttribute(
          cal3e.EEE_ENABLED_KEY);
      });
  },

  /**
   * Reloads accounts, whether they have enabled 3e calendaring
   * features and rebuilds preferences table with them.
   */
  _accountsDidChange: function cal3eEnabledAccounts_accountsDidChange() {
    this._loadAccounts();
    this._filterEnabledAccounts();
  },

  /**
   * Notifies this preference handler that accounts probably changed.
   *
   * Implemented according to nsIIncomingServerListener.
   *
   * @param {nsIMsgIncomingServer} server
   */
  onServerLoaded: function cal3eEnabledAccounts_onServerLoaded(server) {
    this._accountsDidChange();
  },

  /**
   * Notifies this preference handler that accounts probably changed.
   *
   * Implemented according to nsIIncomingServerListener.
   *
   * @param {nsIMsgIncomingServer} server
   */
  onServerUnloaded: function cal3eEnabledAccounts_onServerUnloaded(server) {
    this._accountsDidChange();
  },

  /**
   * Notifies this preference handler that accounts parameters
   * probably changed and their representation should be rebuild.
   *
   * Implemented according to nsIIncomingServerListener.
   *
   * @param {nsIMsgIncomingServer} server
   */
  onServerChanged: function cal3eEnabledAccounts_onServerChanged(server) {
    this._filterEnabledAccounts();
  }

}
