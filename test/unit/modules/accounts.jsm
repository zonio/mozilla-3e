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

Components.utils.import("resource://gre/modules/Services.jsm");

/**
 * Creates a trinity: account, incoming server and identity.
 *
 * They're created in the same order as account wizard creates them.
 * 1. Creates incoming server, in our case POP3
 * 2. Creates account
 * 3. Creates identity
 * 4. Adds identity to account
 * 5. Sets default identity on account
 * 6. Marks server as invalid
 * 7. Sets incoming server to account
 * 8. Marks server as valid
 *
 * @returns {nsIMsgAccount}
 */
function createSupportedAccount() {
  var account, server, identity;
  var accountManager = Components.classes[
    "@mozilla.org/messenger/account-manager;1"
  ].getService(Components.interfaces.nsIMsgAccountManager);

  server = accountManager.createIncomingServer("test", "example.com", "pop3");
  account = accountManager.createAccount();
  identity = accountManager.createIdentity();
  account.addIdentity(identity);
  account.defaultIdentity = identity;
  server.valid = false;
  account.incomingServer = server;
  server.valid = true;

  return account;
}

/**
 * Removes given account.
 *
 * @param {nsIMsgAccount} account
 */
function removeAccount(account) {
  var accountManager = Components.classes[
    "@mozilla.org/messenger/account-manager;1"
  ].getService(Components.interfaces.nsIMsgAccountManager);

  accountManager.removeAccount(account);
}

var test3eAccounts = {
  "createSupportedAccount": createSupportedAccount,
  "removeAccount": removeAccount
};
EXPORTED_SYMBOLS = [
  'test3eAccounts'
];
