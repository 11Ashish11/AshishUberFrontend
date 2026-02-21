import CONFIG from './config';

const BASE = CONFIG.API_BASE;

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      throw new Error(`${res.status}: ${errorBody || res.statusText}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out (30s). The server may be cold-starting — try again in a moment.');
    }
    throw err;
  }
}

// ── Ride APIs ──────────────────────────────────────────────

export function createRide({ riderId, pickupLat, pickupLng, destinationLat, destinationLng, vehicleTier, paymentMethod, idempotencyKey }) {
  return request(`${BASE}/v1/rides`, {
    method: 'POST',
    body: JSON.stringify({
      riderId,
      pickupLat: parseFloat(pickupLat),
      pickupLng: parseFloat(pickupLng),
      destinationLat: parseFloat(destinationLat),
      destinationLng: parseFloat(destinationLng),
      vehicleTier,
      paymentMethod,
      idempotencyKey,
    }),
  });
}

export function getRide(rideId) {
  return request(`${BASE}/v1/rides/${rideId}`);
}

export function cancelRide(rideId) {
  return request(`${BASE}/v1/rides/${rideId}/cancel`, { method: 'POST' });
}

// ── Driver APIs ────────────────────────────────────────────

export function goOnline(driverId) {
  return request(`${BASE}/v1/drivers/${driverId}/online`, { method: 'POST' });
}

export function goOffline(driverId) {
  return request(`${BASE}/v1/drivers/${driverId}/offline`, { method: 'POST' });
}

export function sendLocation(driverId, latitude, longitude) {
  return request(`${BASE}/v1/drivers/${driverId}/location`, {
    method: 'POST',
    body: JSON.stringify({ latitude: parseFloat(latitude), longitude: parseFloat(longitude) }),
  });
}

export function acceptRide(driverId, rideId) {
  return request(`${BASE}/v1/drivers/${driverId}/accept?rideId=${rideId}`, { method: 'POST' });
}

export function declineRide(driverId, rideId) {
  return request(`${BASE}/v1/drivers/${driverId}/decline?rideId=${rideId}`, { method: 'POST' });
}

export function getPendingOffers(driverId) {
  return request(`${BASE}/v1/drivers/${driverId}/pending-offers`);
}

// ── Trip APIs ──────────────────────────────────────────────

export function getTrip(tripId) {
  return request(`${BASE}/v1/trips/${tripId}`);
}

export function endTrip(tripId, endLat, endLng) {
  return request(`${BASE}/v1/trips/${tripId}/end`, {
    method: 'POST',
    body: JSON.stringify({ endLat: parseFloat(endLat), endLng: parseFloat(endLng) }),
  });
}

// ── Payment APIs ───────────────────────────────────────────

export function triggerPayment({ tripId, paymentMethod, idempotencyKey }) {
  return request(`${BASE}/v1/payments`, {
    method: 'POST',
    body: JSON.stringify({ tripId, paymentMethod, idempotencyKey }),
  });
}

// ── User/Config APIs ────────────────────────────────────────

export function getRiders() {
  return request(`${BASE}/v1/riders`);
}

export function getDrivers() {
  return request(`${BASE}/v1/drivers`);
}

export function getVehicleTiers() {
  return request(`${BASE}/v1/config/vehicle-tiers`);
}

export function getPaymentMethods() {
  return request(`${BASE}/v1/config/payment-methods`);
}
