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

ifndef OBJDIR
OBJDIR_ARCH_1 = $(MOZ_OBJDIR)/$(firstword $(MOZ_BUILD_PROJECTS))
OBJDIR_ARCH_2 = $(MOZ_OBJDIR)/$(word 2,$(MOZ_BUILD_PROJECTS))
DIST_ARCH_1 = $(OBJDIR_ARCH_1)/mozilla/dist
DIST_ARCH_2 = $(OBJDIR_ARCH_2)/mozilla/dist
DIST_UNI = $(DIST_ARCH_1)/universal
OBJDIR = $(OBJDIR_ARCH_1)
endif

# This is fine as long as the calendar3e provider has no binary components.
postflight_all:
	mkdir -p $(DIST_UNI)/xpi-stage
	cp $(DIST_ARCH_1)/xpi-stage/calendar3e-provider.xpi $(DIST_UNI)/xpi-stage
