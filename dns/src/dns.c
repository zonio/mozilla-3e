/*
 * jabberd - Jabber Open Source Server
 * Copyright (c) 2002 Jeremie Miller, Thomas Muldowney,
 *                    Ryan Eatmon, Robert Norris
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

#include "resolver.h"
#include "dns.h"

/* Mac OS X 10.3 needs this - I don't think it will break anything else */
#define BIND_8_COMPAT (1)

#include <string.h>
#include <stdlib.h>

#ifdef HAVE_NETINET_IN_H
# include <netinet/in.h>
#endif
#ifdef HAVE_ARPA_NAMESER_H
# include <arpa/nameser.h>
#endif
#ifdef HAVE_ARPA_INET_H
# include <arpa/inet.h>
#endif
#ifdef HAVE_RESOLV_H
# include <resolv.h>
#endif
#ifdef HAVE_SYS_SOCKET_H
# include <sys/socket.h>
#endif
#ifdef HAVE_WINSOCK2_H
# include <winsock2.h>
#endif
#ifdef HAVE_WINDNS_H
# include <windns.h>
#endif


/* unix implementation */
#if defined(HAVE_RES_QUERY) || defined(HAVE___RES_QUERY)
 
/* older systems might not have these */
#ifndef T_TXT
# define T_TXT 16
#endif

/* the largest packet we'll send and receive */
#if PACKETSZ > 1024
# define MAX_PACKET PACKETSZ
#else
# define MAX_PACKET (1024)
#endif

typedef union {
    HEADER          hdr;
    unsigned char   buf[MAX_PACKET];
} dns_packet_t;

/** the actual resolver function */
dns_txt_t dns_txt_resolve(const char *zone) {
    char host[256];
    dns_packet_t packet;
    int len, qdcount, ancount, an, n;
    unsigned char *eom, *scan;
    dns_txt_t *reply, first;
    unsigned int type, class, ttl;

    if(zone == NULL || *zone == '\0')
        return NULL;

    /* do the actual query */
    if((len = res_query(zone, C_IN, T_TXT, packet.buf, MAX_PACKET)) == -1 || len < sizeof(HEADER))
        return NULL;

    /* we got a valid result, containing two types of records - packet
     * and answer .. we have to skip over the packet records */

    /* no. of packets, no. of answers */
    qdcount = ntohs(packet.hdr.qdcount);
    ancount = ntohs(packet.hdr.ancount);

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
    reply = (dns_txt_t *) calloc(1, sizeof(dns_txt_t) * ancount);

    an = 0;
    /* loop through the answer buffer and extract SRV records */
    while(ancount > 0 && scan < eom ) {
        ancount--;
        len = dn_expand(packet.buf, eom, scan, host, 256);
        if(len < 0) {
            for(n = 0; n < an; n++)
                free(reply[n]);
            free(reply);
            return NULL;
        }

        scan += len;

        /* extract the various parts of the record */
        GETSHORT(type, scan);
        GETSHORT(class, scan);
        GETLONG(ttl, scan);
        GETSHORT(len, scan);

        /* skip records we're not interested in */
        if(type != T_TXT) {
            scan = (unsigned char *) (scan + len);
            continue;
        }

        /* create a new reply structure to save it in */
        reply[an] = (dns_txt_t) malloc(sizeof(struct dns_txt_st));

        reply[an]->type = type;
        reply[an]->class = class;
        reply[an]->ttl = ttl;

        reply[an]->next = NULL;

        //TODO process TXT record

        /* fell short, we're done */
        if(reply[an]->rr == NULL)
        {
            free(reply[an]);
            reply[an] = NULL;
            break;
        }

        /* on to the next one */
        an++;
    }

    /* build a linked list out of the array elements */
    for(n = 0; n < an - 1; n++)
        reply[n]->next = reply[n + 1];

    first = reply[0];

    free(reply);

    return first;
}

#endif /* HAVE_RES_QUERY */

/* windows implementation */
#ifdef HAVE_DNSQUERY

/* mingw doesn't have these, and msdn doesn't document them. hmph. */
#ifndef DNS_TYPE_TXT
# define DNS_TYPE_TXT (16)
#endif

dns_txt_t dns_txt_resolve(const char *zone) {
    int num, i;
    PDNS_RECORD rr, scan;
    dns_txt_t *reply, first;

    if(zone == NULL || *zone == '\0')
        return NULL;

    if(DnsQuery(zone, DNS_TYPE_TXT, DNS_QUERY_STANDARD, NULL, &rr, NULL) != 0)
        return NULL;

    num = 0;
    for(scan = rr; scan != NULL; scan = scan->pNext)
        num++;

    reply = (dns_txt_t *) calloc(1, sizeof(dns_txt_t) * num);

    num = 0;
    for(scan = rr; scan != NULL; scan = scan->pNext) {
        if(scan->wType != DNS_TYPE_TXT || stricmp(scan->pName, zone) != 0)
            continue;

        reply[num] = (dns_txt_t) malloc(sizeof(struct dns_txt_st));

        reply[num]->type = scan->wType;
        reply[num]->class = 0;
        reply[num]->ttl = scan->dwTtl;

        reply[num]->next = NULL;

        //TODO process TXT record

        num++;
    }

    for(i = 0; i < num - 1; i++)
        reply[i]->next = reply[i + 1];

    first = reply[0];

    free(reply);

    return first;
}
#endif /* HAVE_DNSQUERY */

/** free an srv structure */
void dns_txt_free(dns_txt_t dns) {
    dns_txt_t next;

    while(dns != NULL) {
        next = dns->next;
        free(dns->rr);
        free(dns);
        dns = next;
    }
}
