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

###################################
# Warning this code is copied
# from mozilla-central/Makefile.in
# and needs to be kept in sync.
###################################
SYMBOL_INDEX_NAME = \
   $(MOZ_APP_NAME)-$(MOZ_APP_VERSION)-$(OS_TARGET)-$(BUILDID)$(EXTRA_BUILDID)-symbols.txt

include $(MOZILLA_SRCDIR)/toolkit/mozapps/installer/package-name.mk

ifeq ($(OS_ARCH),WINNT)
# we want to copy PDB files on Windows
MAKE_SYM_STORE_ARGS := -c --vcs-info
ifdef PDBSTR_PATH
MAKE_SYM_STORE_ARGS += -i
endif
DUMP_SYMS_BIN ?= $(MOZILLA_SRCDIR)/toolkit/crashreporter/tools/win32/dump_syms_vc$(_MSC_VER).exe
# PDB files don't get moved to dist, so we need to scan the whole objdir
MAKE_SYM_STORE_PATH := $(DEPTH)
endif
ifeq ($(OS_ARCH),Darwin)
MAKE_SYM_STORE_ARGS := -c -a $(OS_TEST) --vcs-info
DUMP_SYMS_BIN ?= $(DIST)/host/bin/dump_syms
MAKE_SYM_STORE_PATH := $(DIST)/xpi-stage/calendar3e-provider
endif
ifeq (,$(filter-out Linux SunOS,$(OS_ARCH)))
MAKE_SYM_STORE_ARGS := -c --vcs-info
DUMP_SYMS_BIN ?= $(DIST)/host/bin/dump_syms
MAKE_SYM_STORE_PATH := $(DIST)/xpi-stage/calendar3e-provider
endif

SYM_STORE_SOURCE_DIRS := $(topsrcdir)

buildsymbols:
ifdef MOZ_CRASHREPORTER
ifdef USE_ELF_HACK
	$(MAKE) -C $(MOZ_BUILD_APP)/installer elfhack
endif
	echo building symbol store
	$(RM) -r $(DIST)/crashreporter-symbols
	$(RM) "$(DIST)/$(SYMBOL_ARCHIVE_BASENAME).zip"
	$(NSINSTALL) -D $(DIST)/crashreporter-symbols
	$(PYTHON) $(MOZILLA_SRCDIR)/toolkit/crashreporter/tools/symbolstore.py \
	  $(MAKE_SYM_STORE_ARGS)                                          \
	  $(foreach dir,$(SYM_STORE_SOURCE_DIRS),-s $(dir))               \
	  $(DUMP_SYMS_BIN)                                                \
	  $(DIST)/crashreporter-symbols                                   \
	  $(MAKE_SYM_STORE_PATH) >                                        \
	  $(DIST)/crashreporter-symbols/$(SYMBOL_INDEX_NAME)
	echo packing symbols
	$(NSINSTALL) -D $(DIST)/$(PKG_PATH)
	cd $(DIST)/crashreporter-symbols && \
	  zip -r9D "../$(PKG_PATH)$(SYMBOL_FULL_ARCHIVE_BASENAME).zip" .
	cd $(DIST)/crashreporter-symbols && \
	  grep "sym" $(SYMBOL_INDEX_NAME) > $(SYMBOL_INDEX_NAME).tmp && \
	  mv $(SYMBOL_INDEX_NAME).tmp $(SYMBOL_INDEX_NAME)
	cd $(DIST)/crashreporter-symbols && \
          zip -r9D "../$(PKG_PATH)$(SYMBOL_ARCHIVE_BASENAME).zip" . -i "*.sym" -i "*.txt"
endif # MOZ_CRASHREPORTER

uploadsymbols:
ifdef MOZ_CRASHREPORTER
	$(SHELL) $(MOZILLA_SRCDIR)/toolkit/crashreporter/tools/upload_symbols.sh $(SYMBOL_INDEX_NAME) "$(DIST)/$(PKG_PATH)$(SYMBOL_FULL_ARCHIVE_BASENAME).zip"
endif

###################################
# END Warning
###################################
