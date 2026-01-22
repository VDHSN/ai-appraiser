# LiveAuctioneers Adapter - API Reference

**No authentication required** for any of these endpoints.

## Search Endpoint

```
GET https://search-party-prod.liveauctioneers.com/search/v4/web
```

### Query Parameters

| Param          | Description                         |
| -------------- | ----------------------------------- |
| `parameters`   | URL-encoded JSON object (see below) |
| `useATGSearch` | `true`                              |

### Parameters JSON Schema

```json
{
  "searchTerm": "hats",
  "page": 1,
  "pageSize": 24,
  "categories": [],
  "options": {
    "status": ["upcoming", "live", "online"],
    "auctionHouse": [{ "exclude": [], "include": [] }]
  },
  "ranges": {},
  "buyNow": false,
  "sort": "-relevance",
  "distance": {},
  "citySlug": "",
  "region": "",
  "saleDate": {},
  "publishDate": {},
  "analyticsTags": ["web"],
  "seoSearch": false
}
```

### Parameter Details

| Field                  | Type    | Description                                        |
| ---------------------- | ------- | -------------------------------------------------- |
| `searchTerm`           | string  | Search keywords                                    |
| `page`                 | number  | Page number (1-indexed)                            |
| `pageSize`             | number  | Results per page (default 24)                      |
| `categories`           | array   | Category IDs to filter                             |
| `options.status`       | array   | Auction status filter (see below)                  |
| `options.auctionHouse` | array   | Include/exclude specific auction houses            |
| `ranges`               | object  | Price range filters                                |
| `buyNow`               | boolean | Filter to buy-now only items                       |
| `sort`                 | string  | Sort order (e.g., `-relevance`, `price`, `-price`) |
| `distance`             | object  | Geographic distance filter                         |
| `citySlug`             | string  | City slug for location filter                      |
| `region`               | string  | Region filter                                      |
| `saleDate`             | object  | Filter by auction date                             |
| `publishDate`          | object  | Filter by listing date                             |

### Status Filter Values

The `options.status` array controls which items are returned:

**Active Auctions:**

```json
"status": ["upcoming", "live", "online"]
```

**Price Results Database (300M+ sold items):**

```json
"status": ["sold", "passed", "done"]
```

| Status     | Description                                  |
| ---------- | -------------------------------------------- |
| `upcoming` | Auctions not yet started                     |
| `live`     | Currently running live auctions              |
| `online`   | Timed/online auctions in progress            |
| `sold`     | Items that sold                              |
| `passed`   | Items that did not meet reserve/did not sell |
| `done`     | Completed auction items                      |

The Price Results Database is critical for:

- `getPriceHistory` tool - find comparable sold items
- `assessValue` tool - AI-powered valuation based on historical sales

---

## Item Details Endpoints

Three endpoints provide different aspects of item data:

### 1. Content/Items - Main item info + similar items

```
GET https://www.liveauctioneers.com/content/items
```

| Param            | Value            | Description                          |
| ---------------- | ---------------- | ------------------------------------ |
| `lotIds`         | `224005190`      | Item/lot ID                          |
| `identifier`     | `item-page-main` | Page context identifier              |
| `similarItems`   | `true`           | Include similar item recommendations |
| `liveStateFetch` | `false`          | Fetch live auction state             |
| `c`              | `20170802`       | Cache buster/version                 |

### 2. Item Facets - Category/filter metadata

```
GET https://item-api-prod.liveauctioneers.com/spa/small/item-facets
```

| Param | Value       | Description          |
| ----- | ----------- | -------------------- |
| `ids` | `224005190` | Item ID(s)           |
| `c`   | `20170802`  | Cache buster/version |

### 3. Item Detail - Full item details

```
GET https://item-api-prod.liveauctioneers.com/spa/small/item-detail
```

| Param     | Value       | Description          |
| --------- | ----------- | -------------------- |
| `itemIds` | `224005190` | Item ID(s)           |
| `c`       | `20170802`  | Cache buster/version |

---

## Required Headers

All endpoints require these headers for successful requests:

```
Origin: https://www.liveauctioneers.com
Referer: https://www.liveauctioneers.com/
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36
Accept: */*
```

---

## Adapter Implementation Notes

### Endpoint Mapping to Tools

| Tool              | Primary Endpoint         | Status Filter                | Secondary Endpoints                        |
| ----------------- | ------------------------ | ---------------------------- | ------------------------------------------ |
| `searchItems`     | `/search/v4/web`         | `upcoming`, `live`, `online` | -                                          |
| `getItemDetails`  | `/spa/small/item-detail` | -                            | `/content/items`, `/spa/small/item-facets` |
| `getPriceHistory` | `/search/v4/web`         | `sold`, `passed`, `done`     | -                                          |
| `assessValue`     | `/search/v4/web`         | `sold`, `passed`, `done`     | Uses AI to analyze comps                   |

### Response Normalization

The adapter should:

1. Parse search results into `SearchResult[]` format
2. Combine data from all 3 item endpoints into `UnifiedItem`
3. Handle the URL-encoded JSON parameters for search
4. Add required headers to all requests

### Rate Limiting

- Implement client-side rate limiting (suggest: 2 req/sec)
- Cache responses where appropriate (item details rarely change)
- Use the `c` parameter as provided (appears to be a version/cache key)
