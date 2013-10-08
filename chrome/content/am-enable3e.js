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

Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');

function amEnable3e() {
  var identity;
  var element;

  this.onPreInit = function amEnable3e_onPreInit(account, accountValues) {
    identity = account.defaultIdentity;
    element = document.getElementById('cal3e-enable-checkbox');
    element.checked = getPersistedEnabledValue();
  }

  this.onSave = function amEnable3e_onSave() {
    ensureIsSafeToEnable();
    element.checked = getSafeEnabledValue();
    identity.setBoolAttribute(
      cal3eIdentity.EEE_ENABLED_KEY,
      getSafeEnabledValue()
    );
  }

  function ensureIsSafeToEnable() {
    if (!element.checked || isSafeNumberOfEnabled()) {
      return;
    }

    var bundle = Services.strings.createBundle(
      'chrome://calendar3e/locale/calendar3e.properties'
    );
    Services.prompt.alert(
      Services.wm.getMostRecentWindow(null),
      bundle.GetStringFromName('calendar3e.alertDialog.accountEnable.title'),
      bundle.formatStringFromName(
        'calendar3e.alertDialog.accountEnable.text',
        [identity.fullName + ' <' + identity.email + '>'],
        1
      )
    );
  }

  function isSafeNumberOfEnabled() {
    return cal3eIdentity.Collection()
      .getEnabled()
      .filter(function(filteredIdentity) {
        return (filteredIdentity.key !== identity.key) &&
          (getIdentityHostname(filteredIdentity) ===
           getIdentityHostname(identity));
      })
      .length <= 0;
  }

  function getPersistedEnabledValue() {
    return identity.getBoolAttribute(cal3eIdentity.EEE_ENABLED_KEY) || false;
  }

  function getSafeEnabledValue() {
    return element.checked && isSafeNumberOfEnabled();
  }

  function getIdentityHostname(identity) {
    return identity.email.substring(identity.email.indexOf('@') + 1);
  }

}

var onPreInit, onSave;

amEnable3e.onLoad = function () {
  var controller = new amEnable3e();
  onPreInit = controller.onPreInit;
  onSave = controller.onSave;

  parent.onPanelLoaded('am-enable3e.xul');
};
