/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2013  Zonio s.r.o.
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
Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

function ChannelCallbacks(repeatCall, onError, context, window, logger) {
  var channelCallbacks = this;
  var badCertListener;

  function getInterface(iid, result) {
    if (!iid.equals(Components.interfaces.nsIBadCertListener2)) {
      throw Components.Exception(
        'Given interface is not supported',
        Components.results.NS_ERROR_NO_INTERFACE
      );
    }

    return badCertListener;
  }

  function isActive() {
    return badCertListener.isActive();
  }

  function init() {
    badCertListener = new BadCertListener(
      repeatCall, onError, context, window, logger
    );
  }

  channelCallbacks.QueryInterface = XPCOMUtils.generateQI([
    Components.interfaces.nsIInterfaceRequestor
  ]);
  channelCallbacks.getInterface = getInterface;
  channelCallbacks.isActive = isActive;

  init();
}

function BadCertListener(repeatCall, onError, context, window, logger) {
  var badCertListener = this;
  var active;

  function notifyCertProblem(socketInfo, status, targetSite) {
    logger.warn('Certificate problem when calling server ' +
                '"' + targetSite + '"');

    active = true;
    window.setTimeout(function() {
      showBadCertDialogAndRetryCall({
        'exceptionAdded': false,
        'prefetchCert': true,
        'location': targetSite
      });
    }, 0);
  }

  function showBadCertDialogAndRetryCall(parameters) {
    window.openDialog(
      'chrome://pippki/content/exceptionDialog.xul',
      '',
      'chrome,centerscreen,modal',
      parameters
    );

    active = false;
    if (parameters['exceptionAdded']) {
      logger.info('Repeating call to server "' + parameters['location'] + '"');
      repeatCall(context);
    } else {
      logger.error('Call to untrusted server ' +
                   '"' + parameters['location'] + '"');
      onError(Components.Exception(
        'Server certificate exception not added',
        Components.results.NS_ERROR_FAILURE
      ), context);
    }
  }

  function isActive() {
    return active;
  }

  function init() {
    if (!window) {
      window = Services.wm.getMostRecentWindow(null);
    }
    active = false;
  }

  badCertListener.QueryInterface = XPCOMUtils.generateQI([
    Components.interfaces.nsIInterfaceRequestor
  ]);
  badCertListener.notifyCertProblem = notifyCertProblem;
  badCertListener.isActive = isActive;

  init();
}

var cal3eHttp = {
  ChannelCallbacks: ChannelCallbacks
};
EXPORTED_SYMBOLS = [
  'cal3eHttp'
];
