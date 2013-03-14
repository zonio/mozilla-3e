# ***** BEGIN LICENSE BLOCK *****
# 3e Calendar
# Copyright © 2012  Zonio s.r.o.
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

MOZ_APP_NAME=calendar3e
MOZ_CHROME_FILE_FORMAT=omni
MOZ_NO_ACTIVEX_SUPPORT=1
MOZ_ACTIVEX_SCRIPTING_SUPPORT=
MOZ_APP_VERSION_TXT=${_topsrcdir}/$MOZ_BUILD_APP/config/version.txt
MOZ_APP_VERSION=`cat $MOZ_APP_VERSION_TXT`
CALENDAR_3E_VERSION=$MOZ_APP_VERSION

# Disabled to improve build speed
MOZ_FEEDS=
MOZ_PLACES=
MOZ_SMIL=
MOZ_TOOLKIT_SEARCH=
MOZ_ZIPWRITER=
MOZ_MORK=
MOZ_MORKREADER=
MOZ_OGG=
MOZ_SYDNEYAUDIO=
MOZ_WAVE=
MOZ_MEDIA=
MOZ_VORBIS=
MOZ_WEBM=
MOZ_DASH=
MOZ_WEBGL=
MOZ_XTF=

