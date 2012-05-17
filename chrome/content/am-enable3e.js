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


var EEE_ENABLED_KEY = 'eee_enabled';
var gIdentity = null;

function onPreInit(account, accountValues) {
    gIdentity = account.defaultIdentity;
}

function onInit() {
    var enableState = gIdentity.getBoolAttribute(EEE_ENABLED_KEY);
    var checkbox = document.getElementById("cal3e-enable-checkbox");
    
    if (!enableState) {
        checkbox.setAttribute("checked", "false");
    }
    
    return true;
}

function onSave() {
    var checkBox = document.getElementById("cal3e-enable-checkbox");
    var enableState = checkBox.getAttribute("checked");
        
    if (enableState == "true") {
        gIdentity.setBoolAttribute(EEE_ENABLED_KEY, true);
    } else {
        gIdentity.setBoolAttribute(EEE_ENABLED_KEY, false);
    }
}
