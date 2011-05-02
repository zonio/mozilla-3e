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

/**
 * Implementation of EEE calendar.
 *
 * @augments cal.ProviderBase
 */
function calEeeCalendar() {
  this.initProviderBase();
  this._client = Cc["@zonio.net/calendar3e/client;1"].
      createInstance(Ci.calEeeIClient);
}

calEeeCalendar.prototype = {

  __proto__: cal.ProviderBase.prototype,
  
  /**
   * Sets EEE client identity based on calendar's {@link uri}.
   */
  _setupClient: function calEee_setupClient() {
    var uriSpec = this._uri.spec,
        uriParts = uriSpec.split('/', 4),
        eeeUser = uriParts[2];

    var accountCollection = new cal3e.AccountCollection();
    var accounts = accountCollection.filter(
      cal3e.AccountCollection.filterEnabled);
    var idx = accounts.length, identity = null;
    while (idx--) {
      if (eeeUser == accounts[idx].defaultIdentity.email) {
        identity = accounts[idx].defaultIdentity;
        break;
      }
    }
    if (null !== identity) {
      this._client.identity = identity;
    }
  },

  get client calEee_getClient() {
    return this._client;
  },

  set uri calEee_setUri(uri) {
    this._uri = uri;
    this._setupClient();

    return uri;
  },

  get uri calEee_getUri() {
    return this._uri;
  },

  /**
   * Identifier of EEE calendar type.
   * 
   * @property {String}
   */
  get type calEee_getType() {
    return 'eee';
  },

  /**
   * Identifier of defining extension of this calendar.
   *
   * @property {String}
   */
  get providerID calEee_getProviderId() {
    return "calendar3e@zonio.net";
  },

  /**
   * Indicator that this calendar is refreshable.
   *
   * @property {Boolean} always true
   */
  get canRefresh calEee_canRefresh() {
    return true;
  },

  /**
   * Unique calendar identifier in EEE domain.
   *
   * @property {String}
   */
  get calspec calEee_calspec() {
    return this.getCalspec();
  },

  getCalspec: function calEee_getCalspec() {
    var uriSpec = this._uri.spec,
        uriParts = uriSpec.split('/', 5),
        eeeUser = uriParts[2],
        calname = uriParts[4] || uriParts[3];

    return eeeUser + ":" + calname;
  },

  /**
   * Sets calendar's color.
   *
   * @param {String} color formatted in HTML's #RRGGBB
   */
  set color calEee_setColor(color) {
    //TODO call setCalendarAttribute
    this._color = color;
  },

  /**
   * Returns calendar's color.
   *
   * Color is formatted in HTML's #RRGGBB.
   *
   * @property {String}
   */
  get color calEee_getColor() {
    //TODO call getCalendarAttributes
    return this._color;
  },
  
  addItem: function calEee_addItem(item, listener) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  adoptItem: function calEee_adoptItem(item, listener) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  modifyItem: function calEee_adoptItem(item, listener) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  deleteItem: function calEee_adoptItem(item, listener) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  getItem: function calEee_adoptItem(id, listener) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  getItems: function calEee_getItems(itemFilter, count, rangeStart, rangeEnd,
      listener) {
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
      return null;
    }

    var calendar = this,
        clientListener = cal3e.createOperationListener(function calEee_getItems_onResult(methodQueue, result) {
          if (methodQueue.isPending) {
            return;
          }
          if (Cr.NS_OK !== methodQueue.status) {
            calendar.notifyOperationComplete(
              listener,
              methodQueue.status,
              Ci.calIOperationListener.GET,
              null,
              "Objects retrieval from EEE server failed");
            return;
          }

          var rawItems;
          try {
            rawItems = result.QueryInterface(Ci.nsISupportsCString);
          } catch (e) {
            calendar.notifyOperationComplete(
              listener,
              methodQueue.status,
              Ci.calIOperationListener.GET,
              null,
              "Objects retrieval from EEE server failed");
            return;
          }

          var parser = calendar._getIcsParser();
          try {
            parser.parseString(rawItems);          
          } catch (e) {
            //TODO
            return;
          }

          var itemsCount = {};
          var items = parser.getItems(itemsCount);
          listener.onGetResult(calendar,
                               Cr.NS_OK,
                               Ci.calIEvent,
                               null,
                               itemsCount.value,
                               items);

          calendar.notifyOperationComplete(listener,
                                           Cr.NS_OK,
                                           Ci.calIOperationListener.GET,
                                           null,
                                           null);
        });

    return this._client.queryObjects(
      clientListener, this.getCalspec(),
      rangeStart.nativeTime, rangeEnd.nativeTime);
  },

  /**
   * Refreshes this calendar by notifying its observer.
   */
  refresh: function calEee_refresh() {
    this.observers.notify("onLoad", [this]);
  },

  _icsParser: null,
  _getIcsParser: function calEee_getIcsParser() {
    if (null === this._icsParser) {
      this._icsParser = Cc["@mozilla.org/calendar/ics-parser;1"].
          createInstance(Ci.calIIcsParser);
    }
    
    return this._icsParser;
  }

}