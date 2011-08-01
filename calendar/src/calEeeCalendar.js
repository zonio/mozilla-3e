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

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://calendar/modules/calProviderUtils.jsm");
Cu.import("resource://calendar/modules/calUtils.jsm");
Cu.import("resource://calendar3e/modules/cal3eUtils.jsm");

/**
 * Implementation of EEE calendar.
 *
 * @augments cal.ProviderBase
 */
function calEeeCalendar() {
  this.initProviderBase();
  this._identity = null;
}

calEeeCalendar.prototype = {

  __proto__: cal.ProviderBase.prototype,

  QueryInterface: XPCOMUtils.generateQI([
    Ci.calEeeICalendar,
    Ci.calICalendar,
    Ci.nsIObserver
  ]),

  _getClient: function calEee_getClient() {
    var client = Cc["@zonio.net/calendar3e/client-service;1"]
      .getService(Ci.calEeeIClient);

    return client;
  },

  _findAndSetIdentity: function calEee_findAndSetIdentity() {
    var uriParts = this._uri.spec.split('/', 4),
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

    this._identity = identity;
  },

  set uri(uri) {
    this._uri = uri;
    this._findAndSetIdentity();

    return uri;
  },

  get uri() {
    return this._uri;
  },

  get identity() {
    return this._identity;
  },

  /**
   * Identifier of EEE calendar type.
   *
   * @property {String}
   */
  get type() {
    return 'eee';
  },

  /**
   * Identifier of defining extension of this calendar.
   *
   * @property {String}
   */
  get providerID() {
    return "calendar3e@zonio.net";
  },

  /**
   * Indicator that this calendar is refreshable.
   *
   * @property {Boolean} always true
   */
  get canRefresh() {
    return true;
  },

  /**
   * Unique calendar identifier in EEE domain.
   *
   * @property {String}
   */
  get calspec() {
    var uriParts = this._uri.spec.split('/', 5);

    return uriParts[2] + ":" + (uriParts[4] || uriParts[3]);
  },

  /**
   * Unique calendar identifier in the set user's calendar.
   *
   * @property {String}
   */
  get calname() {
    var uriParts = this._uri.spec.split('/', 5);

    return uriParts[4] || uriParts[3];
  },

  addItem: function calEee_addItem(item, listener) {
    return this.adoptItem(item.clone(), listener);
  },

  adoptItem: function calEee_adoptItem(item, listener) {
    if (null === this._identity) {
      this.notifyOperationComplete(listener,
                                   Cr.NS_ERROR_NOT_INITIALIZED,
                                   Ci.calIOperationListener.ADD,
                                   item.id,
                                   "Unknown identity");
      return null;
    }
    if (this.readOnly) {
      this.notifyOperationComplete(listener,
                                   Ci.calIErrors.CAL_IS_READONLY,
                                   Ci.calIOperationListener.ADD,
                                   item.id,
                                   "Read-only calendar");
      return null;
    }

    try {
      item = item.QueryInterface(Ci.calIEvent);
    } catch (e) {
      this.notifyOperationComplete(listener,
                                   e.result,
                                   Ci.calIOperationListener.ADD,
                                   null,
                                   e.message);
      return null;
    }

    if (item.isMutable && (this.superCalendar !== item.calendar)) {
      item.calendar = this.superCalendar;
    }
    if (item.isMutable && (null == item.id)) {
      item.id = cal.getUUID();
    }

    var calendar = this;
    var clientListener = cal3e.createOperationListener(
      function calEee_adoptItem_onResult(methodQueue, result) {
        if (methodQueue.isFault && !methodQueue.isPending) {
          result = result.QueryInterface(Ci.nsIXmlRpcFault);
          //TODO needs to be more precise
          if (13 /* COMPONENT_EXISTS */ != result.faultCode) {
            throw Component.Exception();
          }
        } else if (methodQueue.isPending) {
          return;
        }
        if (Cr.NS_OK !== methodQueue.status) {
          calendar.notifyOperationComplete(
            listener,
            methodQueue.status,
            Ci.calIOperationListener.ADD,
            item.id,
            "Object addition to EEE server failed");
          return;
        }

        calendar.notifyOperationComplete(listener,
                                         Cr.NS_OK,
                                         Ci.calIOperationListener.ADD,
                                         item.id,
                                         item);
        calendar.mObservers.notify('onAddItem', [item]);
      });

    return this._getClient().addObject(
      this._identity, clientListener, this, item);
  },

  modifyItem: function calEee_modifyItem(newItem, oldItem, listener) {
    if (null === this._identity) {
      this.notifyOperationComplete(listener,
                                   Cr.NS_ERROR_NOT_INITIALIZED,
                                   Ci.calIOperationListener.MODIFY,
                                   newItem.id,
                                   "Unknown identity");
      return null;
    }
    if (this.readOnly) {
      this.notifyOperationComplete(listener,
                                   Ci.calIErrors.CAL_IS_READONLY,
                                   Ci.calIOperationListener.MODIFY,
                                   newItem.id,
                                   "Read-only calendar");
      return null;
    }

    if (!newItem.id) {
      this.notifyOperationComplete(listener,
                                   Cr.NS_ERROR_FAILURE,
                                   Ci.calIOperationListener.MODIFY,
                                   newItem.id,
                                   "Unknown ID of modified item");
      return null;
    }

    try {
      newItem = newItem.QueryInterface(Ci.calIEvent);
    } catch (e) {
      this.notifyOperationComplete(listener,
                                   e.result,
                                   Ci.calIOperationListener.MODIFY,
                                   null,
                                   e.message);
      return null;
    }

    var calendar = this;
    var clientListener = cal3e.createOperationListener(
      function calEee_modifyItem_onResult(methodQueue, result) {
        if (methodQueue.isFault && !methodQueue.isPending) {
          result = result.QueryInterface(Ci.nsIXmlRpcFault);
          //TODO needs to be more precise
          if (13 /* COMPONENT_EXISTS */ != result.faultCode) {
            throw Component.Exception();
          }
        } else if (methodQueue.isPending) {
          return;
        }
        if (Cr.NS_OK !== methodQueue.status) {
          calendar.notifyOperationComplete(
            listener,
            methodQueue.status,
            Ci.calIOperationListener.MODIFY,
            newItem.id,
            "Object addition to EEE server failed");
          return;
        }

        calendar.notifyOperationComplete(listener,
                                         Cr.NS_OK,
                                         Ci.calIOperationListener.MODIFY,
                                         newItem.id,
                                         newItem);
        calendar.mObservers.notify('onModifyItem', [newItem, oldItem]);
      });

    return this._getClient().updateObject(
      this._identity, clientListener, this, newItem);
  },

  deleteItem: function calEee_deleteItem(item, listener) {
    if (null === this._identity) {
      this.notifyOperationComplete(listener,
                                   Cr.NS_ERROR_NOT_INITIALIZED,
                                   Ci.calIOperationListener.DELETE,
                                   item.id,
                                   "Unknown identity");
      return null;
    }
    if (this.readOnly) {
      this.notifyOperationComplete(listener,
                                   Ci.calIErrors.CAL_IS_READONLY,
                                   Ci.calIOperationListener.DELETE,
                                   item.id,
                                   "Read-only calendar");
      return null;
    }

    if (!item.id) {
      this.notifyOperationComplete(listener,
                                   Cr.NS_ERROR_FAILURE,
                                   Ci.calIOperationListener.DELETE,
                                   item.id,
                                   "Unknown ID of deleted item");
      return null;
    }

    try {
      item = item.QueryInterface(Ci.calIEvent);
    } catch (e) {
      this.notifyOperationComplete(listener,
                                   e.result,
                                   Ci.calIOperationListener.DELETE,
                                   null,
                                   e.message);
      return null;
    }

    var calendar = this;
    var clientListener = cal3e.createOperationListener(
      function calEee_deleteItem_onResult(methodQueue, result) {
        if (methodQueue.isFault && !methodQueue.isPending) {
          throw Component.Exception();
        } else if (methodQueue.isPending) {
          return;
        }
        if (Cr.NS_OK !== methodQueue.status) {
          calendar.notifyOperationComplete(
            listener,
            methodQueue.status,
            Ci.calIOperationListener.DELETE,
            item.id,
            "Object deletion to EEE server failed");
          return;
        }

        calendar.notifyOperationComplete(listener,
                                         Cr.NS_OK,
                                         Ci.calIOperationListener.DELETE,
                                         item.id,
                                         item);
        calendar.mObservers.notify('onDeleteItem', [item]);
      });

    return this._getClient().deleteObject(
      this._identity, clientListener, this, item);
  },

  getItem: function calEee_getItem(id, listener) {
    this.notifyOperationComplete(listener,
                                 Cr.NS_ERROR_NOT_IMPLEMENTED,
                                 Ci.calIOperationListener.GET,
                                 id,
                                 "Not implemented");
  },

  getItems: function calEee_getItems(itemFilter, count, rangeStart, rangeEnd,
      listener) {
    if (null === this._identity) {
      this.notifyOperationComplete(listener,
                                   Cr.NS_ERROR_NOT_INITIALIZED,
                                   Ci.calIOperationListener.GET,
                                   null,
                                   "Unknown identity");
      return null;
    }

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

    var calendar = this;
    var clientListener = cal3e.createOperationListener(
      function calEee_getItems_onResult(methodQueue, result) {
        if (methodQueue.isFault && !methodQueue.isPending) {
          throw Component.Exception();
        } else if (methodQueue.isPending) {
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
          calendar.notifyOperationComplete(listener,
                                           e.result,
                                           Ci.calIOperationListener.GET,
                                           null,
                                           e.message);
          return;
        }

        var itemsCount = {};
        var items = parser.getItems(itemsCount);
        var idx = itemsCount.value;
        while (idx--) {
          items[idx].calendar = calendar.superCalendar;
          items[idx].makeImmutable();

          listener.onGetResult(calendar.superCalendar,
                               Cr.NS_OK,
                               Ci.calIEvent,
                               null,
                               1,
                               [items[idx]]);

          cal.processPendingEvent();
        }

        calendar.notifyOperationComplete(listener,
                                         Cr.NS_OK,
                                         Ci.calIOperationListener.GET,
                                         null,
                                         null);
      });

    return this._getClient().queryObjects(
      this._identity, clientListener, this,
      rangeStart ? rangeStart.nativeTime : null,
      rangeStart ? rangeEnd.nativeTime : null);
  },

  /**
   * Refreshes this calendar by notifying its observer.
   */
  refresh: function calEee_refresh() {
    this.mObservers.notify('onLoad', [this]);
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

EXPORTED_SYMBOLS = [
  'calEeeCalendar'
];
