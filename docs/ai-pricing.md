# Gemini API Pricing

Pricing per 1 million tokens.

| Model ID                     | Input         | Output          | Notes                 |
| ---------------------------- | ------------- | --------------- | --------------------- |
| **Gemini 3**                 |
| `gemini-3-pro-preview`       | $2.00 / $4.00 | $12.00 / $18.00 | ≤200k / >200k context |
| `gemini-3-pro-image-preview` | $2.00 / $4.00 | $12.00 / $18.00 | Same as pro           |
| `gemini-3-flash-preview`     | $0.50         | $3.00           | Best value for 3.x    |
| **Gemini 2.5**               |
| `gemini-2.5-pro`             | $1.25 / $2.50 | $10.00 / $15.00 | ≤200k / >200k context |
| `gemini-2.5-flash`           | $0.30         | $2.50           | Stable, good balance  |
| `gemini-2.5-flash-lite`      | $0.10         | $0.40           | **Cheapest option**   |
| `gemini-2.5-flash-image`     | $0.30         | $2.50           | Same as flash         |

## Quick Comparison

- `gemini-3-pro-preview` (current default): $2.00 in / $12.00 out
- `gemini-2.5-flash-lite`: 20x cheaper input, 30x cheaper output

## Source

[Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
