/**
 * Shared request queue for Magic Eden API calls
 * Prevents rate limiting by spacing out requests
 */

// Global queue shared across all API calls
let requestQueue = [];
let activeRequests = 0;
const MAX_CONCURRENT = 1; // Only 1 request at a time
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests

function processQueue() {
  if (activeRequests >= MAX_CONCURRENT || requestQueue.length === 0) {
    return;
  }

  const nextRequest = requestQueue.shift();
  if (nextRequest) {
    activeRequests++;
    nextRequest().finally(() => {
      activeRequests--;
      setTimeout(processQueue, DELAY_BETWEEN_REQUESTS);
    });
  }
}

/**
 * Add a request to the queue
 * @param {Function} requestFn - Async function that makes the API call
 */
export function enqueueRequest(requestFn) {
  requestQueue.push(requestFn);
  processQueue();
}
