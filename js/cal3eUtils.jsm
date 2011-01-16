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

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

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

cal3e.AccountCollection = function cal3eAccountCollection() {
  var accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
    .getService(Ci.nsIMsgAccountManager);
  this._accountManager = accountManager;
  this._accounts = [];
  this._observers = [];

  this._loadAccounts();
  accountManager.addIncomingServerListener(this);
}

cal3e.AccountCollection.filterAll =
function cal3eAccountCollection_filterAll(account) {
  return true;
}

cal3e.AccountCollection.filterEnabled =
function cal3eAccountCollection_filterEnabled(account) {
  return account.defaultIdentity.getBoolAttribute(cal3e.EEE_ENABLED_KEY);
}

cal3e.AccountCollection.filterCandidate =
function cal3eAccountCollection_filterCandidate(account) {
  return !account.defaultIdentity.getBoolAttribute(cal3e.EEE_ENABLED_KEY);
}

cal3e.AccountCollection.prototype = {

  addObserver: function cal3eAccountCollection_addObserver(observer) {
    if (0 <= this._observers.indexOf(observer)) {
      return;
    }
    this._observers.push(observer);
  },

  removeObserver: function cal3eAccountCollection_removeObserver(observer) {
    var idx = this._observers.indexOf(observer);
    if (0 > idx) {
      return;
    }
    this._observers = this._observers.splice(idx, 1);
  },

  notify: function cal3eAccountCollection_notify() {
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

  filter: function cal3eAccountCollection_filter(callback, thisObject) {
    var filtered = [];
    var accounts = this._accounts,
        account, idx = -1, limit = accounts.length;
    while (++idx < limit) {
      account = accounts[idx];
      if (callback.call(thisObject, account, idx, this)) {
        filtered.push(account);
      }
    }

    return filtered;
  },

  forEach: function cal3eAccountCollection_forEach(callback, thisObject) {
    var accounts = this._accounts,
        idx = -1, limit = accounts.length;
    while (++idx < limit) {
      callback.call(thisObject, accounts[idx], idx, this);
    }
  },

  /**
   * Loads accounts currently registred in Thunderbird.
   */
  _loadAccounts: function cal3eAccountCollection_loadAccounts() {
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
    this.notify();
  },

  /**
   * Notifies this preference handler that accounts probably changed.
   *
   * Implemented according to nsIIncomingServerListener.
   *
   * @param {nsIMsgIncomingServer} server
   */
  onServerLoaded: function cal3eAccountCollection_onServerLoaded(server) {
    this._loadAccounts();
  },

  /**
   * Notifies this preference handler that accounts probably changed.
   *
   * Implemented according to nsIIncomingServerListener.
   *
   * @param {nsIMsgIncomingServer} server
   */
  onServerUnloaded: function cal3eAccountCollection_onServerUnloaded(server) {
    this._loadAccounts();
  },

  /**
   * Notifies this preference handler that accounts parameters
   * probably changed and their representation should be rebuild.
   *
   * Implemented according to nsIIncomingServerListener.
   *
   * @param {nsIMsgIncomingServer} server
   */
  onServerChanged: function cal3eAccountCollection_onServerChanged(server) {
    this.notify();
  }

}

/**
 * Wraps given function to object acting as calIGenericOperationListener
 *
 * @param {Function} onResult
 * @returns {calIGenericOperationListener}
 */
cal3e.createOperationListener = function
cal3eCreateOperationListener(onResult) {
  return {
    QueryInterface: XPCOMUtils.generateQI([
      Ci.calIGenericOperationListener
    ]),

    onResult: onResult
  };
}

/**
 * Debugging object with methods heavily inspired by ddump function
 * from session roaming extension.
 */
cal3e.Debug = {};
cal3e.Debug.enable = true;
cal3e.Debug.dump = function Debug_dump(text) {
  if (this.enable) {
    dump(text + "\n");
  }
}
cal3e.Debug.dumpObject = function Debug_dumpObject(obj, name, maxDepth,
                                                   curDepth) {
  if (!this.enable) {
    return;
  }
  if (curDepth == undefined) {
    curDepth = 0;
  }
  if (maxDepth != undefined && curDepth > maxDepth) {
    return;
  }

  var i = 0;
  for (prop in obj) {
    i++;
    if (typeof(obj[prop]) == "object") {
      if (obj[prop] && obj[prop].length != undefined) {
        this.dump(name + "." + prop + "=[probably array, length "
                  + obj[prop].length + "]");
      } else {
        this.dump(name + "." + prop + "=[" + typeof(obj[prop]) + "]");
      }
      this.dumpObject(obj[prop], name + "." + prop, maxDepth, curDepth+1);
    } else if (typeof(obj[prop]) == "function") {
      this.dump(name + "." + prop + "=[function]");
    } else {
      this.dump(name + "." + prop + "=" + obj[prop]);
    }
  }
  if (!i) {
    this.dump(name + " is empty");
  }
}
