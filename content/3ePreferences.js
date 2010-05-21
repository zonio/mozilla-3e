Components.utils.import("resource://gre/modules/iteratorUtils.jsm");

if ('undefined' === typeof Calendar3e) {
  var Calendar3e = {};
}

Calendar3e.Preferences = function createObject() {
  this.initialize();
}
var CalPrefs = Calendar3e.Preferences.prototype;
/**
 * Initializes 3e calendar prefences.
 */
CalPrefs.initialize = function initialize() {
  var mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                      .getService(Components.interfaces.nsIMsgAccountManager);
  mgr.addIncomingServerListener(this);
  this._accountsManager = mgr;

  this._loadAccounts();
  this._fillAccountTable();
}
CalPrefs.destroy = function destroy() {
  this._accountsManager.removeIncomingServerListener(this);
  this._accountsManager = null;
}
CalPrefs.onServerLoaded = function at_onServerLoaded(aServer) {
  this._loadAccounts();
  this._fillAccountTable();
},
CalPrefs.onServerUnloaded = function at_onServerUnloaded(aServer) {
  this._loadAccounts();
  this._fillAccountTable();
},
CalPrefs.onServerChanged = function at_onServerChanged(aServer) {},
/**
 * Loads accounts currently registred in Thunderbird.
 */
CalPrefs._loadAccounts = function () {
  var mgr = this._accountsManager;

  var accounts = [
    a for each (a in fixIterator(mgr.accounts,
                                 Components.interfaces.nsIMsgAccount))
  ];
  //XXX incomingServer server check due to 41133
  accounts = accounts.filter(function fix(a) {
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
 * Fills the UI with loaded accounts.
 */
CalPrefs._fillAccountTable = function() {
  var tree = document.getElementById('cal3e-accounts-tree-children');
  while (tree.firstChild) {
    tree.removeChild(tree.firstChild);
  }
  for each (var account in this._accounts) {
    let server = account.incomingServer;
    var accountName = document.createElement('treecell');
    accountName.setAttribute('label', server.rootFolder.prettyName);
    var accountEnabled = document.createElement('treecell');
    accountEnabled.setAttribute('value', 'false');
    var treerow = document.createElement('treerow');
    treerow.appendChild(accountName);
    treerow.appendChild(accountEnabled);
    var treeitem = document.createElement('treeitem');
    treeitem.appendChild(treerow);
    tree.appendChild(treeitem);
  }
}

Calendar3e.Preferences.onLoad = function onLoad() {
  new Calendar3e.Preferences();
}

window.addEventListener('load', Calendar3e.Preferences.onLoad, false);
