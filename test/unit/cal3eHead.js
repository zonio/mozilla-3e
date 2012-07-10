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

(function load_lightning_manifest() {
  let bindir = Components.classes["@mozilla.org/file/directory_service;1"].
    getService(Components.interfaces.nsIProperties).
    get("CurProcD", Components.interfaces.nsIFile);
  bindir.append("extensions");
  bindir.append("{e2fda1a4-762b-4020-b5ad-a41df1933103}");
  bindir.append("chrome.manifest");
  Components.manager.autoRegister(bindir);
})();

(function load_calendar3e_manifest() {
  let bindir = Components.classes["@mozilla.org/file/directory_service;1"].
    getService(Components.interfaces.nsIProperties).
    get("CurWorkD", Components.interfaces.nsIFile).
    parent.parent.parent.parent.parent.parent.parent;
  bindir.append("dist");
  bindir.append("bin");
  bindir.append("extensions");
  bindir.append("calendar3e@zonio.net");
  bindir.append("chrome.manifest");
  Components.manager.autoRegister(bindir);
})();
