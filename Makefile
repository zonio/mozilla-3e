# ***** BEGIN LICENSE BLOCK *****
# Mozilla 3e Calendar Extension
# Copyright © 2010  Zonio s.r.o.
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
# ***** END LICENSE BLOCK ***** */

ifndef XULRUNNER_SDK
  XULRUNNER_SDK=./xulrunner-sdk
endif
ifndef TB_SRC
  TB_SRC=./comm-1.9.2
endif

mozilla-plugin: all
all:
	rm -f 3E-Calendar.xpi
	${XULRUNNER_SDK}/bin/xpidl -I ${XULRUNNER_SDK}/idl -I ${TB_SRC}/calendar/base/public -w -v -o ./components/calEeeModule -m typelib ./public/calEeeI*.idl
	${XULRUNNER_SDK}/bin/xpidl -I ${XULRUNNER_SDK}/idl -w -v -o ./components/nsXmlRpc -m typelib ./public/nsI*.idl
	zip -r 3E-Calendar.xpi chrome.manifest components content install.rdf js locale skin
