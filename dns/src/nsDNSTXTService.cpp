/* vim:set ts=4 sw=4 sts=4 et cin: */
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

#include "nsDNSTXTService.h"
#include "nsIDNSTXTResult.h"
#include "nsIDNSTXTListener.h"
#include "nsICancelable.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIPrefBranch2.h"
#include "nsIServiceManager.h"
#include "nsReadableUtils.h"
#include "nsString.h"
#include "nsAutoLock.h"
#include "nsAutoPtr.h"
#include "nsNetCID.h"
#include "nsNetError.h"
#include "prsystem.h"
#include "prnetdb.h"
#include "prmon.h"
#include "prio.h"
#include "plstr.h"

static const char kPrefDnsTxtCacheEntries[]    = "network.dnsTxtCacheEntries";
static const char kPrefDnsTxtCacheExpiration[] = "network.dnsTxtCacheExpiration";

//-----------------------------------------------------------------------------

class nsDNSTXTResult : public nsIDNSTXTResult
{
public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIDNSTXTRESULT

    nsDNSTXTResult(nsHostRecord *hostRecord)
        : mHostRecord(hostRecord)
        , mIter(nsnull)
        , mIterGenCnt(-1)
        , mDone(PR_FALSE) {}

private:
    virtual ~nsDNSTXTResult() {}

    nsRefPtr<nsHostRecord>  mHostRecord;
    void                   *mIter;
    int                     mIterGenCnt; // the generation count of
                                         // mHostRecord->addr_info when we
                                         // start iterating
    PRBool                  mDone;
};

NS_IMPL_THREADSAFE_ISUPPORTS1(nsDNSTXTResult, nsIDNSTXTResult)

NS_IMETHODIMP
nsDNSTXTResult::GetNextRecord(PRUint16 port, PRNetAddr *addr)
{
    // not a programming error to poke the DNS record when it has no
    // more entries.  just fail without any debug warnings.  this
    // enables consumers to enumerate the DNS record without calling
    // HasMore.
    if (mDone)
        return NS_ERROR_NOT_AVAILABLE;

    PR_Lock(mHostRecord->addr_info_lock);
    if (mHostRecord->addr_info) {
        if (!mIter)
            mIterGenCnt = mHostRecord->addr_info_gencnt;
        else if (mIterGenCnt != mHostRecord->addr_info_gencnt) {
            // mHostRecord->addr_info has changed, so mIter is
            // invalid.  Restart the iteration.  Alternatively, we
            // could just fail.
            mIter = nsnull;
            mIterGenCnt = mHostRecord->addr_info_gencnt;
        }
        mIter = PR_EnumerateAddrInfo(mIter, mHostRecord->addr_info, port, addr);
        PR_Unlock(mHostRecord->addr_info_lock);
        if (!mIter) {
            mDone = PR_TRUE;
            return NS_ERROR_NOT_AVAILABLE;
        }
    }
    else {
        PR_Unlock(mHostRecord->addr_info_lock);
        if (!mHostRecord->addr) {
            // Both mHostRecord->addr_info and mHostRecord->addr are null.
            // This can happen if mHostRecord->addr_info expired and the
            // attempt to reresolve it failed.
            return NS_ERROR_NOT_AVAILABLE;
        }
        memcpy(addr, mHostRecord->addr, sizeof(PRNetAddr));
        // set given port
        port = PR_htons(port);
        if (addr->raw.family == PR_AF_INET)
            addr->inet.port = port;
        else
            addr->ipv6.port = port;
        mDone = PR_TRUE; // no iterations
    }
        
    return NS_OK; 
}

NS_IMETHODIMP
nsDNSTXTResult::GetNextRecordAsString(nsACString &result)
{
    PRNetAddr addr;
    nsresult rv = GetNextRecord(0, &addr);
    if (NS_FAILED(rv)) return rv;

    char buf[64];
    if (PR_NetAddrToString(&addr, buf, sizeof(buf)) == PR_SUCCESS) {
        result.Assign(buf);
        return NS_OK;
    }
    NS_ERROR("PR_NetAddrToString failed unexpectedly");
    return NS_ERROR_FAILURE; // conversion failed for some reason
}

NS_IMETHODIMP
nsDNSTXTResult::HasMore(PRBool *result)
{
    if (mDone)
        *result = PR_FALSE;
    else {
        // unfortunately, NSPR does not provide a way for us to determine if
        // there is another address other than to simply get the next address.
        void *iterCopy = mIter;
        PRNetAddr addr;
        *result = NS_SUCCEEDED(GetNextRecord(0, &addr));
        mIter = iterCopy; // backup iterator
        mDone = PR_FALSE;
    }
    return NS_OK;
}

NS_IMETHODIMP
nsDNSTXTResult::Rewind()
{
    mIter = nsnull;
    mIterGenCnt = -1;
    mDone = PR_FALSE;
    return NS_OK;
}

