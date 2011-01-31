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

Components.utils.import("resource://calendar3e/cal3eUtils.jsm");

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
 * Calendar synchronization provider.
 *
 * @todo parametrized timeout
 * @todo different interval for each account/client
 */
Calendar3e.Sync = function () {
  /**
   * Maps interval identifiers by identity.
   *
   * @type Object
   */
  this._intervalsByIdentity = {};

  /**
   * Maps EEE clients by identity.
   *
   * @type Object
   */
  this._clientsByIdentity = {};

  /**
   * Synchronizer of EEE calendars.
   *
   * @type calEeeISynchronizer
   */
  this._synchronizer = Cc["@zonio.net/calendar3e/synchronizer;1"].
    createInstance(Ci.calEeeISynchronizer);

  /**
   * Collection of account dynamically notifying of changes in
   * accounts settings.
   *
   * @type cal3e.AccountCollection
   */
  this._accountCollection = new cal3e.AccountCollection();
  this._accountCollection.addObserver(this);
  this.onAccountsChange(this._accountCollection);
}

Calendar3e.Sync.prototype = {

  /**
   * Adds or removes identities according to state of account
   * collection.
   *
   * @param {cal3e.AccountCollection} accountCollection
   */
  onAccountsChange: function cal3eSync_onAccountsChange(accountCollection) {
    var knownIdentities = {};
    var identityKey;
    for (identityKey in this._intervalsByIdentity) {
      knownIdentities[identityKey] = true;
    }

    var identities = accountCollection.
      filter(cal3e.AccountCollection.filterEnabled).
      map(function cal3eSync_mapAccountsToIdentities(account) {
        return account.defaultIdentity;
      }).
      filter(function cal3esync_filterUnknownIdentities(identity) {
        return !knownIdentities[identity.key];
      });
    var identity;
    for each (identity in identities) {
      this._addIdentity(identity);
      delete knownIdentities[identity.key];
    }

    var identityKey;
    for (identityKey in knownIdentities) {
      this._removeIdentity(identityKey);
    }
  },

  /**
   * Creates new client and sets synchronization interval.
   *
   * @param {nsIMsgIdentity} identity
   */
  _addIdentity: function cal3eSync_addIdentity(identity) {
    this._clientsByIdentity[identity.key] =
      Cc["@zonio.net/calendar3e/client;1"].createInstance(Ci.calEeeIClient);
    this._clientsByIdentity[identity.key].identity = identity;

    var cal3eSync = this;
    this._intervalsByIdentity[identity.key] =
      window.setInterval(function cal3eSync_callSynchronize() {
        cal3eSync._synchronizer.synchronize(
          cal3eSync._clientsByIdentity[identity.key]);
      }, 15000);
  },

  /**
   * Clears sycnrhonization interval and client created for given
   * identity key.
   *
   * @param {Number} identityKey
   */
  _removeIdentity: function cal3eSync_removeIdentity(identityKey) {
    window.clearInterval(this._intervalsByIdentity[identityKey]);
    delete this._intervalsByIdentity[identityKey];
    delete this._clientsByIdentity[identityKey];
  }

}

var cal3eSync;
Calendar3e.Sync.onLoad = function () {
  cal3eSync = new Calendar3e.Sync();
}

window.addEventListener('load', Calendar3e.Sync.onLoad, false);
