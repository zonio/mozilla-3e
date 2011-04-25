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

SHELL = /bin/sh
NULL :=
SPACE := $(NULL) $(NULL)
CC = cc
CXX = c++
LD = ld

ifdef VPATH
  srcdir = $(firstword $(subst :,$(SPACE),$(VPATH)))
else
  srcdir = .
endif

ifndef XULRUNNER_NAME
  XULRUNNER_NAME = xulrunner-devel
endif
ifndef XULRUNNER_VERSION
  XULRUNNER_VERSION = 1.9.2.15
endif

ifndef XULRUNNER_SDK_PATH
  ifneq ($(XULRUNNER_VERSION),)
    XULRUNNER_SDK_PATH = /usr/lib/$(XULRUNNER_NAME)-$(XULRUNNER_VERSION)
  else
    XULRUNNER_SDK_PATH = /usr/lib/$(XULRUNNER_NAME)
  endif
endif
ifndef XULRUNNER_INCLUDE_PATH
  XULRUNNER_INCLUDE_PATH = $(XULRUNNER_SDK_PATH)/include
endif
ifndef XULRUNNER_IDL_PATH
  XULRUNNER_IDL_PATH = $(XULRUNNER_SDK_PATH)/idl
endif
ifndef XULRUNNER_LIB_PATH
  XULRUNNER_LIB_PATH = $(XULRUNNER_SDK_PATH)/lib
endif

ifndef THUNDERBIRD_NAME
  THUNDERBIRD_NAME = thunderbird-devel
endif
ifndef THUNDERBIRD_VERSION
  THUNDERBIRD_VERSION = 3.1.9
endif

ifndef THUNDERBIRD_SDK_PATH
  ifneq ($(THUNDERBIRD_VERSION),)
    THUNDERBIRD_SDK_PATH = /usr/lib/$(THUNDERBIRD_NAME)-$(THUNDERBIRD_VERSION)
  else
    THUNDERBIRD_SDK_PATH = /usr/lib/$(THUNDERBIRD_NAME)
  endif
endif
ifndef THUNDERBIRD_INCLUDE_PATH
  THUNDERBIRD_INCLUDE_PATH = $(THUNDERBIRD_SDK_PATH)/include
endif
ifndef THUNDERBIRD_IDL_PATH
  THUNDERBIRD_IDL_PATH = $(THUNDERBIRD_SDK_PATH)/idl
endif
ifndef THUNDERBIRD_LIB_PATH
  THUNDERBIRD_LIB_PATH = $(THUNDERBIRD_SDK_PATH)/lib
endif

XPIDL = ${XULRUNNER_SDK_PATH}/bin/xpidl
XPIDL_TYPELIB = $(XPIDL) -m typelib -I $(XULRUNNER_IDL_PATH)
XPIDL_HEADER = $(XPIDL) -m header -I $(XULRUNNER_IDL_PATH)
XPT_LINK = $(XULRUNNER_SDK_PATH)/bin/xpt_link

override DEFS += -DXPCOM_GLUE
override INCLUDES += -include xpcom-config.h -include mozilla-config.h 
override CFLAGS += $(DEFS) $(INCLUDES) \
          -DHAVE_RES_NINIT \
          -Iinclude \
          -I$(XULRUNNER_INCLUDE_PATH) \
          -I$(THUNDERBIRD_INCLUDE_PATH) \
          $(NULL)
override CXXFLAGS += $(CFLAGS) \
            -fno-rtti \
            -fno-exceptions \
            -shared \
            $(NULL)
override LDFLAGS += -L$(XULRUNNER_LIB_PATH) \
           -lxpcomglue \
           -lnspr4 \
           -lplds4 \
           -lresolv \
           $(NULL)
LIB_FLAG = -dylib
LIB_SUFFIX = .dylib

DNS_IDLS = dns/public/nsIDNSTXTListener.idl \
           dns/public/nsIDNSTXTResult.idl \
           dns/public/nsIDNSTXTRequest.idl \
           dns/public/nsIDNSTXTService.idl \
           $(NULL)
DNS_CSRCS = dns/src/dns.c \
            $(NULL)
DNS_CPPSRCS = dns/src/nsURLHelper.cpp \
              dns/src/nsHostResolver.cpp \
              dns/src/nsDNSTXTService.cpp \
              $(NULL)

XMLRPC_XPTS = xml-rpc/public/nsIDictionary.xpt \
              xml-rpc/public/nsIXmlRpcClient.xpt \
              xml-rpc/public/nsIXmlRpcClientListener.xpt \
              $(NULL)
XMLRPC_JSSRCS = components/nsDictionary.js \
                components/nsXmlRpcClient.js \
                $(NULL)

