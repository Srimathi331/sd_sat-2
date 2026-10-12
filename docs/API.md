# REST API Reference (via API Gateway: `/api/v1`)

All clients talk **only** to the gateway. `Auth` = `Authorization: Bearer <JWT>`. Errors: `{ "error": { "message": "...", "details": [...] } }`.

| Method | Path | Auth | Service | Description |
|---|---|---|---|---|
| POST | `/auth/register` | – | user | Create account, returns JWT |
| POST | `/auth/login` | – | user | Login, returns JWT |
| GET | `/users/me` | ✔ | user | Profile + preferences |
| PUT | `/users/me/preferences` | ✔ | user | Languages, channels (push/email/inApp), breaking-news opt-in, quiet hours |
| POST | `/users/me/devices` | ✔ | user | Register push token |
| GET | `/topics` | – | topic | All topics (cached 1h) |
| POST | `/topics` | admin | topic | Create topic |
| POST / DELETE | `/topics/:id/follow` | ✔ | topic | Follow / unfollow |
| GET | `/users/me/topics` | ✔ | topic | Topic ids I follow |
| POST | `/articles` | editor | article | Publish article (emits Kafka events) |
| PUT | `/articles/:id` | editor | article | Edit article |
| GET | `/articles/:id` | opt. | article | Read article (cached; emits `view`) |
| GET | `/articles?topicId=&before=&limit=` | – | article | Keyset-paginated list |
| POST | `/articles/:id/interactions` | ✔ | article | `{type: view/like/share/bookmark}` → `202 Accepted` |
| GET | `/feed?limit=&offset=` | ✔ | feed | Personalised ranked feed |
| **GET** | **`/trending?topicId=&window=1h&limit=20`** | – | feed | **Trending news (additional API, Round-2 Q6)** |
| GET | `/users/me/bookmarks` , `/users/me/history` | ✔ | feed | Interaction history |
| GET | `/notifications` | ✔ | notification | In-app inbox |
| POST | `/notifications/:id/read` | ✔ | notification | Mark read |
| GET | `/notifications/stream` | ✔ | notification | Server-Sent Events (real-time) |

## Get Trending News

```
GET /api/v1/trending?window=1h&topicId=3&limit=10
```
| Param | Default | Notes |
|---|---|---|
| `window` | `1h` | `1h`, `6h`, `24h` |
| `topicId` | – | omit for global trending |
| `limit` | 20 | max 50 |

```json
{
  "window": "1h", "topicId": 3, "generatedAt": "2026-10-12T10:00:00.000Z",
  "items": [
    { "rank": 1, "trendingScore": 842.5, "id": "65f...", "title": "…", "summary": "…",
      "topics": [3], "isBreaking": true, "publishedAt": "2026-10-12T09:41:00.000Z" }
  ]
}
```
Trending score = weighted interactions (view 1, like 3, bookmark 4, share 5) over a sliding window of 5-minute Redis buckets; newer buckets weigh more. Response is cached 15 s in Redis and `Cache-Control: public, max-age=15` for the CDN.
