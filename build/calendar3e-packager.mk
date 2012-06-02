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

_ABS_DIST := $(call core_abspath,$(DIST))
ZIP_IN ?= $(_ABS_DIST)/xpi-stage/$(XPI_NAME).xpi

$(DIST)/xpi-stage:
	mkdir -p $@

unpack: $(ZIP_IN)
# We're unpacking directly into FINAL_TARGET, this keeps code to do
# manual repacks cleaner.
	if test -d $(DIST)/xpi-stage/$(XPI_NAME); then \
	  $(RM) -r -v $(DIST)/xpi-stage/$(XPI_NAME); \
	fi
	$(NSINSTALL) -D $(DIST)/xpi-stage/$(XPI_NAME)
	cd $(DIST)/xpi-stage/$(XPI_NAME) && $(UNZIP) $(ZIP_IN)
	@echo done unpacking

UPLOAD_FILES = \
  calendar3e-provider.xpi \
  $(NULL)

stage_upload:
	$(NSINSTALL) -D $(DIST)/$(MOZ_PKG_PLATFORM)
	$(INSTALL) $(IFLAGS1) $(addprefix $(DIST)/xpi-stage/,$(UPLOAD_FILES)) $(DIST)/$(MOZ_PKG_PLATFORM)

upload: stage_upload
	$(PYTHON) $(MOZILLA_DIR)/build/upload.py --base-path $(DIST) \
	  $(addprefix $(DIST)/$(MOZ_PKG_PLATFORM)/,$(UPLOAD_FILES))
