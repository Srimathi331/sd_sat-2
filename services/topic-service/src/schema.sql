CREATE TABLE IF NOT EXISTS topics (
  id         SERIAL PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,                     -- e.g. "technology", "cricket"
  name       TEXT NOT NULL,
  parent_id  INT REFERENCES topics(id),                -- hierarchy: Sports > Cricket
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many-to-many user <-> topic. Two access paths, so two indexes:
--   "what does user X follow?"       -> PK (user_id, topic_id)
--   "who follows topic Y?" (fan-out) -> idx_follows_topic
CREATE TABLE IF NOT EXISTS topic_follows (
  user_id     UUID NOT NULL,
  topic_id    INT  NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_topic ON topic_follows (topic_id, user_id);

INSERT INTO topics (slug, name) VALUES
  ('world','World'),('politics','Politics'),('technology','Technology'),('business','Business'),
  ('sports','Sports'),('science','Science'),('entertainment','Entertainment'),('health','Health')
ON CONFLICT DO NOTHING;
