# ***** BEGIN LICENSE BLOCK *****
# 3e Calendar
# Copyright © 2011  Zonio s.r.o.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
# ***** END LICENSE BLOCK *****

# Originally from gdata provider.

# This file is used to build the calendar3e provider without the rest
# of mozilla. To do so, you need to use trunk and the following
# mozconfig:

# # Options for client.mk.
# mk_add_options MOZ_OBJDIR=@TOPSRCDIR@/obj-calendar3e
#
# mk_add_options AVAILABLE_PROJECTS="calendar3e"
#
# # Needed to keep toolkit from building (if required)
# export LIBXUL_SDK=1

# # Extra modules and files
# mk_add_options MODULES_calendar3e="mozilla/config mozilla/build mozilla/probes mozilla/calendar/providers/calendar3e"
# mk_add_options MODULES_NS_calendar3e="mozilla/"


# # Options for 'configure' (same as command-line options).
# ac_add_options --enable-application=calendar/providers/calendar3e
# ac_add_options --disable-tests

TIERS += app
tier_app_dirs += calendar/providers/calendar3e
