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

if ('undefined' === typeof Calendar3e) {
  var Calendar3e = {};
}

Calendar3e.Preferences = function () {
  this.initialize();
}
Calendar3e.Preferences.EEE_ENABLED_KEY = 'eee_enabled';
var CalPrefs = Calendar3e.Preferences.prototype;
/**
 * Initializes 3e calendar prefences.
 */
CalPrefs.initialize = function () {
  var console = Cc["@mozilla.org/consoleservice;1"].getService(
      Ci.nsIConsoleService
    );
  this._console = console;

  var mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                      .getService(Ci.nsIMsgAccountManager);
  mgr.addIncomingServerListener(this);
  this._accountsManager = mgr;

  this._accountsDidChange();
}
CalPrefs.destroy = function () {
  this._accountsManager.removeIncomingServerListener(this);
  this._accountsManager = null;
}
CalPrefs.onServerLoaded = function (server) {
  this._accountsDidChange();
}
CalPrefs.onServerUnloaded = function (server) {
}
CalPrefs.onServerChanged = function (server) {}
/**
 * Loads remote accounts, creates properties according to them
 * and fills the UI with them.
 */
CalPrefs._accountsDidChange = function () {
  this._loadAccounts();
  this._fillAccountsTable();
}
/**
 * Loads accounts currently registred in Thunderbird.
 */
CalPrefs._loadAccounts = function () {
  var mgr = this._accountsManager;

  var accounts = [
    a for each (a in fixIterator(mgr.accounts, Ci.nsIMsgAccount))
  ];
  //XXX incomingServer server check due to 41133
  accounts = accounts.filter(function (a) {
      return a.incomingServer && (a.incomingServer.type != "nntp")
                              && (a.incomingServer.type != "none");
    });

  function sortAccounts(a, b) {
    if (a.key == mgr.defaultAccount.key)
      return -1;
    if (b.key == mgr.defaultAccount.key)
      return  1;
    return 0;
  }
  accounts.sort(sortAccounts);
  this._accounts = accounts;
}
/**
 * Fills the UI with loaded accounts' default identities..
 *
 * Also registers handling to catch changes when user enables
 * or diaables 3e abbilities with particular identity.
 */
CalPrefs._fillAccountsTable = function () {
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
  for each (var account in this._accounts) {
    var identity = account.defaultIdentity;

    var identityName = document.createElement('treecell');
    identityName.setAttribute('value', identity.key);
    identityName.setAttribute('label', identity.identityName);
    var identityEnabled = document.createElement('treecell'),
        enabled = identity.getBoolAttribute(this.constructor.EEE_ENABLED_KEY);
    identityEnabled.setAttribute(
        'properties',
        enabled ? 'enabled' : 'not-enabled'
      );
    var treerow = document.createElement('treerow');
    treerow.appendChild(identityName);
    treerow.appendChild(identityEnabled);
    var treeitem = document.createElement('treeitem');
    treeitem.appendChild(treerow);
    tree.appendChild(treeitem);
  }
}
/**
 * Enables or disables 3e support for identity associated with
 * event's target (checkbox cell in tree).
 *
 * @param {Event} evt 
 * @private
 */
CalPrefs._eeeEnabledDidChange = function (evt) {
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
  var identityKey = treeView.getCellValue(row.value, identityNameColumn),
      mgr = this._accountsManager,
      identity = mgr.getIdentity(identityKey);

  var enabled = !identity.getBoolAttribute(this.constructor.EEE_ENABLED_KEY);
  treeView.setCellValue(row.value, identityNameColumn.getNext(), 'true');
  identity.setBoolAttribute(this.constructor.EEE_ENABLED_KEY, enabled);
}

Calendar3e.Preferences.onLoad = function onLoad() {
  var prefs = new Calendar3e.Preferences();
}

window.addEventListener('load', Calendar3e.Preferences.onLoad, false);
