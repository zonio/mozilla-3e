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

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var EEE_ENABLED_KEY = 'eee_enabled';

/**
 * Checks whether account can possibly become EEE account.
 *
 * @returns {Boolean}
 */
function isSupportedAccount(account) {
  return account.incomingServer &&
    ("nntp" != account.incomingServer.type) &&
    ("none" != account.incomingServer.type);
}

/**
 * Returns account's identity wchich will be used for EEE requests.
 *
 * @returns {nsIMsgIdentity}
 */
function getIdentityFromAccount(account) {
  return account.defaultIdentity;
}

/**
 * Helper to access account's EEE identities or identities that can
 * become EEE identities.
 *
 * @returns {Object}
 */
function Collection() {
  var accountManager;

  /**
   * Sorts accounts based on their key.
   *
   * @returns {Number}
   */
  function sortAccounts(a, b) {
    if (a.key == accountManager.defaultAccount.key) {
      return -1;
    }
    if (b.key == accountManager.defaultAccount.key) {
      return  1;
    }
    return 0;
  }

  /**
   * Returns all accounts (including those not supporting EEE).
   *
   * @return {Array}
   */
  function loadAccounts() {
    return [
      a for each (
        a in fixIterator(
          accountManager.accounts, Components.interfaces.nsIMsgAccount
        )
      )
    ];
  }

  /**
   * Loads all accounts, filters supported ones, sorts them and
   * retrieves all identities.
   */
  function getAllIdentities() {
    return loadAccounts().
      filter(isSupportedAccount).
      sort(sortAccounts).
      map(getIdentityFromAccount);
  }

  /**
   * Applies callback on each identity.
   *
   * It works in the same way as standard JavaScript Array#forEach.
   */
  function forEach(callback, context) {
    return extendArray(
      getIdentitiesFromContext(this).forEach(callback, context)
    );
  }

  /**
   * Applies callback on each identity and returns only those for
   * which callback returned true.
   *
   * It works in the same way as standard JavaScript Array#filter.
   *
   * @returns {Array}
   */
  function filter(callback, context) {
    return extendArray(
      getIdentitiesFromContext(this).filter(callback, context)
    );
  }

  /**
   * Returns identities which are EEE enabled only.
   *
   * @return {Array}
   */
  function getEnabled() {
    return filter.call(this, function(identity) {
      return identity.getBoolAttribute(EEE_ENABLED_KEY);
    });
  }

  /**
   * Returns identities which have given email.
   *
   * @return {Array}
   */
  function findByEmail(email) {
    return filter.call(this, function(identity) {
      return email === identity.email;
    });
  }

  /**
   * Extends array which is result of forEach and filter calls with
   * our custom filters.
   *
   * @param {nsIMsgIdentity[]} array
   * @return {nsIMsgIdentity[]}
   */
  function extendArray(array) {
    array.getEnabled = getEnabled;
    array.findByEmail = findByEmail;

    return array;
  }

  /**
   * Returns an array of identities based on given context.
   *
   * This is a helper for iterator methods like {@link forEach} which
   * can be called from array modified by {@link extendArray} or from
   * what {@link Collection} returns.
   *
   * @param {Array|Object} context this from iterator methods
   * @returns {nsIMsgIdentity[]}
   */
  function getIdentitiesFromContext(context) {
    return context instanceof Array ? context : getAllIdentities() ;
  }

  function init() {
    accountManager = Components.classes[
      "@mozilla.org/messenger/account-manager;1"
    ].getService(Components.interfaces.nsIMsgAccountManager);

    return {
      forEach: forEach,
      filter: filter,
      getEnabled: getEnabled,
      findByEmail: findByEmail
    };
  }

  return init();
}

/**
 * Observes changes on identities.
 *
 * This observer starts observing global state automatically so
 * there's no need to register it somewhere.  It can be observed
 * itself.  This way it acts as a convenient proxy that can notify in
 * a unified way whather there are any changes in identities.
 *
 * @returns {Object}
 */
