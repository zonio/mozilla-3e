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

function cal3ePermissions() {
  function listUsersAndGroups() {
    dump('[3e] cal3ePermissions.listUsersAndGroups() called.\n');
  }
};

cal3ePermissions.open = function cal3ePermissions_open() {
  openDialog(
    'chrome://calendar3e/content/permissions.xul',
    'cal3ePermissions',
    'chrome,titlebar,modal'
  );
};

cal3ePermissions.onLoad = function cal3ePermissions_onLoad() {
  dump('[3e] cal3ePermissions.onLoad called.\n');
  cal3ePermissions.controller = new cal3ePermissions();

  cal3ePermissions.controller.listUsersAndGroups();
};

cal3ePermissions.addRead = function cal3ePermissions_addRead() {
  dump('[3e] cal3ePermissions.addRead() called\n');
};

cal3ePermissions.addReadWrite = function cal3ePermissions_addReadWrite() {
  dump('[3e] cal3ePermissions.addReadWrite() called\n');
};
