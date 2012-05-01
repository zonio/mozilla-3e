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
 
const Cc = Components.classes;
const Ci = Components.interfaces;

cal3eSelectAttach = function() {
  
    var fcBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
               .getService(Components.interfaces.nsIStringBundleService)
               .createBundle("chrome://calendar3e/locale/cal3eCalendar.properties");
    
    var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window, fcBundle.GetStringFromName("cal3eAttach.selectFile"), Ci.nsIFilePicker.modeOpen);
    
    var res = fp.show();
    
    if (res != Ci.nsIFilePicker.returnCancel) {
        dump("file: " + fp.file.path + "\n");
        
        var result = { value : "file://" + fp.file.path };
        try {
            // If something bogus was entered, makeURL may fail.
            var attachment = createAttachment();
            attachment.uri = makeURL(result.value);
            addAttachment(attachment);
        } catch (e) {
            // TODO We might want to show a warning instead of just not
            // adding the file
        }
    }
    
};
