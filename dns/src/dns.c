/*
 * jabberd - Jabber Open Source Server & Mozilla 3e Plugin
 * Copyright (c) 2002 Jeremie Miller, Thomas Muldowney,
 *                    Ryan Eatmon, Robert Norris
 * Copyright (c) 2011 Zonio s.r.o.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA02111-1307USA
 */

#include "dns.h"

#include "prtypes.h"
#include "prmem.h"
#include "prnetdb.h"
#include "plstr.h"

#if defined(HAVE_RES_NINIT)
#define BIND_8_COMPAT
#include <netinet/in.h>
#include <arpa/nameser.h>
#include <arpa/inet.h>
#include <resolv.h>
#include <sys/socket.h>
#else
#include <winsock2.h>
#include <windns.h>
#endif

/* unix implementation */
#if defined(HAVE_RES_NINIT)

typedef union {
    HEADER          hdr;
    unsigned char   buf[PR_NETDB_BUF_SIZE];
} dns_packet_t;

/** the actual resolver function */
dns_txt_t dns_txt_resolve(const char *zone) {
    char host[256];
    dns_packet_t packet;
    PRUint32 len;
    PRUint16 qdcount, ancount, an, n;
    unsigned char *eom, *scan;
    dns_txt_t *reply, first;
    PRUint16 type, cls;
    PRUint32 ttl;

    if(zone == NULL || *zone == '\0')
        return NULL;

    /* do the actual query */
    if((len = res_query(zone, C_IN, T_TXT, packet.buf, PR_NETDB_BUF_SIZE)) == -1 || len < sizeof(HEADER))
        return NULL;

    /* we got a valid result, containing two types of records - packet
     * and answer .. we have to skip over the packet records */

    /* no. of packets, no. of answers */
    qdcount = PR_ntohs(packet.hdr.qdcount);
    ancount = PR_ntohs(packet.hdr.ancount);

    /* end of the returned message */
    eom = (unsigned char *) (packet.buf + len);

    /* our current location */
    scan = (unsigned char *) (packet.buf + sizeof(HEADER));

    /* skip over the packet records */
    while(qdcount > 0 && scan < eom) {
        qdcount--;
        if((len = dn_expand(packet.buf, eom, scan, host, 256)) < 0)
            return NULL;
        scan = (unsigned char *) (scan + len + QFIXEDSZ);
    }

    /* create an array to store the replies in */
    reply = (dns_txt_t *) PR_Calloc(1, sizeof(dns_txt_t) * ancount);

    an = 0;
    /* loop through the answer buffer and extract TXT records */
    while(ancount > 0 && scan < eom ) {
        ancount--;
        len = dn_expand(packet.buf, eom, scan, host, 256);
        if(len < 0) {
            for(n = 0; n < an; n++)
                PR_Free(reply[n]);
            PR_Free(reply);
            return NULL;
        }

        scan += len;

        /* extract the various parts of the record */
        GETSHORT(type, scan);
        GETSHORT(cls, scan);
        GETLONG(ttl, scan);
        GETSHORT(len, scan);

        /* skip records we're not interested in */
        if(type != T_TXT) {
            scan = (unsigned char *) (scan + len);
            continue;
        }

        /* create a new reply structure to save it in */
        reply[an] = (dns_txt_t) PR_Malloc(sizeof(struct dns_txt_st));

        reply[an]->type = type;
        reply[an]->cls = cls;
        reply[an]->ttl = ttl;

        reply[an]->next = NULL;

        /* copy answer data into the allocated area */
        reply[an]->rr = (char *) PR_Malloc(len + 1);
        PL_strncpyz(reply[an]->rr, scan, len + 1);
        scan += len;

        /* on to the next one */
        an++;
    }

    /* build a linked list out of the array elements */
    for(n = 0; n < an - 1; n++)
        reply[n]->next = reply[n + 1];

    first = reply[0];

    PR_Free(reply);

    return first;
}

/* windows implementation */
#else

dns_txt_t dns_txt_resolve(const char *zone) {
    PRUint16 num, i;
    PDNS_RECORD rr, scan;
    dns_txt_t *reply, first;

    if(zone == NULL || *zone == '\0')
        return NULL;

    if(DnsQuery(zone, DNS_TYPE_TEXT, DNS_QUERY_STANDARD, NULL, &rr, NULL) != 0)
        return NULL;

    num = 0;
    for(scan = rr; scan != NULL; scan = scan->pNext)
        num++;

    reply = (dns_txt_t *) PR_Calloc(1, sizeof(dns_txt_t) * num);

    num = 0;
    for(scan = rr; scan != NULL; scan = scan->pNext) {
        if(scan->wType != DNS_TYPE_TEXT || PL_strcasecmp(scan->pName, zone) != 0)
            continue;

        reply[num] = (dns_txt_t) PR_Malloc(sizeof(struct dns_txt_st));

        reply[num]->type = scan->wType;
        reply[num]->cls = 0;
        reply[num]->ttl = scan->dwTtl;

        reply[num]->next = NULL;

        /* copy answer data into the allocated area */
        reply[num]->rr = (char *) PR_Malloc(scan->wDataLength + 1);
        PL_strncpyz(reply[num]->rr, scan->Data.TXT->pStringArray[0], scan->wDataLength + 1);

        num++;
    }

    for(i = 0; i < num - 1; i++)
        reply[i]->next = reply[i + 1];

    first = reply[0];

    PR_Free(reply);

    return first;
}

#endif

/** free an srv structure */
void dns_txt_free(dns_txt_t dns) {
    dns_txt_t next;

    while(dns != NULL) {
        next = dns->next;
        PR_Free(dns->rr);
        PR_Free(dns);
        dns = next;
    }
}
