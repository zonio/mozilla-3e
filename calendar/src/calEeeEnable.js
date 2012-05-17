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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");  

function calEeeEnable() {}

calEeeEnable.prototype = {
    
    name: "enable3e",
    chromePackageName: "calendar3e",
    classDescription: "Enable 3e calendar - Account Manager Extension",
    classID: Components.ID("{3892b01b-7e8f-4727-9087-ef4d814f7456}"),
    //contractID: "@zonio.net/calendar3e/enable3e;1",
    contractID: "@mozilla.org/accountmanager/extension;1?name=enable3e",
    
    // Add the component to the mailnews-accountmanager-extensions category
    _xpcom_categories: [{
        category: "mailnews-accountmanager-extensions"
    }],

    QueryInterface: XPCOMUtils.generateQI([
        Components.interfaces.nsIMsgAccountManagerExtension
    ]),
    
    // don't show the panel for news, rss, or local accounts
    showPanel: function(server) {
        dump("calEeeEnable showPanel() called.\n");
        return (server.type != "nntp" && server.type != "rss" && server.type != "none");
    }
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([calEeeEnable]);
