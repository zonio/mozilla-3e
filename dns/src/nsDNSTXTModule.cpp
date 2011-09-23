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

#include "mozilla/ModuleUtils.h"
#include "nsIClassInfoImpl.h"

#include "nsDNSTXTService.h"
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsDNSTXTService, Init)
NS_DEFINE_NAMED_CID(NS_DNSTXTSERVICE_CID);

static const mozilla::Module::CIDEntry kDNSTXTCIDs[] = {
    { &kNS_DNSTXTSERVICE_CID, false, NULL, nsDNSTXTServiceConstructor },
    { NULL }
};

static const mozilla::Module::ContractIDEntry kDNSTXTContracts[] = {
    { NS_DNSTXTSERVICE_CONTRACTID, &kNS_DNSTXTSERVICE_CID },
    { NULL }
};

static const mozilla::Module::CategoryEntry kDNSTXTCategories[] = {
    { NULL }
}

static const mozilla::Module kDNSTXTModule = {
    mozilla::Module::kVersion,
    kDNSTXTCIDs,
    kDNSTXTContracts,
    kDNSTXTCategories
};

NSMODULE_DEFN(nsDNSTXTModule) = &kDNSTXTModule;
