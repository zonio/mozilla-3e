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

function Logger(logDevice) {
  var logger = this;
  var formatter;
  var severityThreshold;
  var defaultName;

  function log(severity, message, name) {
    if (typeof Severity[severity] === 'undefined') {
      severity = 'UNKNOWN';
    }
    if (Severity[severity] < Severity[severityThreshold]) {
      return this;
    }

    logDevice.write(
      formatter.call(formatter,
                     severity, new Date(), name || defaultName, message || '')
    );

    return this;
  }

  function createLogFunction(severity) {
    var logFunction = function(message) {
      return log(severity, message, defaultName);
    }
    logFunction.name = severity.toLowerCase();

    return logFunction;
  }

  var debug = createLogFunction('DEBUG');
  var info = createLogFunction('INFO');
  var warn = createLogFunction('WARN');
  var error = createLogFunction('ERROR');
  var fatal = createLogFunction('FATAL');

  function setFormatter(newFormatter) {
    formatter = newFormatter;

    return this;
  }

  function setSeverityThreshold(newSeverityThreshold) {
    if (typeof Severity[newSeverityThreshold] === 'undefined') {
      throw new Error('Unknown severity "' + newSeverityThreshold + '"');
    }

    severityThreshold = newSeverityThreshold;

    return this;
  }

  function setName(newName) {
    defaultName = newName;

    return this;
  }

  function init() {
    if (!logDevice) {
      logDevice = new ConsoleLogDevice();
    }
    formatter = DefaultFormatter;
    severityThreshold = 'DEBUG';
  }

  logger.log = log;
  logger.debug = debug;
  logger.info = info;
  logger.warn = warn;
  logger.error = error;
  logger.fatal = fatal;
  logger.setFormatter = setFormatter;
  logger.setSeverityThreshold = setSeverityThreshold;
  logger.setName = setName;

  init();
}

function ConsoleLogDevice() {
  var device = this;

  function write(message) {
    Services.console.logStringMessage(message);
  }

  device.write = write;
}

function DumpLogDevice() {
  var device = this;

  function write(message) {
    dump(message + '\n');
  }

  device.write = write;
}

function DefaultFormatter(severity, time, name, message) {
  function rightAlign(string, length) {
    while (string.length < length) {
      string = ' ' + string;
    }
    if (string.length > length) {
      string = string.substring(0, length);
    }

    return string;
  }

  var formattedMessage = '';
  formattedMessage += severity[0] + ', ';
  formattedMessage += '[' + time.toISOString() + '] ';
  formattedMessage += rightAlign(severity, 5) + ' -- ';
  if (name) {
    formattedMessage += name + ': ';
  }
  formattedMessage += message;

  return formattedMessage;
}

function Builder(config) {
  var builder = this;

  function createLogger() {
    var logger = new Logger(getLogDevice());
    if (getSeverityThreshold()) {
      logger.setSeverityThreshold(getSeverityThreshold());
    }
    if (getName()) {
      logger.setName(getName());
    }

    return logger;
  }

  function getLogDevice() {
    var logDeviceConstructor = LogDevices[
      Services.prefs.getCharPref(config + '.logDevice')
    ];

    return logDeviceConstructor ? new logDeviceConstructor() : null;
  }

  function getSeverityThreshold() {
    var severityThreshold = Services.prefs.getCharPref(config + '.severity');
    if (severityThreshold) {
      severityThreshold = severityThreshold.toUpperCase();
    }

    return typeof Severity[severityThreshold] !== 'undefined' ?
      severityThreshold :
      null;
  }

  function getName() {
    return Services.prefs.getCharPref(config + '.name');
  }

  builder.createLogger = createLogger;
}

var Severity = {
  'DEBUG': 0,
  'INFO': 1,
  'WARN': 2,
  'ERROR': 3,
  'FATAL': 4,
  'UNKNOWN': 5
};

var LogDevices = {
  'console': ConsoleLogDevice,
  'dump': DumpLogDevice
};

var cal3eLogger = {
  create: function(config) { return (new Builder(config)).createLogger() }
};

EXPORTED_SYMBOLS = [
  'cal3eLogger'
];
