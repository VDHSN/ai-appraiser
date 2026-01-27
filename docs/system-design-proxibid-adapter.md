# ProxiBid Adapter - API Reference

**No authentication required** for any of these endpoints.

## Search Endpoint

```
GET https://www.proxibid.com/asp/SearchBuilder.asp
```

### Query Parameters

| Param      | Description                             |
| ---------- | --------------------------------------- |
| `searchid` | Always `0`                              |
| `type`     | `lot` for lot search                    |
| `search`   | URL-encoded search keywords             |
| `sort`     | Sort order (see below)                  |
| `length`   | Results per page (default 25)           |
| `start`    | Offset for pagination (0-indexed)       |
| `refine`   | Filter refinements                      |
| `asvt`     | `closed` for sold items (price history) |

### Sort Options

| Value        | Description            |
| ------------ | ---------------------- |
| `relevance`  | Default relevance sort |
| `price`      | Price ascending        |
| `price-desc` | Price descending       |
| `end`        | Ending soonest         |

### Example URLs

**Active Auctions:**

```
https://www.proxibid.com/asp/SearchBuilder.asp?searchid=0&type=lot&search=watch&sort=relevance&length=25&start=0
```

**Sold Items (Price History):**

```
https://www.proxibid.com/asp/SearchBuilder.asp?searchid=0&type=lot&search=watch&sort=relevance&length=25&start=0&asvt=closed
```

---

## Search Response Schema

```json
{
  "item": [
    {
      "meta": {
        "LotID": 98735520,
        "LotTitle": "Example Lot Title",
        "CurrentHighBid": 100,
        "Price": 150,
        "CurrencyAbbrv": "USD",
        "LotImage": "11621-1.jpg",
        "LotEndDateTime": "1/28/2026 15:54:00",
        "AuctionHouseID": 12345,
        "CompanyName": "Heritage Auctions",
        "CityState": "Dallas, TX",
        "AuctionType": "Timed",
        "LotNumber": "A-123",
        "AuctionID": 291366
      }
    }
  ],
  "totalResultCount": 1234,
  "pageLength": 25,
  "pageNumber": 1
}
```

### Response Field Mapping

| API Field        | Maps To           | Notes                              |
| ---------------- | ----------------- | ---------------------------------- |
| `LotID`          | `itemId`          | Primary identifier                 |
| `LotTitle`       | `title`           |                                    |
| `CurrentHighBid` | `currentPrice`    | Active auctions                    |
| `Price`          | `soldPrice`       | Closed auctions (when asvt=closed) |
| `CurrencyAbbrv`  | `currency`        | Default "USD"                      |
| `LotImage`       | image filename    | e.g., "11621-1.jpg"                |
| `LotEndDateTime` | `endTime`         | US format: "1/28/2026 15:54:00"    |
| `AuctionHouseID` | `seller.id`       |                                    |
| `CompanyName`    | `auctionHouse`    |                                    |
| `CityState`      | `seller.location` |                                    |
| `AuctionType`    | `auctionType`     | "Timed" or "Live"                  |
| `LotNumber`      | `lotNumber`       |                                    |
| `AuctionID`      | -                 | Used for image URL construction    |

---

## Image URLs

### URL Pattern

```
https://images.proxibid.com/AuctionImages/{AuctionHouseID}/{AuctionID}/{Size}/{LotImage}
```

### Available Sizes

| Size       | Description         |
| ---------- | ------------------- |
| `FullSize` | Original resolution |
| `FILarge`  | Large thumbnail     |
| `FIMedium` | Medium thumbnail    |
| `Thumb`    | Small thumbnail     |

### Image Proxy

All images are proxied through `/api/image` to handle CORS:

```
/api/image?url=https://images.proxibid.com/AuctionImages/12345/291366/FullSize/11621-1.jpg
```

---

## Item Detail Page (HTML Scraping)

ProxiBid has no JSON API for lot details. The `getItem()` method requires HTML scraping.

### Lot Detail URL

```
https://www.proxibid.com/{slug}/lotInformation/{LotID}
```

The `{slug}` is constructed from the auction house name or can be derived from search results.

### HTML Selectors

| Selector                  | Content                      |
| ------------------------- | ---------------------------- |
| `#lotDescription`         | Full description HTML        |
| `img[src*=AuctionImages]` | All lot images               |
| `document.title`          | Contains category breadcrumb |

### Title Format

```
"Lot Title | Category1  Category2 | Online Auctions | Proxibid"
```

Categories are extracted by splitting on `|` and taking the middle segment.

### Scraping Implementation

Uses `jsdom` for in-memory DOM parsing:

```typescript
import { JSDOM } from "jsdom";

function scrapeItemDetail(html: string): ScrapedItemDetail {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  return {
    description:
      doc.querySelector("#lotDescription")?.textContent?.trim() ?? "",
    images: Array.from(doc.querySelectorAll("img[src*=AuctionImages]"))
      .map((img) => img.getAttribute("src"))
      .filter(Boolean) as string[],
    categories: extractCategoriesFromTitle(doc.title),
  };
}
```

---

## Required Headers

All endpoints require browser-like headers:

```
Accept: application/json, text/html
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36
Referer: https://www.proxibid.com/
```

---

## Adapter Implementation Notes

### Endpoint Mapping to Tools

| Tool              | Endpoint             | Status Filter | Notes                        |
| ----------------- | -------------------- | ------------- | ---------------------------- |
| `search`          | `/asp/SearchBuilder` | (none)        | Active auctions              |
| `getItem`         | Search + HTML scrape | -             | Combines JSON + DOM scraping |
| `getPriceHistory` | `/asp/SearchBuilder` | `asvt=closed` | Sold items                   |

### Date Parsing

ProxiBid uses US date format: `M/D/YYYY HH:mm:ss`

```typescript
function parsePBDate(dateStr: string): Date {
  // "1/28/2026 15:54:00" -> Date
  const [datePart, timePart] = dateStr.split(" ");
  const [month, day, year] = datePart.split("/").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}
```

### Rate Limiting

- Implement client-side rate limiting (suggest: 2 req/sec)
- HTML scraping is slower than JSON APIs - consider caching
- Search results return image URLs that can be batched

### Error Handling

- Empty search results return `{ item: [], totalResultCount: 0 }`
- Invalid lot IDs return 404 on detail pages
- Handle network timeouts gracefully (ProxiBid can be slow)
