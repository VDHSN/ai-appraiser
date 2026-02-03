# 1stDibs Adapter: GraphQL API Documentation

This document describes the reverse-engineered GraphQL API used by the 1stDibs adapter.

## Overview

1stDibs uses a client-rendered architecture where search results are fetched via GraphQL. The JSON-LD data present on product detail pages is **not available on search result pages**, making HTML scraping ineffective for search.

## GraphQL Endpoint

```
POST https://www.1stdibs.com/soa/graphql/
```

### Required Headers

```http
Content-Type: application/json
Accept: application/json
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

No authentication is required for search queries.

## Search Query

### Query

```graphql
query ItemSearch($uriRef: String!, $first: Int!) {
  viewer {
    itemSearch(uriRef: $uriRef, first: $first) {
      totalResults
      edges {
        node {
          item {
            serviceId
            title
            pdpURL
            firstPhotoWebPath(size: small)
            pricing {
              amount {
                amount
                currency
              }
            }
            seller {
              id
            }
          }
        }
      }
    }
  }
}
```

### Variables

| Variable | Type    | Description                                             |
| -------- | ------- | ------------------------------------------------------- |
| `uriRef` | String! | URL path with query parameters, e.g., `/search/?q=lamp` |
| `first`  | Int!    | Number of results to return (page size)                 |

### URL Parameters for uriRef

| SearchQuery Field    | URL Parameter     |
| -------------------- | ----------------- |
| `keywords`           | `q`               |
| `priceRange.min`     | `price_min`       |
| `priceRange.max`     | `price_max`       |
| `sort: "price-asc"`  | `sort=price-asc`  |
| `sort: "price-desc"` | `sort=price-desc` |
| `category`           | `category`        |
| `location`           | `seller_location` |

### Response Mapping

| GraphQL Field                    | SearchResult Field         | Notes                                         |
| -------------------------------- | -------------------------- | --------------------------------------------- |
| `serviceId`                      | `itemId`                   | Strip `f_` prefix (e.g., `f_12345` → `12345`) |
| `title`                          | `title`                    |                                               |
| `pdpURL`                         | `url`                      | Prepend `https://www.1stdibs.com`             |
| `firstPhotoWebPath(size: small)` | `imageUrl`, `thumbnailUrl` |                                               |
| `pricing.amount.amount`          | `currentPrice`             |                                               |
| `pricing.amount.currency`        | `currency`                 |                                               |
| `seller.id`                      | (internal use)             | Base64-encoded seller info                    |

### Example Request

```bash
curl -sS https://www.1stdibs.com/soa/graphql/ \
  -H "content-type: application/json" \
  -H "user-agent: Mozilla/5.0" \
  -d '{
    "query": "query { viewer { itemSearch(uriRef: \"/search/?q=lamp\", first: 3) { totalResults edges { node { item { serviceId title pdpURL firstPhotoWebPath(size: small) pricing { amount { amount currency } } } } } } } }"
  }'
```

### Example Response

```json
{
  "data": {
    "viewer": {
      "itemSearch": {
        "totalResults": 15234,
        "edges": [
          {
            "node": {
              "item": {
                "serviceId": "f_12345",
                "title": "Art Deco Bronze Table Lamp",
                "pdpURL": "/furniture/lighting/table-lamps/art-deco-lamp/id-f_12345/",
                "firstPhotoWebPath": "https://a.1stdibscdn.com/lamp-small.jpg",
                "pricing": {
                  "amount": {
                    "amount": 4500,
                    "currency": "USD"
                  }
                },
                "seller": {
                  "id": "U2VsbGVyOjEyMzQ1"
                }
              }
            }
          }
        ]
      }
    }
  }
}
```

## Item Detail Query

For fetching individual item details, use the `node` query with a base64-encoded global ID.

### Query

```graphql
query ItemDetail($id: ID!) {
  node(id: $id) {
    ... on Item {
      serviceId
      title
      pdpURL
      description
      firstPhotoWebPath(size: large)
      photos {
        webPath(size: large)
      }
      pricing {
        amount {
          amount
          currency
        }
      }
      seller {
        id
        displayName
      }
      categories {
        name
      }
    }
  }
}
```

### Variables

| Variable | Type | Description                                                  |
| -------- | ---- | ------------------------------------------------------------ |
| `id`     | ID!  | Base64-encoded global ID, format: `btoa("Item:f_${itemId}")` |

### Example

For item ID `12345`:

- Global ID: `btoa("Item:f_12345")` = `SXRlbTpmXzEyMzQ1`

## Rate Limiting

The API does not appear to have strict rate limiting for reasonable usage, but the adapter implements conservative rate limiting (2 requests/second) to avoid issues.

## Notes

- The GraphQL API is undocumented and may change without notice
- Price filtering via URL params may have server-side variations
- Item detail pages still contain JSON-LD data, which can serve as a fallback
- The `seller.id` field is base64-encoded and contains seller information
