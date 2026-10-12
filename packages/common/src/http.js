const axios = require('axios');
const CircuitBreaker = require('opossum');
const { env } = require('./config');

/**
 * Resilient service-to-service REST client:
 *  - 2s timeout, 2 retries with backoff
 *  - circuit breaker: after 50% failures the circuit opens for 10s and callers fail fast
 *    (so a slow downstream service cannot exhaust our threads during a traffic spike)
 */
function createServiceClient(baseURL) {
  const http = axios.create({
    baseURL,
    timeout: 2000,
    headers: { 'x-internal-token': env('INTERNAL_TOKEN', 'dev-internal') },
  });

  const call = async (config) => {
    let lastErr;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        return (await http.request(config)).data;
      } catch (err) {
        lastErr = err;
        const retriable = !err.response || err.response.status >= 500;
        if (!retriable) throw err;
        await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
      }
    }
    throw lastErr;
  };

  const breaker = new CircuitBreaker(call, { timeout: 5000, errorThresholdPercentage: 50, resetTimeout: 10000, volumeThreshold: 10 });

  return {
    get: (url, params) => breaker.fire({ method: 'GET', url, params }),
    post: (url, data) => breaker.fire({ method: 'POST', url, data }),
    breaker,
  };
}

module.exports = { createServiceClient };
