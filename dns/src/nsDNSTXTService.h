/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla.
 *
 * The Initial Developer of the Original Code is IBM Corporation.
 * Portions created by IBM Corporation are Copyright (C) 2003
 * IBM Corporation. All Rights Reserved.
 *
 * Contributor(s):
 *   IBM Corp.
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include "nsPIDNSTXTService.h"
#include "nsIObserver.h"
#include "nsHostResolver.h"
#include "nsAutoPtr.h"
#include "nsStringAPI.h"
#include "prlock.h"

#define NS_DNSTXTSERVICE_CLASSNAME \
    "nsDNSTXTService"
#define NS_DNSTXTSERVICE_CONTRACTID \
    "@mozilla.org/network/dns-txt-service;1"
#define NS_DNSTXTSERVICE_CID \
{ /* 6ed64adc-c45f-4a4e-aea2-09e429c5a286 */         \
    0x6ed64adc,                                      \
    0xc45f,                                          \
    0x4a4e,                                          \
    {0xae, 0xa2, 0x09, 0xe4, 0x29, 0xc5, 0xa2, 0x86} \
}
class nsDNSTXTService : public nsPIDNSTXTService
                      , public nsIObserver
{
public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSPIDNSTXTSERVICE
    NS_DECL_NSIDNSTXTSERVICE
    NS_DECL_NSIOBSERVER

    nsDNSTXTService();
    ~nsDNSTXTService();

private:
    nsRefPtr<nsHostResolver>  mResolver;

    // mLock protects access to mResolver
    PRLock                   *mLock;
};
