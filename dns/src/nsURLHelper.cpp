/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* vim:set ts=4 sw=4 sts=4 et cindent: */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Andreas Otte.
 * Portions created by the Initial Developer are Copyright (C) 2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Darin Fisher <darin@netscape.com>
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

#include "nsURLHelper.h"
#include "prnetdb.h"

//----------------------------------------------------------------------------
// miscellaneous (i.e., stuff that should really be elsewhere)
//----------------------------------------------------------------------------

char *
net_FindCharNotInSet(const char *iter, const char *stop, const char *set)
{
repeat:
    for (const char *s = set; *s; ++s) {
        if (*iter == *s) {
            if (++iter == stop)
                break;
            goto repeat;
        }
    }
    return (char *) iter;
}

PRBool
net_IsValidHostName(const nsDependentCString &host)
{
    const char *end = host.EndReading();
    // Use explicit whitelists to select which characters we are
    // willing to send to lower-level DNS logic. This is more
    // self-documenting, and can also be slightly faster than the
    // blacklist approach, since DNS names are the common case, and
    // the commonest characters will tend to be near the start of
    // the list.

    // Whitelist for DNS names (RFC 1035) with extra characters added 
    // for pragmatic reasons "$+_"
    // see https://bugzilla.mozilla.org/show_bug.cgi?id=355181#c2
    if (net_FindCharNotInSet(host.BeginReading(), end,
                             "abcdefghijklmnopqrstuvwxyz"
                             ".-0123456789"
                             "ABCDEFGHIJKLMNOPQRSTUVWXYZ$+_") == end)
        return PR_TRUE;

    // Might be a valid IPv6 link-local address containing a percent sign
    nsCAutoString strhost(host);
    PRNetAddr addr;
    return PR_StringToNetAddr(strhost.get(), &addr) == PR_SUCCESS;
}