const Cc = Components.classes;
const Ci = Components.interfaces;

var calendar3eResource = "calendar3e";
var ioService = Cc["@mozilla.org/network/io-service;1"]
    .getService(Ci.nsIIOService);
var resourceProtocol = ioService.getProtocolHandler("resource")
    .QueryInterface(Ci.nsIResProtocolHandler);
if (!resourceProtocol.hasSubstitution(calendar3eResource)) {
  var cal3eExtensionId = "{a62ef8ec-5fdc-40c2-873c-223b8a6925cc}";
  var em = Components.classes["@mozilla.org/extensions/manager;1"]
      .getService(Ci.nsIExtensionManager);
  var file = em.getInstallLocation(cal3eExtensionId)
      .getItemFile(cal3eExtensionId, "install.rdf");
  var resourceDir = file.parent.clone();
  resourceDir.append("js");
  var resourceDirUri = ioService.newFileURI(resourceDir);
  resourceProtocol.setSubstitution(calendar3eResource, resourceDirUri);
}
Components.utils.import("resource://" + calendar3eResource + "/cal3eClient.js");

function open3eCalendarSubscribeDialog() {
  window.openDialog("chrome://calendar3e/content/3eCalendarSubscribeDialog.xul");
}

if ('undefined' === typeof Calendar3e) {
  var Calendar3e = {};
}
Calendar3e.loadCalendars = function (evt) {
  var console = Cc["@mozilla.org/consoleservice;1"].getService(
      Ci.nsIConsoleService
    );
  var calendarManager = Cc["@mozilla.org/calendar/manager;1"]
    .getService(Ci.calICalendarManager);

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
  client.getCalendars("match_owner('" + identity.email + "')", {
    onSuccess: function (calendars, methodStack) {
      var idx = -1,
          length = calendars.length,
          calendar, calendarUri, calendar3e;
      if (0 < length) {
        while (++idx < length) {
          calendar = calendars[idx];
          calendarUri = ioService.newURI("eee://" + identity.email + "/" + calendar.name, null, null);
          console.logStringMessage("3e URI: " + calendarUri.spec);
          calendar3e = calendarManager.createCalendar(
            '3e', calendarUri
          );
          calendar3e.id = calendar.name;
          calendarManager.registerCalendar(calendar3e);
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
