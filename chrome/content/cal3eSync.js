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

//XXX This must be resolved using categories and observers.

window.addEventListener('load', function cal3eSync_onLoad() {
  var synchronizationService =
    Components.classes["@zonio.net/calendar3e/synchronization-service;1"]
    .getService(Components.interfaces.calEeeISynchronizationService);
  synchronizationService.register();

  var manager =
    Components.classes["@zonio.net/calendar3e/manager;1"]
    .getService(Components.interfaces.calEeeIManager);
  manager.register();
}, false);

window.addEventListener('unload', function cal3eSync_onUnload() {
  var synchronizationService =
    Components.classes["@zonio.net/calendar3e/synchronization-service;1"]
    .getService(Components.interfaces.calEeeISynchronizationService);
  synchronizationService.unregister();

  var manager =
    Components.classes["@zonio.net/calendar3e/manager;1"]
    .getService(Components.interfaces.calEeeIManager);
  manager.unregister();
}, false);
