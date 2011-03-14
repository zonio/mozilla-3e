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

#ifndef DNS_H
#define DNS_H

#ifdef HAVE_CONFIG_H
# include "config.h"
#endif

typedef struct dns_txt_st {
    struct dns_txt_st   *next;

    unsigned int        type;
    unsigned int        class;
    unsigned int        ttl;

    char                *rr;
} *dns_txt_t;

extern dns_txt_t   dns_txt_resolve(const char *zone);
extern void        dns_txt_free(dns_txt_t dns);
#endif
