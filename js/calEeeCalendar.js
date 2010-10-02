/* ***** BEGIN LICENSE BLOCK *****
 * Mozilla 3e Calendar Extension
 * Copyright © 2010  Zonio s.r.o.
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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://calendar3e/cal3eClient.js");
Cu.import("resource://calendar/modules/calUtils.jsm");
Cu.import("resource://calendar/modules/calProviderUtils.jsm");
Cu.import("resource:///modules/iteratorUtils.jsm");

cal.loadScripts(["calUtils.js"], this);

EXPORTED_SYMBOLS = [
  "cal3eCalendar"
];

/**
 * Implementation of 3e calendar.
 */
function cal3eCalendar() {
  this.initProviderBase();
}

const calIFreeBusyInterval = Ci.calIFreeBusyInterval;

cal3eCalendar.prototype = {

  __proto__: cal.ProviderBase.prototype,

  _client: null,
  
  /**
   * Initializes 3e Client for this calendar.
   */
  _init3eCalendar: function cal3e_init3eCalendar() {
    var uriSpec = this._uri.spec,
        uriParts = uriSpec.split('/', 4),
        user3e = uriParts[2];
    var accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
      .getService(Ci.nsIMsgAccountManager);

    var identities = [
      i for each (i in fixIterator(accountManager.allIdentities, Ci.nsIMsgIdentity))
    ];
    var idx = identities.length,
        identity = null;
    while (idx--) {
      if (identities[idx].getBoolAttribute('eee_enabled') &&
          (user3e == identities[idx].email)) {
        identity = identities[idx];
        break;
      }
    }

    if (null === identity) {
      this._client = null;
      throw new Error("No identity found for 3e user '" + user3e + "'");
    }
    var client = new cal3eClient(identity);
    this._client = client;
  },

  _uri: null,

  /**
   * 
   */
  set uri cal3e_setUri(uri) {
    var console = Cc["@mozilla.org/consoleservice;1"].getService(
      Ci.nsIConsoleService
    );
    this._uri = uri;
    this._init3eCalendar();
    return uri;
  },

  get uri cal3e_getUri() {
    return this._uri;
  },

  /**
   * Returns identifier of 3e calendar type.
   * 
   * @returns {String}
   */
  get type cal3e_getType() {
    return '3e';
  },

  /**
   * Returns identifier of defining extension of this calendar.
   *
   * @returns {String}
   */
  get providerID cal3e_getProviderId() {
    return "calendar3e@zonio.net";
  },

  /**
   * Makes this calendar refreshalbe
   *
   * @returns {Boolean} always true
   */
  get canRefresh cal3e_canRefresh() {
    return true;
  },

  get calspec cal3e_calspec() {
    var uriSpec = this._uri.spec,
        uriParts = uriSpec.split('/', 5),
        user3e = uriParts[2],
        calname = uriParts[4] || uriParts[3];
    return user3e + ":" + calname;
  },

  _color: null,

  /**
   * Returns calendar's color.
   *
   * Color is formatted in HTML's #RRGGBB.
   *
   * @returns {String}
   */
  get color cal3e_getColor() {
    //TODO call getCalendarAttributes
    return this._color;
  },

  /**
   * Sets calendar's color.
   *
   * @param {String} color formatted in HTML's #RRGGBB
   */
  set color cal3e_setColor(color) {
    //TODO call setCalendarAttribute
    this._color = color;
  },
  
  addItem: function cal3e_addItem(item, listener) {
    throw new Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  adoptItem: function cal3e_adoptItem(item, listener) {
    throw new Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  modifyItem: function cal3e_adoptItem(item, listener) {
    throw new Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  deleteItem: function cal3e_adoptItem(item, listener) {
    throw new Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  getItem: function cal3e_adoptItem(id, listener) {
    throw new Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  /**
   * Returns ordered calendar items according to given constraints.
   *
   * @param {Numeric} itemFilter bites combined from several settings
   */
  getItems: function cal3e_getItems(itemFilter, count, rangeStart, rangeEnd,
      listener) {
    var console = Cc["@mozilla.org/consoleservice;1"]
      .getService(Ci.nsIConsoleService);

    var wantEvents = ((itemFilter &
      Ci.calICalendar.ITEM_FILTER_TYPE_EVENT) != 0);
    var wantInvitations = ((itemFilter &
      Ci.calICalendar.ITEM_FILTER_REQUEST_NEEDS_ACTION) != 0);

    if (!wantEvents) {
      // Events are not wanted, nothing to do.
    	this.notifyOperationComplete(
    	  listener,
    	  Cr.NS_OK,
    		Ci.calIOperationListener.GET, null,
    		"Bad item filter passed to getItems"
    	);
    	return;
    }

    rangeStart = ensureDateTime(rangeStart);
    rangeEnd = ensureDateTime(rangeEnd);

    var client = this._client,
        calendar = this;
    client.queryObjects(this, rangeStart, rangeEnd, {
      onSuccess: function (rawItems, methodStack) {
        console.logStringMessage("Items: " + rawItems);
        var parser = calendar._getIcsParser();
        try {
          parser.parseString(rawItems);          
        } catch (e) {
          console.logStringMessage("Error while parsing: " + e);
        }
        
        var items = parser.getItems({});
        console.logStringMessage("Number of items: " + items.length);
        listener.onGetResult(calendar,
                             Cr.NS_OK,
                             Ci.calIEvent,
                             null,
                             items.length,
                             items);

        calendar.notifyOperationComplete(listener,
                                         Cr.NS_OK,
                                         Ci.calIOperationListener.GET,
                                         null,
                                         null);
      },
      onError: function (methodStack) {
        calendar.notifyOperationComplete(listener,
                                         Cr.NS_ERROR_FAILURE,
                                         Ci.calIOperationListener.GET,
                                         null,
                                         "See the Error Console");
      }
    });
  },

  /* 
   * Refreshes this calendar by notifying its observer.
   */
  refresh:function cal3e_refresh () {
    this.observers.notify("onLoad", [this]);
  },
  
  _icsParser: null,
  _getIcsParser: function cal3e_getIcsParser() {
    if (null === this._icsParser) {
      this._icsParser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
          .createInstance(Components.interfaces.calIIcsParser);
    }
    
    return this._icsParser;
  }

};