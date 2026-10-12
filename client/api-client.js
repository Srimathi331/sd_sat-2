/**
 * Example client used by the web / mobile apps.  It only talks to the API Gateway - never to internal services.
 * Usage:  const api = new NewsApi('https://api.example.com'); await api.login(...); const feed = await api.getFeed();
 */
class NewsApi {
  constructor(baseUrl) { this.baseUrl = baseUrl; this.token = null; }

  async request(method, path, body) {
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.token && { Authorization: `Bearer ${this.token}` }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
    return data;
  }

  async register(email, password, name) { const r = await this.request('POST', '/auth/register', { email, password, name }); this.token = r.token; return r; }
  async login(email, password)           { const r = await this.request('POST', '/auth/login', { email, password }); this.token = r.token; return r; }
  getTopics()                { return this.request('GET', '/topics'); }
  followTopic(id)            { return this.request('POST', `/topics/${id}/follow`); }
  setPreferences(p)          { return this.request('PUT', '/users/me/preferences', p); }
  getFeed(offset = 0)        { return this.request('GET', `/feed?offset=${offset}`); }
  getTrending(topicId, window = '1h') { return this.request('GET', `/trending?window=${window}${topicId ? `&topicId=${topicId}` : ''}`); }
  getArticle(id)             { return this.request('GET', `/articles/${id}`); }
  interact(id, type)         { return this.request('POST', `/articles/${id}/interactions`, { type }); }
  registerDevice(token, platform) { return this.request('POST', '/users/me/devices', { token, platform }); }
  getNotifications()         { return this.request('GET', '/notifications'); }

  /** Real-time in-app notifications (browser). */
  listenNotifications(onMessage) {
    const es = new EventSource(`${this.baseUrl}/api/v1/notifications/stream?access_token=${this.token}`);
    es.addEventListener('notification', (e) => onMessage(JSON.parse(e.data)));
    return () => es.close();
  }
}
if (typeof module !== 'undefined') module.exports = { NewsApi };
