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
Components.utils.import("resource://calendar3e/modules/utils.jsm");

var EEE_ENABLED_KEY = 'eee_enabled';

/**
 * Checks whether account can possibly become EEE account.
 *
 * @returns {Boolean}
 */
function isSupportedAccount(account) {
  return account.incomingServer &&
    cal3eUtils.isSupportedServer(account.incomingServer);
}

/**
 * Returns all accounts (including those not supporting EEE).
 *
 * @return {Array}
 */
function getAccounts() {
  return toArray(fixIterator(
    Components.classes["@mozilla.org/messenger/account-manager;1"].
      getService(Components.interfaces.nsIMsgAccountManager).
      accounts,
    Components.interfaces.nsIMsgAccount
  ));
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
   * Loads all accounts, filters supported ones, sorts them and
   * retrieves all identities.
   */
  function getAllIdentities() {
    return getAccounts().
      filter(isSupportedAccount).
      sort(sortAccounts).
      map(getIdentityFromAccount);
  }

  /**
   * Applies callback on each identity.
   *
   * It works in the same way as standard JavaScript Array#forEach
   * except it returns itself, so fluent API is supported.
   *
   * @returns {Array}
   */
  function forEach(callback, context) {
    var identities = getIdentitiesFromContext(this);
    Array.prototype.forEach.apply(identities, arguments);

    return extendArray(identities);
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
      Array.prototype.filter.apply(getIdentitiesFromContext(this), arguments)
    );
  }

  /**
   * Creates single value from a collection of identities.
   *
   * It works in the same way as standard JavaScript Array#reduce.
   *
   * @returns {Object}
   */
  function reduce(callback, initial) {
    return Array.prototype.reduce.apply(
      getIdentitiesFromContext(this), arguments
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
   * Returns identities which are EEE disabled only.
   *
   * @return {Array}
   */
  function getDisabled() {
    return filter.call(this, function(identity) {
      return !identity.getBoolAttribute(EEE_ENABLED_KEY);
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

  function hasOnlyOne() {
    var found = false;
    var onlyOne = false;
    filter.call(this, function(identity) {
      if (!found) {
        found = true;
        onlyOne = true;
      } else {
        onlyOne = false;
      }
    });

    return onlyOne;
  }

  /**
   * Extends array which is result of forEach and filter calls with
   * our custom filters.
   *
   * @param {nsIMsgIdentity[]} array
   * @return {nsIMsgIdentity[]}
   */
  function extendArray(array) {
    array.forEach = forEach;
    array.filter = filter;
    array.getEnabled = getEnabled;
    array.getDisabled = getDisabled;
    array.findByEmail = findByEmail;
    array.hasOnlyOne = hasOnlyOne;

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
      reduce: reduce,
      getEnabled: getEnabled,
      getDisabled: getDisabled,
      findByEmail: findByEmail,
      hasOnlyOne: hasOnlyOne
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
  var PREF_BRANCH = "mail.identity.";
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
   */
  function notify() {
    observers.forEach(function(observer) {
      observer();
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
    prefObserver = PrefObserver(
      notify, new RegExp("^[^.]+\\\." + EEE_ENABLED_KEY + "$")
    );

    accountManager = Components.classes[
      "@mozilla.org/messenger/account-manager;1"
    ].getService(Components.interfaces.nsIMsgAccountManager) ;
    accountManager.addIncomingServerListener(
      accountObserver.getServerListener()
    );

    prefBranch = Services.prefs.getBranch(
      PREF_BRANCH
    ).QueryInterface(Components.interfaces.nsIPrefBranch2);
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
   * This object can't be used after this call.
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
    accountObserver.destroy();
    accountObserver = null;
  }

  return init();
}

/**
 * Returns an object able to create nsIIncomingServerListener.
 *
 * It will call notify function if it registers deletion of of
 * supported account ({@link isSupportedAccount}).
 *
 * Internally, it uses a combination of incoming server listener which
 * needs to be attached by a client to the account manager and
 * preferences observing to keep track of supported accounts and their
 * incoming servers.  That's because when account is deleted, the only
 * clue we can get incoming server unload "event" and at that time we
 * can't get account which owned the server.
 *
 * You must manually call {@link destroy} on returned object otherwise
 * you risk memory leaks.
 *
 * @param {Function} notify
 * @returns {Object}
 */
function AccountObserver(notify) {
  var accountManager;
  var prefBranch;
  var prefObserver;
  var serverToAccount;

  /**
   * Updates server to account map.
   *
   * It maps accounts by their incoming server key.  Only supported
   * accounts are used.
   */
  function updateServerToAccountMap() {
    serverToAccount = {};

    getAccounts().
      filter(isSupportedAccount).
      forEach(function(account) {
        serverToAccount[account.incomingServer.key] = account;
      });
  }

  /**
   * Checks whather given server was owned by supported account.
   *
   * @returns {Boolean}
   */
  function hadSupportedAccount(server) {
    return serverToAccount.hasOwnProperty(server.key);
  }

  /**
   * Builds an incoming server listener.
   *
   * It observer mainly server unloaded "event" which triggers notify
   * function if unloaded server belonged to supported account.  Other
   * events trigger {@link updateServerToAccountMap} just in case.
   *
   * @returns {nsIIncomingServerListener}
   */
  function getServerListener() {
    return {
      "QueryInterface": XPCOMUtils.generateQI([
        Components.interfaces.nsIIncomingServerListener
      ]),
      "onServerLoaded": function(server) {
        updateServerToAccountMap();
        if (!hadSupportedAccount(server)) {
          return;
        }

        notify();
      },
      "onServerUnloaded": function(server) {
        if (!hadSupportedAccount(server)) {
          return;
        }

        updateServerToAccountMap();
        notify();
      },
      "onServerChanged": updateServerToAccountMap
    };
  }

  /**
   * Registers observers of global state which can affect internal
   * state.
   *
   * It registeres observer on preference branch.
   */
  function init() {
    prefObserver = PrefObserver(
      updateServerToAccountMap, /^[^.]+\.server$/
    );

    accountManager = Components.classes[
      "@mozilla.org/messenger/account-manager;1"
    ].getService(Components.interfaces.nsIMsgAccountManager);

    prefBranch = Services.prefs.getBranch(
      "mail.account."
    ).QueryInterface(Components.interfaces.nsIPrefBranch2);
    prefBranch.addObserver("", prefObserver, false);

    updateServerToAccountMap();

    return {
      getServerListener: getServerListener,
      destroy: destroy
    };
  }

  /**
   * Removes all observers registered by {@link init}
   * and cleans up after init.
   *
   * This object can't be used after this call.
   */
  function destroy() {
    delete this.getServerListener;
    delete this.destroy;

    prefBranch.removeObserver("", prefObserver);
    prefBranch = null;

    accountManager = null;

    prefObserver = null;

    serverToAccount = null;
  }

  return init();
}

/**
 * Returns convenient preferences observer acting as nsIObserver.
 *
 * It will call notify function on every change it receives a
 * preference branch that matches given regular expression.  The
 * notify function has no arguments.
 *
 * @param {Function} notify
 * @param {RegExp} regExp
 * @returns {nsIObserver}
 */
function PrefObserver(notify, regExp) {
  var accountManager = Components.classes[
    "@mozilla.org/messenger/account-manager;1"
  ].getService(Components.interfaces.nsIMsgAccountManager);

  return {
    "QueryInterface": XPCOMUtils.generateQI([
      Components.interfaces.nsIObserver
    ]),
    "observe": function(prefBranch, topic, prefName) {
      if ((topic !== "nsPref:changed") || !prefName.match(regExp)) {
        return;
      }

      notify();
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
