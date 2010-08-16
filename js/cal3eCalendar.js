EXPORTED_SYMBOLS = [
  "cal3eCalendar"
];
Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");

//
// cal3eItipTransport() - contructor
//

function cal3eItipTransport(aCalendar) {
  this.mCalendar = aCalendar;
    var aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].getService (Components.interfaces.nsIConsoleService);

    aConsoleService.logStringMessage ("itip() ++ ");

}

cal3eItipTransport.prototype = {
  mCalendar:null,

  get defaultIdentity eee_getIdentity() {
    return this.mCalendar.mServerUser;
  },

  get scheme eee_getScheme() {
    return "mailto";
  },

  mUserAddress: null,
  get senderAddress eee_getAddress() {
    return this.mUserAddress || this.mCalendar.mServerUser;
  },

  set senderAddress eee_setAddress(value) {
    this.mUserAddress = value;
  },
  get type eee_getType() {
    return "eee";
  },

  sendItems: function  eee_sendItems(aCount,aRecipients,aItipItem) {
    var aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].getService (Components.interfaces.nsIConsoleService);

    aConsoleService.logStringMessage ("sendItems() ++ ");
    var item = aItipItem.getItemList({})[0];

    // Get ourselves some default text - when we handle organizer properly
    // We'll need a way to configure the Common Name attribute and we should
    // use it here rather than the email address

    var summary = (item.getProperty("SUMMARY") || "");
    var aSubject = "";
    var aBody = "";
    switch (aItipItem.responseMethod) {
      case 'REQUEST':
        aSubject = calGetString("lightning",
                                "itipRequestSubject",
                                [summary],
                                "lightning");
        aBody = calGetString("lightning",
                             "itipRequestBody",
                             [item.organizer ? item.organizer.toString() : "", summary],
                             "lightning");
        break;
      case 'CANCEL':
        aSubject = calGetString("lightning",
                                "itipCancelSubject",
                                [summary],
                                "lightning");
        aBody = calGetString("lightning",
                             "itipCancelBody",
                             [item.organizer ? item.organizer.toString() : "", summary],
                             "lightning");
        break;
      case 'REPLY': {
        // Get my participation status
        var att = (calInstanceOf(aItipItem.targetCalendar, Components.interfaces.calISchedulingSupport)
                               ? aItipItem.targetCalendar.getInvitedAttendee(item) : null);
        if (!att && aItipItem.identity) {
          att = item.getAttendeeById("mailto:" + aItipItem.identity);
        }
        if (!att) { // should not happen anymore
          return;
        }

        // work around BUG 351589, the below just removes RSVP:
        aItipItem.setAttendeeStatus(att.id, att.participationStatus);
        var myPartStat = att.participationStatus;
        var name = att.toString();

        // Generate proper body from my participation status
        aSubject = calGetString("lightning",
                                "itipReplySubject",
                                [summary],
                                "lightning");
        aBody = calGetString("lightning",
                             (myPartStat == "DECLINED") ? "itipReplyBodyDecline"
                                                        : "itipReplyBodyAccept",
                             [name],
                             "lightning");
        break;
      }
    }
    var aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].getService (Components.interfaces.nsIConsoleService);

    aConsoleService.logStringMessage ("sendItems() ++ " + aSubject +" ++++" + aBody );

  }
};

//
// cal3eProvider() - constructor
//
function cal3eCalendar () {
  this.initProviderBase ();
  this.mLocalCacheTime = null;
  this.mLocalCache = null;
  getFreeBusyService().addProvider(this);
  this.mItip = new cal3eItipTransport(this);
}

const calIFreeBusyInterval = Components.interfaces.calIFreeBusyInterval;

