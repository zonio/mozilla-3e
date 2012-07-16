/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2011  Zonio s.r.o.
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

function calendarSubscription() {
  this._client = Cc["@zonio.net/calendar3e/client-service;1"].
    getService(Components.interfaces.calEeeIClient);
  this._accountCollection = new cal3e.AccountCollection();
  this._accountCollection.addObserver(this);
  this._accountManager = Cc["@mozilla.org/messenger/account-manager;1"].
    getService(Components.interfaces.nsIMsgAccountManager);
  this._stringBundle = document.getElementById('calendar3e-strings');
  this._subscriberElement = document.getElementById('subscriber-menulist');
  this._providerMap = {};
  this._providerToTreeItemMap = {};

  this._accountCollection.notify();
  this.load();
}

calendarSubscription.LOADING = 0x0100;
calendarSubscription.BROWSING = 0x0200;
calendarSubscription.ERROR = 0xfe00;

calendarSubscription.prototype = {

  getIdentity: function calendarSubscription_getIdentity() {
    return this._subscriberElement.value ?
      this._accountManager.getIdentity(this._subscriberElement.value) :
      null ;
  },

  load: function calendarSubscription_load() {
    this._state = calendarSubscription.LOADING;
    this.loadProviders();
    this.loadCalendars();
  },

  browse: function calendarSubscription_browse() {
    this._state = calendarSubscription.BROWSING;
  },

  error: function calendarSubscription_error() {
    this._state = calendarSubscription.ERROR;
  },

  loadProviders: function calendarSubscription_loadProviders() {
    var identity = this.getIdentity();
    if (null === identity) {
      this._addItemToMenu(
        this._providerElement,
        [this._stringBundle.getString(
          'cal3eCalendarProperties.providers.selectContextLabel'),
         null],
        true);
      return;
    }

    this._addItemToMenu(
      this._providerElement,
      [this._stringBundle.getString(
        'cal3eCalendarProperties.providers.loadingLabel'),
       null],
      true);
    var calendarSubscription = this;
    var listener = cal3e.createOperationListener(
      function calEee_adoptItem_onResult(methodQueue, result) {
        if (methodQueue.isPending) {
          return;
        }
        if (Cr.NS_OK !== methodQueue.status) {
          this._addItemToMenu(
            this._providerElement,
            [this._stringBundle.getString(
              'cal3eCalendarProperties.providers.errorLabel'),
             null],
            true);
          return;
        }
        calendarSubscription.onProvidersLoaded(
          calendarSubscription._buildProviders(result));
      });
    this._client.getUsers(identity, listener,
                          "NOT match_username(" + identity.email + ") AND " +
                          "NOT match_user_alias(" + identity.email + ")");
  },

  loadCalendar: function calendarSubscription_loadCalendar() {
  },

  onAccountsChange: function calendarSubscription_onAccountsChange() {
    var selectedIdentity = this._subscriberElement.value;
    this._clearMenu(this._subscriberElement);

    var subscribers = this._accountCollection.filter(
      cal3e.AccountCollection.filterEnabled);
    var idx = subscribers.length;
    var account, identity, item;
    while (idx--) {
      account = subscribers[idx];
      identity = account.defaultIdentity;
      item = this._subscriberElement.appendItem(
        identity.fullName + " <" + identity.email + ">",
        identity.key);

      if (identity.key == selectedIdentity) {
        this._subscriberElement.selectedItem = item;
      }
    }
  },

  onProvidersLoaded:
  function calendarSubscription_onProvidersLoaded(providers) {
    this._clearMenu(this._providerElement);
    providers.forEach(function (provider) {
      this._addItemToTree(this._providerElement, provider, false);
    }, this);
  },

  _addItemToMenu:
  function calendarSubscription_addItemToMenu(menu, item, clear) {
    if ('menupopup' != menu.tagName) {
      menu = menu.firstChild;
      while (menu && ('menupopup' !== menu.tagName)) {
        menu = menu.nextSibling;
      }
    }
    if (!menu || ('menupopup' != menu.tagName)) {
      throw Components.Exception("Cannot find menupopup.");
    }
    if (clear) {
      this._clearMenu(menu);
    }
    menu = menu.parentNode.appendItem.apply(menu.parentNode, item);
  },

  _clearMenu:
  function calendarSubscription_clearMenu(menu) {
    if ('menupopup' != menu.tagName) {
      menu = menu.firstChild;
      while (menu && ('menupopup' !== menu.tagName)) {
        menu = menu.nextSibling;
      }
    }
    if (!menu || ('menupopup' != menu.tagName)) {
      throw Components.Exception("Cannot find menupopup.");
    }
    while (menu.lastChild) {
      menu.removeChild(menu.lastChild);
    }
  },

  _addItemToTree:
  function calendarSubscription_addItemToTree(tree, item, parent) {
    if ('treechildren' != tree.tagName) {
      tree = tree.firstChild;
      while (tree && ('treechildren' !== tree.tagName)) {
        tree = tree.nextSibling;
      }
    }
    if (!tree || ('treechildren' != tree.tagName)) {
      throw Components.Exception("Cannot find treechildren.");
    }
  },

  _clearTree:
  function calendarSubscription_clearTree(tree) {
    if ('treechildren' != tree.tagName) {
      tree = tree.firstChild;
      while (tree && ('treechildren' !== tree.tagName)) {
        tree = tree.nextSibling;
      }
    }
    if (!tree || ('treechildren' != tree.tagName)) {
      throw Components.Exception("Cannot find treechildren.");
    }
    while (tree.lastChild) {
      tree.removeChild(tree.lastChild);
    }
  },

  _buildProviders:
  function calendarSubscription_buildProviders(rawProviders) {
    var providers = [];
    var rawProviders = result.QueryInterface(
      Components.interfaces.nsISupportsArray
    );
    var idx = rawProviders.Count(), rawProvider, uri;
    while (idx--) {
      providers.push(this._buildProvider(rawProviders.GetElementAt(idx)));
    }

    return providers;
  },

  _buildProvider: function calendarSubscription_buildProvider(rawProvider) {
    var provider = [];
    rawProvider = rawProvider.QueryInterface(
      Components.interfaces.nsIDictionary
    );

    var username = rawProvider.getValue('username').
      QueryInterface(Components.interfaces.nsISupportsCString);
    var realname = null;
    if (rawProvider.hasKey('attrs')) {
      var rawAttrs = rawProvider.getKey('attrs').
        QueryInterface(Components.interfaces.nsISupportsArray);
      let idx = rawAttrs.Count(), rawAttr;
      while (idx--) {
        rawAttr = rawAttr.QueryElementAt(
          idx, Components.interfaces.nsIDictionary
        );
        if ('realname' != rawAttr.getValue('name')) {
          continue;
        }
        var realname = rawAttr.getValue('value').
          QueryInterface(Components.interfaces.nsISupportsCString);
      }
    }
    if (null !== realname) {
      provider.push(realname + "<" + username + ">");
    } else {
      provider.push(username);
    }
    provider.push(username);

    return provider;
  },

  finalize: function calendarSubscription_finalize() {
    this._accountCollection.removeObserver(this);
  }

}


var subscribeDialog;
calendarSubscription.open = function () {
  openDialog("chrome://calendar3e/content/calendarSubscription.xul",
             "cal3eSubscription", "chrome,titlebar,modal,resizable");
}
calendarSubscription.onLoad = function () {
  subscribeDialog = new calendarSubscription();
}
calendarSubscription.onAccept = function () {
  subscribeDialog.store();

  return true;
}
calendarSubscription.onUnload = function () {
  subscribeDialog.finalize();
  subscribeDialog = null;
}
