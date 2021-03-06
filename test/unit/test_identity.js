/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2012 - 2013  Zonio s.r.o.
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
Components.utils.import("resource://test/modules/account.jsm");

function test_account_create() {
  var observer = cal3eIdentity.Observer();
  var account = test3eAccount.create();
  var counter = 0;

  observer.addObserver(function() {
    counter += 1;
  });

  account.defaultIdentity.setBoolAttribute(
    cal3eIdentity.EEE_ENABLED_KEY, false
  );
  do_check_eq(1, counter);

  test3eAccount.remove(account);
  observer.destroy();
}

function test_account_update() {
  var observer = cal3eIdentity.Observer();
  var account = test3eAccount.create();
  var counter = 0;

  account.defaultIdentity.setBoolAttribute(
    cal3eIdentity.EEE_ENABLED_KEY, false
  );

  observer.addObserver(function() {
    counter += 1;
  });

  account.defaultIdentity.setBoolAttribute(
    cal3eIdentity.EEE_ENABLED_KEY, true
  );
  account.defaultIdentity.setBoolAttribute(
    cal3eIdentity.EEE_ENABLED_KEY, false
  );
  do_check_eq(2, counter);

  test3eAccount.remove(account);
  observer.destroy();
}

function test_account_delete() {
  var observer = cal3eIdentity.Observer();
  var account = test3eAccount.create();
  var counter = 0;

  account.defaultIdentity.setBoolAttribute(
    cal3eIdentity.EEE_ENABLED_KEY, false
  );

  observer.addObserver(function() {
    counter += 1;
  });

  test3eAccount.remove(account);
  observer.destroy();

  do_check_eq(1, counter);
}

function test_account_create_during_observer_life() {
  var observer = cal3eIdentity.Observer();
  var counter = 0;
  observer.addObserver(function() {
    counter += 1;
  });

  var account = test3eAccount.create();

  observer.destroy();

  test3eAccount.remove(account);

  do_check_eq(1, counter);
}

function test_account_delete_during_observer_life() {
  var observer = cal3eIdentity.Observer();
  var counter = 0;
  observer.addObserver(function() {
    counter += 1;
  });

  var account = test3eAccount.create();
  test3eAccount.remove(account);

  observer.destroy();

  do_check_eq(2, counter);
}

function run_test() {
  test_account_create();
  test_account_update();
  test_account_delete();
  test_account_create_during_observer_life();
  test_account_delete_during_observer_life();
}