cal3eCalendar.prototype = {
  __proto__:cal.ProviderBase.prototype,
  // nsISupport interface
  QueryInterface:function eee_QueryInterface (aIID) {
    return doQueryInterface (this, cal3eCalendar.prototype, aIID,
			     [Components.interfaces.calICalendarProvider,
			      Components.interfaces.calIFreeBusyProvider,
			      Components.interfaces.calIItipTransport,
			   //   Components.interfaces.calISchedulingSupport,
			      Components.interfaces.calICalendar]);
  },
  // calICalendar
  get type eee_get_type () {
    return "3e";
  },
 // mDisabled:true,
  mItip:null,
  get name eee_getName () {
    return this.mTitle;
  },
  set name eee_setName (v) {
    this.mTitle = v;
  },
  get color eee_getColor () {
    return this.mColor;
  },
  set color cGC_setColor (v) {
    this.mColor = v;
  },
  mCalendarUserAddress:null,
  get canRefresh eee_get_canRefresh () {
    return true;
  },
  // defined uri provided by user
  mUri: null,
  mServerUri: null,
  mServerUser: null,
  mServerPass: null,
  mServerCalendar: null,
  mLocalCache: null,
  mLocalCacheTime: null,
  get uri eee_get_uri () {
    return this.mUri;
  },
  set uri eee_set_uri (aUri) {
    this.mUri = aUri;
    var tUri = Components.classes["@mozilla.org/network/standard-url;1"].getService (Components.interfaces.nsIURI);
    tUri.spec = aUri.spec;

    if (aUri != null) {
      this.mServerUser = tUri.username + "@" + tUri.host;
      this.mServerPass = tUri.password;
      this.mServerUri = "https://" + tUri.host + ":" + (tUri.port == -1 ? "4444" : tUri.port) + "/";
      this.mServerCalendar = tUri.path.substring (1);
    }
    this.mTitle = this.mServerCalendar;
    return aUri;
  },
  get transientProperties eee_get_transientProperties () {
    return true;
  },
  mTitle: null,
  mColor: null,
  setProperty:function eee_setProperty (aName,aValue) {
    var aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].getService (Components.interfaces.nsIConsoleService);

    aConsoleService.logStringMessage ("setProperty() - " + this.mUri.spec + ", " + aName + " = " + aValue);
    switch (aName) {
      case "name":
	this.mTitle = aValue;
	return;
      case "color":
	this.mColor = aValue;
	return;
      }
  },
  getProperty:function eee_getProperty (aName) {
    var aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].getService (Components.interfaces.nsIConsoleService);
    if(aName == "itip.transport") {
      aConsoleService.logStringMessage ("sendItems() ++ " + aName);
      return this;
    }
    switch (aName) {
      case "organizerId": {
        if(this.mServerUser) {
          return this.mServerUser;
        }
        break;
      }
      case "capabilities.tasks.supported":
      case "capabilities.timezones.floating.supported":
	return false;
      case "capabilities.attachments.supported":
      case "capabilities.privacy.supported":
      case "itip.transport":
	return false;
      case "requiresNetwork":
      case "capabilities.events.supported":
      case "capabilities.timezones.UTC.supported":
	return true;
      case "name":
	return this.mTitle;
      case "color":
	return this.mColor;
      }
    return this.__proto__.__proto__.getProperty.apply (this, arguments);
  },
  prepareSerializedItem:function eee_prepareSerialiedItem (aItem) {
    // Serialize item
    var serialized = cal.getSerializedItem (aItem);
 //   var aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].getService (Components.interfaces.nsIConsoleService);

   // aConsoleService.logStringMessage ("prepareSerializedItem() - " + serialized);
    // convert dtstart and dtend to UTC
    var timezoneUTC = aItem.startDate.timezone.provider.UTC;
    var startDate = aItem.startDate.getInTimezone (timezoneUTC);
    var text = startDate.toString ();
    var dtstart = "DTSTART:" + text.substr (0, 4) + text.substr (5, 2) + text.substr (8, 2) +
                  "T" + text.substr (11, 2) + text.substr (14, 2) + text.substr (17, 2) + "Z";
    var endDate = aItem.endDate.getInTimezone (timezoneUTC);
    var text = endDate.toString ();
    var dtend = "DTEND:" + text.substr (0, 4) + text.substr (5, 2) + text.substr (8, 2) +
                "T" + text.substr (11, 2) + text.substr (14, 2) + text.substr (17, 2) + "Z";

    // clean parts rejected by server
    var split = serialized.search ("BEGIN:VEVENT");
    var xevent = serialized.substring (split);
    xevent = xevent.replace (/DTSTART;TZID.*/, dtstart);
    xevent = xevent.replace (/DTEND;TZID.*/, dtend);
    var ret = xevent.replace (/END:VCALENDAR/, "");
    return ret;
  },
  /**
   * addItem()
   * we actually use doAdoptItem()
   *
   * @param aItem       item to add
   * @param aListener   listener for method completion
   */
  addItem:function eee_addItem (aItem, aListener) {
    var newItem = aItem.clone ();
    return this.doAdoptItem (newItem, aListener, false);
  },
  /**
   * adoptItem()
   * we actually use doAdoptItem()
   *
   * @param aItem       item to check
   * @param aListener   listener for method completion
   */
  adoptItem:function eee_adoptItem (aItem, aListener) {
    return this.doAdoptItem (aItem, aListener, false);
  },
  /**
   * Performs the actual addition of the item to CalDAV store
   *
   * @param aItem       item to add
   * @param aListener   listener for method completion
   * @param aIgnoreEtag ignore item etag
   */
  doAdoptItem:function eee_doAdoptItem (aItem, aListener, aIgnoreEtag) {
    if (aItem.id == null && aItem.isMutable) {
      aItem.id = getUUID ();
    }

    if (aItem.id == null) {
      this.notifyOperationComplete (aListener,Components.results.NS_ERROR_FAILURE,
                                    Components.interfaces.calIOperationListener.ADD,
                                    aItem.id,
				    "Can't set ID on non-mutable item to addItem");
      return;
    }
    aItem.calendar = this;
    var rpc = new cal3eClient (this.mServerUri, this.mServerUser, this.mServerPass);
    var pthis = this;
    var aok = function adopt_aok (xml) {
      pthis.notifyOperationComplete (aListener,
				     Components.results.NS_OK,
				     Components.interfaces.
				     calIOperationListener.ADD,
				     aItem.id,
				     aItem);
      pthis.mLocalCache[aItem.id] = aItem.clone();
      pthis.observers.notify ("onAddItem",[aItem]);
      return;
    };
    var aerror = function adopt_aerror (eno, text) {
      pthis.notifyOperationComplete (aListener,
				     Components.results.NS_ERROR_FAILURE,
				     Components.interfaces.
				     calIOperationListener.ADD,
				     aItem.id,
				     "Server returned error status: " + text);
      return;
    };

    var params = Array ();
    params[0] = this.mServerCalendar;
    params[1] = this.prepareSerializedItem (aItem);
    rpc.rpcCall ("addObject", params, aok, aerror);
  },
  /**
   * modifyItem(); required by calICalendar.idl
   * we actually use doModifyItem()
   *
   * @param aItem       item to check
   * @param aListener   listener for method completion
   */
  modifyItem:function eee_modifyItem (aNewItem, aOldItem, aListener) {
    if (aNewItem.id == null) {
      this.notifyOperationComplete (aListener,
                                    Components.results.NS_ERROR_FAILURE,
				    Components.interfaces.
				    calIOperationListener.MODIFY,
				    aNewItem.id,
				    "ID for modifyItem doesn't exist or is null");
      return;
    }
    var rpc = new cal3eClient (this.mServerUri, this.mServerUser, this.mServerPass);
    var pthis = this;
    var aok = function adopt_aok (xml) {
      pthis.notifyOperationComplete (aListener,
				     Components.results.NS_OK,
				     Components.interfaces.
				     calIOperationListener.MODIFY,
				     aNewItem.id,
				     aNewItem);
      pthis.mLocalCache[aNewItem.id] = aNewItem.clone();
      pthis.observers.notify ("onModifyItem",[aNewItem, aOldItem]);
      return;
    };
    var aerror = function adopt_aerror (eno, text) {
      pthis.notifyOperationComplete (aListener,
				     Components.results.NS_ERROR_FAILURE,
				     Components.interfaces.
				     calIOperationListener.MODIFY,
				     aNewItem.id,
				     "Server returned error status: " + text);
      return;
    };

    var params = Array ();
    params[0] = this.mServerCalendar;
    params[1] = this.prepareSerializedItem (aNewItem);
    rpc.rpcCall ("updateObject", params, aok, aerror);
  },
  /**
   * deleteItem(); required by calICalendar.idl
   *
   * @param aItem       item to delete
   * @param aListener   listener for method completion
   */
  deleteItem:function eee_deleteItem (aItem, aListener) {
    if (aItem.id == null) {
      this.notifyOperationComplete (aListener,
 		                    Components.results.NS_ERROR_FAILURE,
				    Components.interfaces.
				    calIOperationListener.DELETE, aItem.id,
				    "ID doesn't exist for deleteItem");
      return;
    }

    var rpc = new cal3eClient (this.mServerUri, this.mServerUser, this.mServerPass);
    var pthis = this;
    var aok = function adopt_aok (xml) {
      pthis.notifyOperationComplete (aListener,
				     Components.results.NS_OK,
				     Components.interfaces.
				     calIOperationListener.DELETE,
				     aItem.id,
				     aItem);
      delete pthis.mLocalCache[aItem.id];
      pthis.observers.notify ("onDeleteItem",[aItem]);
      return;
    };
    var aerror = function adopt_aerror (eno, text) {
      pthis.notifyOperationComplete (aListener,
				     Components.results.NS_ERROR_FAILURE,
				     Components.interfaces.
				     calIOperationListener.DELETE,
				     aItem.id,
				     "Server returned error status" + text);
      return;
    };

    var params = Array ();
    params[0] = this.mServerCalendar;
    params[1] = aItem.id;
    rpc.rpcCall ("deleteObject", params, aok, aerror);
  },
  // void getItem( in string id, in calIOperationListener aListener );
  getItem:function eee_getItem (aId, aListener) {
        if (!aListener)
            return;

        if (aId == null || this.mLocalCache[aId] == null) {
            // querying by id is a valid use case, even if no item is returned:
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_OK,
                                         Components.interfaces.calIOperationListener.GET,
                                         aId,
                                         null);
            return;
        }

        var item = this.mLocalCache[aId];
        var iid = null;

        if (isEvent(item)) {
            iid = Components.interfaces.calIEvent;
        } else if (isToDo(item)) {
            iid = Components.interfaces.calITodo;
        } else {
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_ERROR_FAILURE,
                                         Components.interfaces.calIOperationListener.GET,
                                         aId,
                                         "Can't deduce item type based on QI");
            return;
        }

        aListener.onGetResult (this.superCalendar,
                               Components.results.NS_OK,
                               iid,
                               null, 1, [item]);

        this.notifyOperationComplete(aListener,
                                     Components.results.NS_OK,
                                     Components.interfaces.calIOperationListener.GET,
                                     aId,
                                     null);

  },
  /*
   * updateCache - downloads differences from server
   * cbOk - callback when no error occured
   * cbError - callback when error occured
   * cbParams - array of parameters
   */
  updateCache: function eee_updateCache(cbOk,cbError) {
    var filter = "NOT deleted()";
    if(this.mLocalCacheTime != null) {
      // prepare filter according to DTSTAMP date
      var timezoneUTC = this.mLocalCacheTime.timezone.provider.UTC;
      var tLocalCacheTime = this.mLocalCacheTime.getInTimezone(timezoneUTC);
      filter = "date_from('"+tLocalCacheTime.toString().replace(/\//g,"-").substring(0,19) + "') AND " + filter;
    } else {
      // New start - download calendar from server
      this.mLocalCache = {};
    }
    var rpc = new cal3eClient (this.mServerUri, this.mServerUser, this.mServerPass);
    var pthis = this;
    var aok = function aok (aXML) {
      let value = aXML.params.param.value[0];
      var parser = Components.classes["@mozilla.org/calendar/ics-parser;1"].createInstance (Components.interfaces.calIIcsParser);
      parser.parseString (value, null);
      var mItems = parser.getItems ({});

      for (var itemIndex in mItems) {
        var item = mItems[itemIndex];
        item.calendar = pthis;
        pthis.mLocalCache[item.id] = item;
        // check for newest item for next update
        if(pthis.mLocalCacheTime == null) {
          pthis.mLocalCacheTime = item.stampTime.clone();
        } else {
          if(pthis.mLocalCacheTime.nativeTime < item.stampTime.nativeTime) {
            pthis.mLocalCacheTime = item.stampTime.clone();
          }
        }
      }
      cbOk();
    };
    var aerror = function aError(eNo, eText) {
      cbError(eNo,eText);
    };
    var params = Array ();
    params[0] = this.mServerCalendar;
    params[1] = filter;
    rpc.rpcCall ("queryObjects", params, aok, aerror);
    return;


  },
  // void getItems( in unsigned long aItemFilter, in unsigned long aCount,
  //                in calIDateTime aRangeStart, in calIDateTime aRangeEnd,
  //                in calIOperationListener aListener );
  // * gets data from localy cached calendar
  getItems:function eee_getItems (aItemFilter, aCount, aRangeStart, aRangeEnd, aListener) {
    if (!aListener)
      return;
    const calICalendar = Components.interfaces.calICalendar;
    const calIRecurrenceInfo = Components.interfaces.calIRecurrenceInfo;

    var wantUnrespondedInvitations = ((aItemFilter & calICalendar.ITEM_FILTER_REQUEST_NEEDS_ACTION) != 0);
    wantUnrespondedInvitations = false;
    var superCal;
    function checkUnrespondedInvitation (item)
    {
      var att = superCal.getInvitedAttendee (item);
      return (att && (att.participationStatus == "NEEDS-ACTION"));
    }
    var aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].getService (Components.interfaces.nsIConsoleService);
    aConsoleService.logStringMessage ("getItems() " + aItemFilter);

    var wantEvents =
      ((aItemFilter & calICalendar.ITEM_FILTER_TYPE_EVENT) != 0);
    if (!wantEvents)
      {
	// bail.
	this.notifyOperationComplete (aListener,
				      Components.results.NS_ERROR_FAILURE,
				      Components.interfaces.
				      calIOperationListener.GET, null,
				      "Bad aItemFilter passed to getItems");
	return;
      }

    var itemCompletedFilter =
      ((aItemFilter & calICalendar.ITEM_FILTER_COMPLETED_YES) != 0);
    var itemNotCompletedFilter =
      ((aItemFilter & calICalendar.ITEM_FILTER_COMPLETED_NO) != 0);
    function checkCompleted (item)
    {
      return (item.
	      isCompleted ? itemCompletedFilter : itemNotCompletedFilter);
    }

    // return occurrences?
    var itemReturnOccurrences =
      ((aItemFilter & calICalendar.ITEM_FILTER_CLASS_OCCURRENCES) != 0);

    // figure out the return interface type
    var typeIID = null;
    if (itemReturnOccurrences)
      {
	typeIID = Components.interfaces.calIItemBase;
      }
    else
      {
	typeIID = Components.interfaces.calIEvent;
      }

    aRangeStart = ensureDateTime (aRangeStart);
    aRangeEnd = ensureDateTime (aRangeEnd);

    // update local cache and find corresponding items

    var acalendar = this;
    var pthis = this;
    var cbOk = function getItmes_cbOk() {
      var itemsFound = Array ();
      for (var itemIndex in pthis.mLocalCache) {
        var item = pthis.mLocalCache[itemIndex];
        var isEvent_ = isEvent (item);

        item.calendar = acalendar;
        if (itemReturnOccurrences && item.recurrenceInfo) {
          var occurrences = item.recurrenceInfo.getOccurrences (aRangeStart, aRangeEnd,
							      aCount ? aCount - itemsFound.length : 0, {} );
          if (wantUnrespondedInvitations) {
            occurrences = occurrences.filter (checkUnrespondedInvitation);
          }
          if (!isEvent_) {
            occurrences = occurrences.filter (checkCompleted);
          }
          itemsFound = itemsFound.concat (occurrences);
        } else {
  	  if ((!wantUnrespondedInvitations || checkUnrespondedInvitation (item)) &&
              (isEvent_ || checkCompleted(item)) && checkIfInRange (item, aRangeStart, aRangeEnd)) {
            // This needs fixing for recurring items, e.g. DTSTART of parent may occur before aRangeStart.
            // This will be changed with bug 416975.
            itemsFound.push (item);
          }
        }
        if (aCount && itemsFound.length >= aCount) {
          break;
        }
      }
      aListener.onGetResult (acalendar,
  			   Components.results.NS_OK,
			   Components.interfaces.calIEvent,
			   null, itemsFound.length, itemsFound);

      acalendar.notifyOperationComplete (aListener,
				       Components.results.NS_OK,
				       Components.interfaces.
				       calIOperationListener.GET, null, null);
    };
    this.updateCache(cbOk,null);
  },
  /* 
   * refresh - call onLoad on observers
   */
  refresh:function eee_refresh () {
      // issue new localCache fill and reload data
      this.mLocalCacheTime = null;
      this.observers.notify ("onLoad",[this]);
  },
  getFreeBusyIntervals: function eee_getFreeBusyIntervals(
        aCalId, aRangeStart, aRangeEnd, aBusyTypes, aListener) {
    var aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].getService (Components.interfaces.nsIConsoleService);

    aConsoleService.logStringMessage ("getFreeBusyIntervals() - " + aCalId + " " + aBusyTypes);

    var aCalIdParts = aCalId.split(":");
    aCalIdParts[0] = aCalIdParts[0].toLowerCase();

    if (aCalIdParts[0] != "mailto" ) {
       aListener.onResult(null, null);
       return;
     }

    var bAttendee = aCalIdParts[1];

    aRangeStart = ensureDateTime (aRangeStart);
    aRangeEnd = ensureDateTime (aRangeEnd);

    var timezoneUTC = this.mLocalCacheTime.timezone.provider.UTC;
    var bRangeStart = aRangeStart.getInTimezone(timezoneUTC).toString().replace(/\//g,"-").substring(0,19);
    var bRangeEnd = aRangeEnd.getInTimezone(timezoneUTC).toString().replace(/\//g,"-").substring(0,19);

    var rpc = new cal3eClient (this.mServerUri, this.mServerUser, this.mServerPass);
    var pthis = this;
    var fbOK = function eee_fbOK(aXML) {
      var aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].getService (Components.interfaces.nsIConsoleService);

 //     aConsoleService.logStringMessage ("getFreeBusyIntervals() ++ " + value);a
      var value = aXML.params.param[0].value;
      // find lines starting with FREEBUSY

      var lines = value.split("\n");
      var periodsToReturn = [];
      for( var iter in lines) {
        if (lines[iter].substring(0,8) == "FREEBUSY") {
          var parts = lines[iter].split(":");
          var type = parts[0].split("=")[1]; // type BUSY,FREE,BUSY-UNAVIABLE,BUSY-TENTATIVE
          var times = parts[1].split("/");
	  let fbType = calIFreeBusyInterval.UNKNOWN;
          switch(type) {
          case "FREE": fbType = calIFreeBusyInterval.FREE;break;
          case "BUSY": fbType = calIFreeBusyInterval.BUSY;break;
          case "BUSY-UNAVIABLE": fbType = calIFreeBusyInterval.BUSY_UNAVIABLE;break;
          case "BUSY-TENTATIVE": fbType = calIFreeBusyInterval.BUSY_TENTATIVE;break;
          }

          let begin = cal.createDateTime(times[0]);
          let end;
          if (times[1].charAt(0) == "P") { // this is a duration
            end = begin.clone();
            end.addDuration(cal.createDuration(times[1]))
          } else {
            // This is a date string
            end = cal.createDateTime(times[1]);
          }
          interval = new cal.FreeBusyInterval(aCalId,fbType,begin,end);
          periodsToReturn.push(interval);
        }
      }
      aListener.onResult(null, periodsToReturn);
    };
    var fbError = function fbError(eno,etext) {

    };
    var params = Array ();
    params[0] = bAttendee;
    params[1] = bRangeStart;
    params[2] = bRangeEnd;
    params[3] = "BEGIN:VTIMEZONE\nEND:VTIMEZONE";
    rpc.rpcCall ("freeBusy", params, fbOK, fbError);
    return;
  },
