#!/usr/bin/env bash
# End-to-end demo of the REST flow through the API gateway (requires `docker compose up`).
set -euo pipefail
API=${API:-http://localhost:8080/api/v1}
j() { python3 -c "import sys,json; print(json.load(sys.stdin)$1)"; }

echo "1) Register reader";   TOKEN=$(curl -s -X POST $API/auth/register -H 'Content-Type: application/json' -d '{"email":"reader@example.com","password":"password123","name":"Reader"}' | j "['token']")
echo "2) List topics";       curl -s $API/topics | head -c 300; echo
echo "3) Follow topic 3";    curl -s -X POST $API/topics/3/follow -H "Authorization: Bearer $TOKEN"
echo "4) Personalised feed"; curl -s $API/feed -H "Authorization: Bearer $TOKEN"; echo
echo "5) Trending (public)"; curl -s "$API/trending?window=1h&limit=5"; echo