//-----------------------------------------------------------------------------

class nsDNSTXTAsyncRequest : public nsResolveHostCallback
                           , public nsICancelable
{
public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSICANCELABLE

    nsDNSTXTAsyncRequest(nsHostResolver    *res,
                         const nsACString  &host,
                         nsIDNSTXTListener *listener,
                         PRUint16           flags,
                         PRUint16           af)
        : mResolver(res)
        , mHost(host)
        , mListener(listener)
        , mFlags(flags)
        , mAF(af) {}
    ~nsDNSTXTAsyncRequest() {}

    void OnLookupComplete(nsHostResolver *, nsHostRecord *, nsresult);

    nsRefPtr<nsHostResolver>    mResolver;
    nsCString                   mHost; // hostname we're resolving
    nsCOMPtr<nsIDNSTXTListener> mListener;
    PRUint16                    mFlags;
    PRUint16                    mAF;
};

void
nsDNSTXTAsyncRequest::OnLookupComplete(nsHostResolver *resolver,
                                       nsHostRecord   *hostRecord,
                                       nsresult        status)
{
    // need to have an owning ref when we issue the callback to enable
    // the caller to be able to addref/release multiple times without
    // destroying the record prematurely.
    nsCOMPtr<nsIDNSTXTResult> rec;
    if (NS_SUCCEEDED(status)) {
        NS_ASSERTION(hostRecord, "no host record");
        rec = new nsDNSTXTResult(hostRecord);
        if (!rec)
            status = NS_ERROR_OUT_OF_MEMORY;
    }

    mListener->OnLookupComplete(this, rec, status);
    mListener = nsnull;

    // release the reference to ourselves that was added before we were
    // handed off to the host resolver.
    NS_RELEASE_THIS();
}

NS_IMPL_THREADSAFE_ISUPPORTS1(nsDNSTXTAsyncRequest, nsICancelable)

NS_IMETHODIMP
nsDNSTXTAsyncRequest::Cancel(nsresult reason)
{
    NS_ENSURE_ARG(NS_FAILED(reason));
    mResolver->DetachCallback(mHost.get(), mFlags, mAF, this, reason);
    return NS_OK;
}

//-----------------------------------------------------------------------------

class nsDNSTXTSyncRequest : public nsResolveHostCallback
{
public:
    nsDNSTXTSyncRequest(PRMonitor *mon)
        : mDone(PR_FALSE)
        , mStatus(NS_OK)
        , mMonitor(mon) {}
    virtual ~nsDNSTXTSyncRequest() {}

    void OnLookupComplete(nsHostResolver *, nsHostRecord *, nsresult);

    PRBool                 mDone;
    nsresult               mStatus;
    nsRefPtr<nsHostRecord> mHostRecord;

private:
    PRMonitor             *mMonitor;
};

void
nsDNSTXTSyncRequest::OnLookupComplete(nsHostResolver *resolver,
                                      nsHostRecord   *hostRecord,
                                      nsresult        status)
{
    // store results, and wake up nsDNSTXTService::Resolve to process
    // results.
    PR_EnterMonitor(mMonitor);
    mDone = PR_TRUE;
    mStatus = status;
    mHostRecord = hostRecord;
    PR_Notify(mMonitor);
    PR_ExitMonitor(mMonitor);
}

//-----------------------------------------------------------------------------

nsDNSTXTService::nsDNSTXTService()
    : mLock(nsnull)
{
}

nsDNSTXTService::~nsDNSTXTService()
{
    if (mLock)
        PR_DestroyLock(mLock);
}

NS_IMPL_THREADSAFE_ISUPPORTS2(nsDNSTXTService, nsIDNSTXTService, nsIObserver)

NS_IMETHODIMP
nsDNSTXTService::Init()
{
    NS_ENSURE_TRUE(!mResolver, NS_ERROR_ALREADY_INITIALIZED);

    PRBool firstTime = (mLock == nsnull);

    // prefs
    PRUint32 maxCacheEntries  = 400;
    PRUint32 maxCacheLifetime = 3; // minutes
    
    // read prefs
    nsCOMPtr<nsIPrefBranch2> prefs = do_GetService(NS_PREFSERVICE_CONTRACTID);
    if (prefs) {
        PRInt32 val;
        if (NS_SUCCEEDED(prefs->GetIntPref(kPrefDnsTxtCacheEntries, &val)))
            maxCacheEntries = (PRUint32) val;
        if (NS_SUCCEEDED(prefs->GetIntPref(kPrefDnsTxtCacheExpiration, &val)))
            maxCacheLifetime = val / 60; // convert from seconds to minutes
    }

    if (firstTime) {
        mLock = PR_NewLock();
        if (!mLock)
            return NS_ERROR_OUT_OF_MEMORY;

        // register as prefs observer
        if (prefs) {
            prefs->AddObserver(kPrefDnsTxtCacheEntries, this, PR_FALSE);
            prefs->AddObserver(kPrefDnsTxtCacheExpiration, this, PR_FALSE);
        }
    }

    nsRefPtr<nsHostResolver> res;
    nsresult rv = nsHostResolver::Create(maxCacheEntries,
                                         maxCacheLifetime,
                                         getter_AddRefs(res));
    if (NS_SUCCEEDED(rv)) {
        // now, set all of our member variables while holding the lock
        nsAutoLock lock(mLock);
        mResolver = res;
    }
    
    return rv;
}