/*  canNotify: function eee_canNotify(aMethod, aItem) {
    var aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].getService (Components.interfaces.nsIConsoleService);

    aConsoleService.logStringMessage ("canNotify() ++ " + aMethod + " "  + cal.getSerializedItem(aItem));
    return true;
  },*/

//
// calIItipTransport implementation
//
  get defaultIdentity eee_getIdentity() {
    return this.mServerUser;
  },

  get scheme eee_getScheme() {
    return "mailto";
  },

  mUserAddress: null,
  get senderAddress eee_getAddress() {
    return this.mUserAddress || this.mCalendar.mServerUser;
  },

  set senderAddress eee_setAddress(value) {
    this.mUserAddress = value;
  },

  sendItems: function  eee_sendItems(aCount,aRecipients,aItipItem) {
    var itemList = aItipItem.getItemList({});
    var serializer = Components.classes["@mozilla.org/calendar/ics-serializer;1"]
                                       .createInstance(Components.interfaces.calIIcsSerializer);
    serializer.addItems(itemList, itemList.length);
    var methodProp = getIcsService().createIcalProperty("METHOD");
    methodProp.value = aItipItem.responseMethod;
    serializer.addProperty(methodProp);
    var calText = serializer.serializeToString();

    var rpc = new cal3eClient (this.mServerUri, this.mServerUser, this.mServerPass);
    var aok = function aok (aXML) { // OK -> message delivered to server
    };
    var aerror = function aError(eNo, eText) {
    };

    var params = Array ();
    var param0 = "<array><data>";
    var rec = aRecipients.toString().split(",");
    for(aIndex in rec) {
      param0 = param0 + "<value><string>" + rec[aIndex] + "</string></value>";
    }
    param0 = param0 + "</data></array>";
    params[0] = param0;
    params[1] = calText;
    rpc.rpcCall ("sendMessage", params, aok, aerror);
    return;
  }
};
