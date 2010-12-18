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
  XULRUNNER_SDK = ./xulrunner-sdk
endif
ifndef TB_SRC
  TB_SRC = ./comm-1.9.2
endif

XPIDL = ${XULRUNNER_SDK}/bin/xpidl -m typelib -w -v -I ${XULRUNNER_SDK}/idl

NS_XPTS = components/nsIDictionary.xpt components/nsIXmlRpcClient.xpt \
	  components/nsIXmlRpcClientListener.xpt
EEE_XPTS = components/calEeeIClient.xpt components/calEeeIMethodQueue.xpt
XPTS = ${NS_XPTS} ${EEE_XPTS}


calendar3e.xpi: ${XPTS}
	zip -x "*~" -r calendar3e.xpi chrome.manifest install.rdf components \
				      js content locale skin

.PHONY : xpts clean

xpts: ${XPTS}

clean:
	-rm calendar3e.xpi components/*.xpt


components/calEeeIClient.xpt: public/calEeeIClient.idl
	${XPIDL} -I ${TB_SRC}/calendar/base/public -I public \
		 -o components/calEeeIClient \
		 public/calEeeIClient.idl
components/calEeeIMethodQueue.xpt: public/calEeeIMethodQueue.idl
	${XPIDL} -I ${TB_SRC}/calendar/base/public -I public \
		 -o components/calEeeIMethodQueue \
		 public/calEeeIMethodQueue.idl

components/nsIDictionary.xpt: public/nsIDictionary.idl
	${XPIDL} -o components/nsIDictionary \
		 public/nsIDictionary.idl
components/nsIXmlRpcClientListener.xpt: public/nsIXmlRpcClientListener.idl
	${XPIDL} -o components/nsIXmlRpcClientListener \
		 public/nsIXmlRpcClientListener.idl
components/nsIXmlRpcClient.xpt: public/nsIXmlRpcClientListener.idl \
				public/nsIXmlRpcClient.idl
	${XPIDL} -I public \
		 -o components/nsIXmlRpcClient \
		 public/nsIXmlRpcClient.idl
