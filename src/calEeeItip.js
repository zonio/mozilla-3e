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


Components.utils.import('resource://calendar/modules/calUtils.jsm');
Components.utils.import('resource://calendar3e/modules/object.jsm');

function calEeeItip() {
  var senderAddress;

  function getScheme() {
      return 'mailto';
  }
  cal3eObject.exportProperty(this, 'scheme', getScheme);

  function getType() {
    return 'email';
  }
  cal3eObject.exportProperty(this, 'type', getType);

  function getSenderAddress() {
    return senderAddress;
  }
  function setSenderAddress(newSenderAddress) {
    senderAddress = newSenderAddress;
  }
  cal3eObject.exportProperty(this, 'senderAddress', getSenderAddress,
                                                    setSenderAddress);

  function sendItems(count, recipients, itipItem) {
    // Messages are sent by EEE server.
  }
  cal3eObject.exportMethod(this, sendItems);
}

const NSGetFactory = cal3eObject.asXpcom(calEeeItip, {
  classID: Components.ID('{ee2d0640-a786-4caf-ad54-1cc51f251ba8}'),
  contractID: '@zonio.net/calendar3e/itip;1',
  classDescription: 'EEE calendar iTIP',
  interfaces: [Components.interfaces.calIItipTransport]
});