NS_IMETHODIMP
nsDNSTXTService::Shutdown()
{
    nsRefPtr<nsHostResolver> res;
    {
        nsAutoLock lock(mLock);
        res = mResolver;
        mResolver = nsnull;
    }
    if (res)
        res->Shutdown();
    return NS_OK;
}

NS_IMETHODIMP
nsDNSTXTService::AsyncResolve(const nsACString  &hostname,
                              PRUint32           flags,
                              nsIDNSTXTListener *listener,
                              nsIEventTarget    *target,
                              nsICancelable    **result)
{
    // grab reference to global host resolver.  beware simultaneous
    // shutdown!!
    nsRefPtr<nsHostResolver> res;
    {
        nsAutoLock lock(mLock);

        if (flags & RESOLVE_SPECULATE)
            return NS_ERROR_DNS_LOOKUP_QUEUE_FULL;

        res = mResolver;
    }
    NS_ENSURE_TRUE(res, NS_ERROR_OFFLINE);

    const nsACString *hostPtr = &hostname;

    nsresult rv;

    PRUint16 af = PR_AF_UNSPEC;

    nsDNSTXTAsyncRequest *req =
            new nsDNSTXTAsyncRequest(res, *hostPtr, listener, flags, af);
    if (!req)
        return NS_ERROR_OUT_OF_MEMORY;
    NS_ADDREF(*result = req);

    // addref for resolver; will be released when OnLookupComplete is called.
    NS_ADDREF(req);
    rv = res->ResolveHost(req->mHost.get(), flags, af, req);
    if (NS_FAILED(rv)) {
        NS_RELEASE(req);
        NS_RELEASE(*result);
    }
    return rv;
}

NS_IMETHODIMP
nsDNSTXTService::Resolve(const nsACString &hostname,
                         PRUint32          flags,
                         nsIDNSTXTResult **result)
{
    // grab reference to global host resolver.  beware simultaneous
    // shutdown!!
    nsRefPtr<nsHostResolver> res;
    {
        nsAutoLock lock(mLock);
        res = mResolver;
    }
    NS_ENSURE_TRUE(res, NS_ERROR_OFFLINE);

    const nsACString *hostPtr = &hostname;

    nsresult rv;

    //
    // sync resolve: since the host resolver only works asynchronously, we need
    // to use a mutex and a condvar to wait for the result.  however, since the
    // result may be in the resolvers cache, we might get called back recursively
    // on the same thread.  so, our mutex needs to be re-entrant.  in other words,
    // we need to use a monitor! ;-)
    //
    
    PRMonitor *mon = PR_NewMonitor();
    if (!mon)
        return NS_ERROR_OUT_OF_MEMORY;

    PR_EnterMonitor(mon);
    nsDNSTXTSyncRequest syncReq(mon);

    PRUint16 af = PR_AF_UNSPEC;

    rv = res->ResolveHost(PromiseFlatCString(*hostPtr).get(), flags, af, &syncReq);
    if (NS_SUCCEEDED(rv)) {
        // wait for result
        while (!syncReq.mDone)
            PR_Wait(mon, PR_INTERVAL_NO_TIMEOUT);

        if (NS_FAILED(syncReq.mStatus))
            rv = syncReq.mStatus;
        else {
            NS_ASSERTION(syncReq.mHostRecord, "no host record");
            nsDNSTXTResult *rec = new nsDNSTXTResult(syncReq.mHostRecord);
            if (!rec)
                rv = NS_ERROR_OUT_OF_MEMORY;
            else
                NS_ADDREF(*result = rec);
        }
    }

    PR_ExitMonitor(mon);
    PR_DestroyMonitor(mon);
    return rv;
}

NS_IMETHODIMP
nsDNSTXTService::Observe(nsISupports *subject, const char *topic, const PRUnichar *data)
{
    // we are only getting called if a preference has changed. 
    NS_ASSERTION(strcmp(topic, NS_PREFBRANCH_PREFCHANGE_TOPIC_ID) == 0,
        "unexpected observe call");

    //
    // Shutdown and this function are both only called on the UI thread, so we don't
    // have to worry about mResolver being cleared out from under us.
    //
    // NOTE Shutting down and reinitializing the service like this is obviously
    // suboptimal if Observe gets called several times in a row, but we don't
    // expect that to be the case.
    //

    if (mResolver) {
        Shutdown();
        Init();
    }
    return NS_OK;
}
