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

Components.utils.import('resource://calendar3e/modules/utils.jsm');
Components.utils.import('resource://calendar3e/modules/object.jsm');

function cal3eEnable() {

  function getName() {
    return 'enable3e';
  }
  cal3eObject.exportProperty(this, 'name', getName);

  function getChromePackageName() {
    return 'calendar3e';
  }
  cal3eObject.exportProperty(this, 'chromePackageName', getChromePackageName);

  function showPanel(server) {
    return cal3eUtils.isSupportedServer(server);
  }
  cal3eObject.exportMethod(this, showPanel);

};

const NSGetFactory = cal3eObject.asXpcom(cal3eEnable, {
  classID: Components.ID('{3892b01b-7e8f-4727-9087-ef4d814f7456}'),
  contractID: '@mozilla.org/accountmanager/extension;1?name=enable3e',
  classDescription: 'Enable 3e calendar - Account Manager Extension',
  interfaces: [Components.interfaces.nsIMsgAccountManagerExtension]
}, [
  'mailnews-accountmanager-extensions'
]);
