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

Components.utils.import("resource://calendar3e/modules/identity.jsm");

function test_observer_pref_change() {
  var account, identity;
  var accountManager = Components.classes[
    "@mozilla.org/messenger/account-manager;1"
  ].getService(Components.interfaces.nsIMsgAccountManager);
  var observer = cal3eIdentity.Observer();

  observer.addObserver(function(change) {
    do_check_eq(change.type, "add");
    do_check_eq(change.identity, account.defaultIdentity);
  });

  account = accountManager.createAccount();
  accountManager.removeAccount(account);
}

function run_test() {
  test_observer_pref_change();
}
