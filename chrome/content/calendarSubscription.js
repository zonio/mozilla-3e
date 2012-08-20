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

Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function cal3eSubscription() {
  var cal3eSubscription = this;
  var identityObserver;
  var accountManager;
  var stringBundle;
  var subscriberElement;

  function subscribe() {
  }

  function onIdentityChange() {
    clearMenu(subscriberElement);

    cal3eIdentity.Collection()
      .getEnabled()
      .forEach(function(identity) {
        var item = subscriberElement.appendItem(
          identity.fullName + ' <' + identity.email + '>',
          identity.key
        );

        if (identity.key == subscriberElement.value) {
          subscriberElement.selectedItem = item;
        }
      });
  }

  function loadProviders() {
    var identity = getIdentity();
    if (null === identity) {
      addItemToMenu(
        providerElement,
        [stringBundle.getString(
           'cal3eCalendarProperties.providers.selectContextLabel'
         ), null],
        true
      );
      return;
    }

    addItemToMenu(
      providerElement,
      [stringBundle.getString(
         'cal3eCalendarProperties.providers.loadingLabel'
       ), null],
      true
    );
    var listener = function calEee_adoptItem_onResult(methodQueue, result) {
      if (!(result instanceof cal3eResponse.Success)) {
        addItemToMenu(
          providerElement,
          [stringBundle.getString(
             'cal3eCalendarProperties.providers.errorLabel'
           ), null],
          true
        );
        return;
      }
      onProvidersLoaded(buildProviders(result));
    };
    cal3eRequest.Client.getInstance().getUsers(
      identity, listener,
      "NOT match_username('" + identity.email + "') AND " +
        "NOT match_user_alias('" + identity.email + "')"
    );
  }

  function onProvidersLoaded(providers) {
    clearMenu(providerElement);
    providers.forEach(function(provider) {
      addItemToTree(providerElement, provider, false);
    });
  }

  function buildProviders(result) {
    return result.data.map(function(rawProvider) {
      return buildProvider(rawProvider);
    });
  }

  function buildProvider(rawProvider) {
    var provider = [];
    var username = rawProvider['username'];
    var realname;
    if (rawProvider.hasOwnProperty('attrs')) {
      realname = rawProvider['attrs'].filter(function(rawAttr) {
        return rawAttr['name'] === 'realname';
      });
      if (realname.length > 0) {
        realname = realname[0]['value'];
      }
    }
    if (realname) {
      provider.push(realname + ' <' + username + '>');
    } else {
      provider.push(username);
    }
    provider.push(username);

    return provider;
  }

  function addItemToMenu(menu, item, clear) {
    if ('menupopup' != menu.tagName) {
      menu = menu.firstChild;
      while (menu && ('menupopup' !== menu.tagName)) {
        menu = menu.nextSibling;
      }
    }
    if (!menu || ('menupopup' != menu.tagName)) {
      throw Components.Exception('Cannot find menupopup.');
    }
    if (clear) {
      clearMenu(menu);
    }
    menu = menu.parentNode.appendItem.apply(menu.parentNode, item);
  }

  function clearMenu(menu) {
    if ('menupopup' != menu.tagName) {
      menu = menu.firstChild;
      while (menu && ('menupopup' !== menu.tagName)) {
        menu = menu.nextSibling;
      }
    }
    if (!menu || ('menupopup' != menu.tagName)) {
      throw Components.Exception('Cannot find menupopup.');
    }
    while (menu.lastChild) {
      menu.removeChild(menu.lastChild);
    }
  }

  function addItemToTree(tree, item, parent) {
    if ('treechildren' != tree.tagName) {
      tree = tree.firstChild;
      while (tree && ('treechildren' !== tree.tagName)) {
        tree = tree.nextSibling;
      }
    }
    if (!tree || ('treechildren' != tree.tagName)) {
      throw Components.Exception('Cannot find treechildren.');
    }
    //TODO append under parent
  }

  function clearTree(tree) {
    if ('treechildren' != tree.tagName) {
      tree = tree.firstChild;
      while (tree && ('treechildren' !== tree.tagName)) {
        tree = tree.nextSibling;
      }
    }
    if (!tree || ('treechildren' != tree.tagName)) {
      throw Components.Exception('Cannot find treechildren.');
    }
    while (tree.lastChild) {
      tree.removeChild(tree.lastChild);
    }
  }

  function getIdentity() {
    return subscriberElement.value ?
      accountManager.getIdentity(subscriberElement.value) :
      null;
  }

  function init() {
    identityObserver = cal3eIdentity.Observer();
    identityObserver.addObserver(onIdentityChange);
    accountManager = Components.classes[
      '@mozilla.org/messenger/account-manager;1'
    ].getService(Components.interfaces.nsIMsgAccountManager);
    stringBundle = document.getElementById('calendar3e-strings');
    subscriberElement = document.getElementById('subscriber-menulist');

    window.addEventListener('unload', finalize, false);
    window.addEventListener('dialogaccept', subscribe, false);

    onIdentityChange();
    loadProviders();
  }

  function finalize() {
    identityObserver.destroy();
    identityObserver = null;
  }

  init();
}

cal3eSubscription.open = function cal3eSubscription_open() {
  openDialog(
    'chrome://calendar3e/content/calendarSubscription.xul',
    'cal3eSubscription',
    'chrome,titlebar,modal,resizable'
  );
};
cal3eSubscription.onLoad = function cal3eSubscription_onLoad() {
  new cal3eSubscription();
};

window.addEventListener('load', cal3eSubscription.onLoad, false);
