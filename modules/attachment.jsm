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

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://calendar3e/modules/feature.jsm');
Components.utils.import('resource://calendar3e/modules/identity.jsm');
Components.utils.import('resource://calendar3e/modules/model.jsm');
Components.utils.import('resource://calendar3e/modules/request.jsm');
Components.utils.import('resource://calendar3e/modules/utils.jsm');

function saveAttachment(uri, window, calendar) {
  if (uri.indexOf('eee://') !== 0) {
    openAttachment();
    return;
  }

  var splittedUri = uri.split('/');
  var filename = decodeURIComponent(splittedUri[splittedUri.length - 1]);

  var file = saveAttachmentDialog(filename, window);
  if (!file) {
    return;
  }

  var listener = function(httpStatusCode, response) {
    dump('Attachment ' + uri + ' downloaded.\n');
    if (httpStatusCode != '200') {
      dump('Error\n');
      return;
    }

    var stream = Components.classes[
      '@mozilla.org/network/safe-file-output-stream;1'
    ].createInstance(Components.interfaces.nsIFileOutputStream);

    stream.init(file, 0x02 | 0x08 | 0x20, 384, 0); // readwrite, create, truncate

    var maxArgs = 65535;
    var processed = 0;
    while (processed < response.length) {
      var responseSlice = Array.prototype.slice.call(
        response, processed, processed + maxArgs);
      var dataSlice = String.fromCharCode.apply(String, responseSlice);
      stream.write(dataSlice, dataSlice.length);
      processed += maxArgs;
    }

    if (stream instanceof Components.interfaces.nsISafeOutputStream) {
      stream.finish();
    } else {
      stream.close();
    }
  }

  cal3eRequest.Client.getInstance()
    .downloadAttachment(findIdentity(calendar), listener, uri);
}

function openAttachment(uri, window, calendar) {
  if (uri.indexOf('eee://') !== 0) {
    openAttachment();
    return;
  }

  var splittedUri = uri.split('/');
  var filename = decodeURIComponent(splittedUri[splittedUri.length - 1]);
  var file = Components.classes['@mozilla.org/file/directory_service;1']
    .getService(Components.interfaces.nsIProperties)
    .get('TmpD', Components.interfaces.nsIFile);
  file.append(filename);

  var listener = function(httpStatusCode, response) {
    dump('Attachment ' + uri + ' downloaded.\n');
    if (httpStatusCode != '200') {
      dump('Error\n');
      return;
    }

    var stream = Components.classes[
      '@mozilla.org/network/safe-file-output-stream;1'
    ].createInstance(Components.interfaces.nsIFileOutputStream);

    stream.init(file, 0x02 | 0x08 | 0x20, 384, 0); // readwrite, create, truncate

    var maxArgs = 65535;
    var processed = 0;
    while (processed < response.length) {
      var responseSlice = Array.prototype.slice.call(
        response, processed, processed + maxArgs);
      var dataSlice = String.fromCharCode.apply(String, responseSlice);
      stream.write(dataSlice, dataSlice.length);
      processed += maxArgs;
    }

    if (stream instanceof Components.interfaces.nsISafeOutputStream) {
      stream.finish();
    } else {
      stream.close();
    }

    openFile(file);
  }

  cal3eRequest.Client.getInstance()
    .downloadAttachment(findIdentity(calendar), listener, uri);
}

function openFile(file) {
  try {
    file.launch();
  } catch (error) {
    dump('Cannot open file. ' + error.message + '\n');
  }
}

function saveAttachmentDialog(defaultFilename, window) {
  const nsIFilePicker = Components.interfaces.nsIFilePicker;

  var fp = Components.classes['@mozilla.org/filepicker;1']
    .createInstance(nsIFilePicker);
  fp.init(window, 'Save As…', nsIFilePicker.modeSave);
  fp.defaultString = defaultFilename;

  var result = fp.show();
  if (result == nsIFilePicker.returnCancel) {
    return false;
  }

  return fp.file;
}

function findIdentity(calendar) {
  var identities = cal3eIdentity.Collection()
    .getEnabled()
    .findByEmail(cal3eModel.calendarUser(calendar));

  return identities.length > 0 ? identities[0] : null;
}

var cal3eAttachment = {
  save: saveAttachment,
  open: openAttachment
};
EXPORTED_SYMBOLS = [
  'cal3eAttachment'
];
