var calendar3eResource = "calendar3e";
var ioService = Components.classes["@mozilla.org/network/io-service;1"]
    .getService(Components.interfaces.nsIIOService);
var resourceProtocol = ioService.getProtocolHandler("resource")
    .QueryInterface(Components.interfaces.nsIResProtocolHandler);
if (!resourceProtocol.hasSubstitution(calendar3eResource)) {
  var cal3eExtensionId = "{a62ef8ec-5fdc-40c2-873c-223b8a6925cc}";
  var em = Components.classes["@mozilla.org/extensions/manager;1"]
      .getService(Components.interfaces.nsIExtensionManager);
  var file = em.getInstallLocation(cal3eExtensionId)
      .getItemFile(cal3eExtensionId, "install.rdf");
  var extensionDir = file.parent.clone();
  extensionDir.append("js");

  var aliasFile = Components.classes["@mozilla.org/file/local;1"]
      .createInstance(Components.interfaces.nsILocalFile);
  aliasFile.initWithPath(extensionDir.path);
  var aliasUri = ioService.newFileURI(aliasFile);
  resourceProtocol.setSubstitution(calendar3eResource, aliasUri);
}
Components.utils.import("resource://" + calendar3eResource + "/cal3eClient.js");

function open3eCalendarSubscribeDialog() {
  window.openDialog("chrome://calendar3e/content/3eCalendarSubscribeDialog.xul");
}

const Cc = Components.classes;
const Ci = Components.interfaces;

if ('undefined' === typeof Calendar3e) {
  var Calendar3e = {};
}
Calendar3e.loadCalendars = function (evt) {
  var console = Cc["@mozilla.org/consoleservice;1"].getService(
      Ci.nsIConsoleService
    );
  var cal3eModule = Cc["@mozilla.org/calendar/calendar;1?type=3e"];

  var mgr = Cc["@mozilla.org/messenger/account-manager;1"]
              .getService(Ci.nsIMsgAccountManager);
  var accounts = [
    a for each (a in fixIterator(mgr.accounts, Ci.nsIMsgAccount))
  ];
  //XXX incomingServer server check due to 41133
  accounts = accounts.filter(function (a) {
      return a.incomingServer && (a.incomingServer.type != "nntp")
                              && (a.incomingServer.type != "none");
    });
  var identity = accounts[0].defaultIdentity;

  var client = new cal3eClient(identity);
  client.getCalendars("match_owner('filip.zrust@zonio.net')", {
    onSuccess: function (calendars, methodStack) {
      var idx = -1,
          length = calendars.length,
          calendar;
      if (0 < length) {
        while (++idx < length) {
          calendar = calendars[idx];
          console.logStringMessage("Calendars: " + calendar.name);
        }
      } else {
        console.logStringMessage("No calendars retrieved.");
      }
    },
    onError: function (methodStack) {
      console.logStringMessage("Number of methods: " + methodStack._methods.length);
      console.logStringMessage("Number of responses: " + methodStack._responses.length);
      if (null !== methodStack._errorResponse) {
        console.logStringMessage("Error response: " +
          methodStack._errorResponse.responseStatus + " " +
          methodStack._errorResponse.responseStatusText);
      }
      console.logStringMessage("Don' work");
    }
  });
}

window.addEventListener('load', Calendar3e.loadCalendars, false);
