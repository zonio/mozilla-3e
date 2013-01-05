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

Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://calendar3e/modules/object.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function calEeeProtocol() {

  function getScheme() {
    return 'eee';
  }
  cal3eObject.exportProperty(this, 'scheme', getScheme);

  function getDefaultPort() {
    return 4444;
  }
  cal3eObject.exportProperty(this, 'defaultPort', getDefaultPort);

  function getProtocolFlags() {
    return Components.interfaces.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE |
      Components.interfaces.nsIProtocolHandler.URI_NORELATIVE |
      Components.interfaces.nsIProtocolHandler.URI_NOAUTH;
  }
  cal3eObject.exportProperty(this, 'protocolFlags', getProtocolFlags);

  function newURI(spec, charset, baseUri) {
    var uri = Components.classes['@mozilla.org/network/standard-url;1']
      .createInstance(Components.interfaces.nsIStandardURL);
    //TODO some checks?
    uri.init(
      Components.interfaces.nsIStandardURL.URLTYPE_STANDARD,
      getDefaultPort(),
      spec,
      charset,
      baseUri
    );

    return uri;
  }
  cal3eObject.exportMethod(this, newURI);

  function newChannel(uri) {
    if (!checkAttachUri(uri)) {
      throw Components.Exception('Only attachment URLs are supported');
    }

    return Services.io.newChannel(
      cal3eUtils.eeeAttachmentToHttpUri(uri).spec, null, null
    );
  }
  cal3eObject.exportMethod(this, newURI);

  function checkAttachUri(uri) {
    return (uri.spec.split('/').length === 6) &&
      (uri.spec.split('/')[3] === 'attach');
  }

  function allowPort(port, scheme) {
    return httpProtocol.allowPort(port, scheme);
  }
  cal3eObject.exportMethod(this, allowPort);

}

const NSGetFactory = cal3eObject.asXpcom(calEeeProtocol, {
  classID: Components.ID('{a9ffc806-c8e1-4feb-84c9-d748bc5e34f3}'),
  contractID: '@mozilla.org/network/protocol;1?name=eee',
  classDescription: 'EEE protocol handler',
  interfaces: [Components.interfaces.nsIProtocolHandler]
});