function Observer() {
  var PREF_BRANCH = "mail.identity";
  var accountManager;
  var accountObserver;
  var prefBranch;
  var prefObserver;
  var observers;

  /**
   * Adds the observer that will be notified when there changes in
   * identities.
   *
   * @param {Function} observer receive one parameter {@link Change}
   */
  function addObserver(observer) {
    observers.push(observer);
  }

  /**
   * Removes the observer from the list of observers that gets
   * notified when identities change.
   *
   * @param {Function} observer function that was registered with
   * {@link addObserver}
   * @throws {Error} when observer not previously registered is
   * requested to remove
   */
  function removeObserver(observer) {
    var idx = observers.indexOf(observer);
    if (idx < 0) {
      throw new Error("Unknown observer to remove.");
    }

    observers.splice(idx, 1);
  }

  /**
   * Notifies all observer about change of certain identity.
   *
   * @param {String} type one of "create", "update", "delete"
   * @param {nsIMsgIdentity} identity
   */
  function notify(type, identity) {
    observers.forEach(function(observer) {
      observer(Change(type, identity));
    });
  }

  /**
   * Registers observers of global state which can affect identities.
   *
   * It registeres incoming server observer on account manager and
   * observer on preference branch.
   */
  function init() {
    accountObserver = AccountObserver(notify);
    prefObserver = PrefObserver(notify);

    accountManager = Components.classes[
      "@mozilla.org/messenger/account-manager;1"
    ].getService(Components.interfaces.nsIMsgAccountManager);
    accountManager.addIncomingServerListener(accountObserver);

    prefBranch = Services.prefs.getBranch(PREF_BRANCH).QueryInterface(
      Components.interfaces.nsIPrefBranch2
    );
    prefBranch.addObserver("", prefObserver, false);

    observers = [];

    return {
      addObserver: addObserver,
      removeObserver: removeObserver,
      destroy: destroy
    };
  }

  /**
   * Removes all observers and listeners registered by {@link init}
   * and cleans up after init.
   *
   * After call it, this object can't be used.
   */
  function destroy() {
    delete this.addObserver;
    delete this.removeObserver;
    delete this.destroy;

    observers.forEach(removeObserver);
    observers = null;

    prefBranch.removeObserver("", prefObserver);
    prefBranch = null;

    accountManager.removeIncomingServerListener(accountObserver);
    accountManager = null;

    prefObserver = null;
    accountObserver = null;
  }

  return init();
}

/**
 * Returns convenient observer acting as nsIIncomingServerListener.
 *
 * It will call notify function on every change it registers for any
 * server belonging to supported account ({@link isSupportedAccount}).
 * The notify function receives two parameters:
 * - {@link String} type: one of "create", "update", or "delete"
 * - {@link nsIMsgIdentity} identity: identity that can support EEE
 *   calendar of the account that changed
 *
 * @param {Function} notify
 * @returns {nsIIncomingServerListener}
 */
function AccountObserver(notify) {
  var accountManager = Components.classes[
    "@mozilla.org/messenger/account-manager;1"
  ].getService(Components.interfaces.nsIMsgAccountManager);

  return {
    "QueryInterface": XPCOMUtils.generateQI([
      Components.interfaces.nsIIncomingServerListener
    ]),
    "onServerLoaded": function(server) {
      if (isSupportedAccount(accountManager.FindAccountForServer(server))) {
        return;
      }

      notify(
        "create",
        getIdentityFromAccount(accountManager.FindAccountForServer(server))
      );
    },
    "onServerUnloaded": function(server) {
      if (isSupportedAccount(accountManager.FindAccountForServer(server))) {
        return;
      }

      notify(
        "delete",
        getIdentityFromAccount(accountManager.FindAccountForServer(server))
      );
    },
    "onServerChanged": function(server) {
      if (isSupportedAccount(accountManager.FindAccountForServer(server))) {
        return;
      }

      notify(
        "update",
        getIdentityFromAccount(accountManager.FindAccountForServer(server))
      );
    }
  }
}

/**
 * Returns convenient observer acting as nsIObserver.
 *
 * It will call notify function on every change it registers for any
 * identity which EEE enabled settings changed.
 * The notify function receives two parameters:
 * - {@link String} type: always "update"
 * - {@link nsIMsgIdentity} identity: identity that can support EEE
 *   calendar and changed
 *
 * @param {Function} notify
 * @returns {nsIObserver}
 */
function PrefObserver(notify) {
  var accountManager = Components.classes[
    "@mozilla.org/messenger/account-manager;1"
  ].getService(Components.interfaces.nsIMsgAccountManager);

  return {
    "QueryInterface": XPCOMUtils.generateQI([
      Components.interfaces.nsIObserver
    ]),
    "observe": function(prefBranch, topic, prefName) {
      if (topic !== "nsPref:changed") {
        return;
      }

      var parts = prefName.split(".");
      if ((parts[2] !== EEE_ENABLED_KEY) || (parts.length !== 3)) {
        return;
      }

      var identity = accountManager.getIdentity(parts[1]);
      if (!identity.getBoolAttribute(EEE_ENABLED_KEY)) {
        return;
      }

      notify("update", identity);
    }
  };
}

/**
 * Holds the type and the identity that was changed.
 */
function Change(type, identity) {
  Object.defineProperty(this, "type", {
    value: type
  });
  Object.defineProperty(this, "identity", {
    value: identity
  });
}

var cal3eIdentity = {
  "EEE_ENABLED_KEY": EEE_ENABLED_KEY,
  "Collection": Collection,
  "Observer": Observer
};
EXPORTED_SYMBOLS = [
  'cal3eIdentity'
];
