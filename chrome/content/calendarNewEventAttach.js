/* ***** BEGIN LICENSE BLOCK *****
 * 3e Calendar
 * Copyright © 2012  Zonio s.r.o.
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
 
var gEventDialog = document.getElementById("calendar-event-dialog");

cal3eSelectAttach = function() {
    // XXX When called more than once error occurs
    var calendar = getCurrentCalendar();
    
    if (calendar.type == "eee") {
        var attachButton = document.getElementById("button-url");
        //attachButton.removeAttribute("oncommand");
        attachButton.setAttribute("oncommand", "attachFile()");
        //attachButton.oncommand = "attachFile()";
        attachButton.label = "Attach File";
    }
    
};

gEventDialog.addEventListener("load", cal3eSelectAttach, false);
