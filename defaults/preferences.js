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
/*
#filter substitution
*/

pref('extensions.calendar3e.calendar_sync_interval', 15000);
pref('extensions.calendar3e.queue_execution_interval', 500);
pref('extensions.calendar3e.user_error_timeout', 300000);

pref('extensions.calendar3e.log.xml_rpc', false);

pref('extensions.calendar3e.features.attachments', false);
pref('extensions.calendar3e.features.sidebar', false);
/*
#ifdef CALENDAR_3E_PERMISSION
*/
pref('extensions.calendar3e.features.permissions', true);
/*
#else
*/
pref('extensions.calendar3e.features.permissions', false);
/*
#endif
*/
pref('extensions.calendar3e.features.offline_mode', false);

pref('extensions.calendar3e.log.synchronizer.logDevice', 'console');
pref('extensions.calendar3e.log.synchronizer.severity', 'warn');
pref('extensions.calendar3e.log.synchronizer.name', 'calendar3e.synchronizer');

pref('extensions.calendar3e.log.manager.logDevice', 'console');
pref('extensions.calendar3e.log.manager.severity', 'warn');
pref('extensions.calendar3e.log.manager.name', 'calendar3e.manager');

pref('extensions.calendar3e.log.freeBusy.logDevice', 'console');
pref('extensions.calendar3e.log.freeBusy.severity', 'warn');
pref('extensions.calendar3e.log.freeBusy.name', 'calendar3e.freeBusy');
