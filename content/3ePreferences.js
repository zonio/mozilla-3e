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
  tree.addEventListener('change', function (evt) {
      calPrefs._eeeEnabledDidChange(evt);
    }, false);
  for each (var account in this._accounts) {
    var identity = account.defaultIdentity;

    var accountName = document.createElement('treecell');
    accountName.setAttribute('value', identity.key);
    accountName.setAttribute('label', identity.identityName);
    accountName.setAttribute('editable', 'false');
    var accountEnabled = document.createElement('treecell'),
        enabled = identity.getBoolAttribute(this.constructor.EEE_ENABLED_KEY);
    accountEnabled.setAttribute('value', enabled ? 'true' : 'false');
    var treerow = document.createElement('treerow');
    treerow.appendChild(accountName);
    treerow.appendChild(accountEnabled);
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
  if (('treecell' != enabledCell.tagName) &&
      ('checkbox' != enabledCell.getAttribute('type'))) {
    return;
  }
  var enabled = 'true' === enabledCell.getAttribute('value') ? true : false ;

  var identityCell = enabledCell.previousSibling,
      mgr = this._accountsManager,
      identity = mgr.getIdentity(identityCell.getAttribute('value'));
  identity.setBoolAttribute(this.constructor.EEE_ENABLED_KEY, enabled);
}

Calendar3e.Preferences.onLoad = function onLoad() {
  var prefs = new Calendar3e.Preferences();
}

window.addEventListener('load', Calendar3e.Preferences.onLoad, false);