CALENDAR_XPTS = calendar/public/calEeeICalendar.xpt \
                calendar/public/calEeeIClient.xpt \
                calendar/public/calEeeIMethodQueue.xpt \
                calendar/public/calEeeISynchronizer.xpt \
                $(NULL)
CALENDAR_JSSRCS = calendar/src/calEeeCalendarModule.js \
                  calendar/src/cal3eUtils.jsm \
                  calendar/src/calEeeCalendar.js \
                  calendar/src/calEeeClient.js \
                  calendar/src/calEeeMethodQueue.js \
                  calendar/src/calEeeProtocol.js \
                  calendar/src/calEeeSynchronizer.js \
                  $(NULL)

CHROME_CONTENT = content/cal3eCalendarSubscribeDialog.js \
                 content/cal3eCalendarSubscribeDialog.xul \
                 content/cal3ePreferences.js \
                 content/cal3ePreferences.xul \
                 content/cal3eSync.js \
                 content/cal3eSync.xul \
                 content/calendarContextMenu.xul \
                 content/calendarCreation.js \
                 content/calendarCreation.xul \
                 content/calendarProperties.js \
                 content/calendarProperties.xul \
                 $(NULL)

CHROME_LOCALE = locale/en-US/cal3eCalendar.dtd \
                locale/en-US/cal3eCalendar.properties \
                locale/en-US/cal3ePreferences.dtd \
                $(NULL)

CHROME_SKIN = skin/cal3eGlobal.css

CHROME_MANIFEST = chrome.manifest

XPI_DEFINITION = install.rdf

.PHONY: build
build: prepare dns-module xml-rpc-module calendar-module chrome

.PHONY: prepare
prepare:
	install -d components include js content locale skin \
	           dns/public dns/obj xml-rpc/public calendar/public

.PHONY: dns-module
dns-module: dns-xpts dns-headers dns-libs

.PHONY: dns-xpts
dns-xpts: components/dns.xpt

components/dns.xpt: $(patsubst %.idl,%.xpt,$(DNS_IDLS))
	$(XPT_LINK) components/dns.xpt $^

$(patsubst %.idl,%.xpt,$(DNS_IDLS)): $(DNS_IDLS)
	$(XPIDL_TYPELIB) -w -v -e $@ $(srcdir)/$(patsubst %.xpt,%.idl,$@)

.PHONY: dns-headers
dns-headers: $(patsubst dns/public/%.idl,include/%.h,$(DNS_IDLS))

$(patsubst dns/public/%.idl,include/%.h,$(DNS_IDLS)): $(DNS_IDLS)
	$(XPIDL_HEADER) -e $@ $(srcdir)/$(patsubst include/%.h,dns/public/%.idl,$@)

.PHONY: dns-c-objs
dns-c-objs: $(patsubst dns/src/%.c,dns/obj/%.o,$(DNS_CSRCS))

$(patsubst dns/src/%.c,dns/obj/%.o,$(DNS_CSRCS)): $(DNS_CSRCS)
	$(CC) -c -Wall -Os -o $@ $(CFLAGS) $(srcdir)/$(patsubst dns/obj/%.o,dns/src/%.c,$@)

.PHONY: dns-cpp-objs
dns-cpp-objs: $(patsubst dns/src/%.cpp,dns/obj/%.o,$(DNS_CPPSRCS))

$(patsubst dns/src/%.cpp,dns/obj/%.o,$(DNS_CPPSRCS)): $(DNS_CPPSRCS)
	$(CXX) -c -Wall -Os -o $@ $(CXXFLAGS) $(srcdir)/$(patsubst dns/obj/%.o,dns/src/%.cpp,$@)

.PHONY: dns-libs
dns-libs: components/dns.$(LIB_SUFFIX)

components/dns.$(LIB_SUFFIX): $(patsubst dns/src/%.c,dns/obj/%.o,$(DNS_CSRCS)) $(patsubst dns/src/%.cpp,dns/obj/%.o,$(DNS_CPPSRCS))
	$(LD) $^ $(LDFLAGS) $(LIB_FLAG) -o components/dns.$(LIB_SUFFIX)

.PHONY: dist
dist: calendar3e.xpi

calendar3e.xpi: build
	zip -x '*~' '#*#' -r calendar3e.xpi chrome.manifest		\
					    install.rdf components js	\
					    content locale skin

.PHONY: clean
ifdef VPATH
clean:
	rm -r components/ include/ \
	      dns/ xml-rpc/ calendar/ \
	      js/ \
	      content/ locale/ skin/
else
clean:
	rm -r components/*.xpt include/ \
	      dns/public/*.xpt \
	      xmlrpc/public/*.xpt \
	      calendar/public/*.xpt \
	      js/
endif

.PHONY: distclean
distclean:
	rm calendar3e.xpi
