import React, { useState, useEffect, useCallback, useRef } from 'react';
import CONFIG from './config';
import { createRide, getRide, cancelRide, getTrip, triggerPayment, getVehicleTiers, getPaymentMethods } from './api';
import StatusBadge from './StatusBadge';
import EventLog from './EventLog';

const presetKeys = Object.keys(CONFIG.LOCATION_PRESETS);

export default function RiderView({ selectedRider, ws }) {
  const [pickup, setPickup] = useState('KORAMANGALA');
  const [destination, setDestination] = useState('INDIRANAGAR');
  const [vehicleTiers, setVehicleTiers] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [vehicleTier, setVehicleTier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const [currentRide, setCurrentRide] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);

  const pollRef = useRef(null);

  const addEvent = useCallback((message) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setEvents((prev) => [{ time, message }, ...prev].slice(0, 50));
  }, []);

  // Fetch vehicle tiers and payment methods from backend
  useEffect(() => {
    async function fetchConfig() {
      const fallbackTiers = ['SEDAN', 'AUTO', 'SUV'];
      const fallbackMethods = ['UPI', 'CASH', 'CARD'];
      
      try {
        const [tiers, methods] = await Promise.all([
          getVehicleTiers().catch((err) => {
            console.warn('Backend /v1/config/vehicle-tiers endpoint not available, using fallback:', err.message);
            return fallbackTiers;
          }),
          getPaymentMethods().catch((err) => {
            console.warn('Backend /v1/config/payment-methods endpoint not available, using fallback:', err.message);
            return fallbackMethods;
          }),
        ]);
        
        const tiersList = Array.isArray(tiers) ? tiers : tiers?.tiers || tiers?.data || fallbackTiers;
        const methodsList = Array.isArray(methods) ? methods : methods?.methods || methods?.data || fallbackMethods;
        
        setVehicleTiers(tiersList);
        setPaymentMethods(methodsList);
        
        // Set defaults
        if (tiersList.length > 0 && !vehicleTier) {
          setVehicleTier(tiersList[0]);
        }
        if (methodsList.length > 0 && !paymentMethod) {
          setPaymentMethod(methodsList[0]);
        }
      } catch (err) {
        console.error('Error fetching config:', err);
        // Use fallbacks
        setVehicleTiers(fallbackTiers);
        setPaymentMethods(fallbackMethods);
        setVehicleTier(fallbackTiers[0]);
        setPaymentMethod(fallbackMethods[0]);
      }
    }
    
    fetchConfig();
  }, []); // Only run once on mount

  // Subscribe to WebSocket for this rider
  useEffect(() => {
    if (!selectedRider || !ws.connected) return;

    const topic = `/topic/rider/${selectedRider.id}`;
    const unsub = ws.subscribe(topic, (data) => {
      addEvent(`WS: ${JSON.stringify(data).slice(0, 100)}`);

      // Update ride state from WS message
      if (data.rideId || data.id) {
        setCurrentRide((prev) => {
          if (!prev) return prev;
          return { ...prev, ...data, id: prev.id };
        });
      }
      if (data.status) {
        addEvent(`Status → ${data.status}`);
      }
    });

    return unsub;
  }, [selectedRider, ws.connected, ws, addEvent]);

  // Poll ride status as fallback (every 3s when there's an active ride)
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    if (currentRide && !['COMPLETED', 'CANCELLED', 'NO_DRIVERS'].includes(currentRide.status)) {
      pollRef.current = setInterval(async () => {
        try {
          const updated = await getRide(currentRide.id);
          setCurrentRide(updated);

          // If trip is in progress or completed, try to fetch trip details
          if (updated.tripId && ['IN_PROGRESS', 'COMPLETED'].includes(updated.status)) {
            try {
              const trip = await getTrip(updated.tripId);
              setTripData(trip);
            } catch { /* trip may not exist yet */ }
          }
        } catch { /* ignore polling errors */ }
      }, 3000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [currentRide?.id, currentRide?.status]);

  // Reset state when rider changes
  useEffect(() => {
    setCurrentRide(null);
    setTripData(null);
    setPaymentData(null);
    setError(null);
    setEvents([]);
  }, [selectedRider?.id]);

  const handleRequestRide = async () => {
    setLoading(true);
    setError(null);
    setPaymentData(null);
    setTripData(null);

    const p = CONFIG.LOCATION_PRESETS[pickup];
    const d = CONFIG.LOCATION_PRESETS[destination];
    const idempotencyKey = `ride-${selectedRider.id}-${Date.now()}`;

    try {
      addEvent(`Requesting ${vehicleTier} ride: ${CONFIG.LOCATION_PRESETS[pickup].label} → ${CONFIG.LOCATION_PRESETS[destination].label}`);
      const ride = await createRide({
        riderId: selectedRider.id,
        pickupLat: p.lat,
        pickupLng: p.lng,
        destinationLat: d.lat,
        destinationLng: d.lng,
        vehicleTier,
        paymentMethod,
        idempotencyKey,
      });
      setCurrentRide(ride);
      addEvent(`Ride created: ${ride.id?.slice(0, 8)}... → ${ride.status}`);
    } catch (err) {
      setError(err.message);
      addEvent(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!currentRide) return;
    setLoading(true);
    try {
      await cancelRide(currentRide.id);
      setCurrentRide((prev) => ({ ...prev, status: 'CANCELLED' }));
      addEvent('Ride cancelled');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!tripData) return;
    setLoading(true);
    setError(null);
    const idempotencyKey = `pay-${tripData.id}-${Date.now()}`;

    try {
      addEvent('Processing payment...');
      const payment = await triggerPayment({
        tripId: tripData.id,
        paymentMethod,
        idempotencyKey,
      });
      setPaymentData(payment);
      addEvent(`Payment: ${payment.status}`);
    } catch (err) {
      setError(err.message);
      addEvent(`Payment error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const canRequestRide = !currentRide || ['COMPLETED', 'CANCELLED', 'NO_DRIVERS'].includes(currentRide?.status);
  const canCancel = currentRide && ['REQUESTED', 'MATCHING', 'MATCHED'].includes(currentRide.status);
  const canPay = tripData && ['COMPLETED', 'FARE_CALCULATED'].includes(tripData.status) && !paymentData;

  return (
    <div style={styles.container}>
      {/* Ride Request Form */}
      {canRequestRide && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Request a Ride</div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Pickup</label>
              <select style={styles.select} value={pickup} onChange={(e) => setPickup(e.target.value)}>
                {presetKeys.map((k) => (
                  <option key={k} value={k}>{CONFIG.LOCATION_PRESETS[k].label}</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Destination</label>
              <select style={styles.select} value={destination} onChange={(e) => setDestination(e.target.value)}>
                {presetKeys.map((k) => (
                  <option key={k} value={k}>{CONFIG.LOCATION_PRESETS[k].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Vehicle</label>
              <select style={styles.select} value={vehicleTier} onChange={(e) => setVehicleTier(e.target.value)} disabled={vehicleTiers.length === 0}>
                {vehicleTiers.length === 0 ? (
                  <option>Loading...</option>
                ) : (
                  vehicleTiers.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))
                )}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Payment</label>
              <select style={styles.select} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={paymentMethods.length === 0}>
                {paymentMethods.length === 0 ? (
                  <option>Loading...</option>
                ) : (
                  paymentMethods.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <button
            style={{ ...styles.primaryBtn, opacity: loading ? 0.6 : 1 }}
            onClick={handleRequestRide}
            disabled={loading || pickup === destination}
          >
            {loading ? 'Requesting...' : 'Request Ride'}
          </button>

          {pickup === destination && (
            <div style={styles.hint}>Pickup and destination must be different</div>
          )}
        </div>
      )}

      {/* Active Ride Status */}
      {currentRide && !canRequestRide && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={styles.cardTitle}>Current Ride</div>
            <StatusBadge status={currentRide.status} large />
          </div>

          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Ride ID</span>
              <span style={styles.infoValue}>{currentRide.id?.slice(0, 8)}...</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Vehicle</span>
              <span style={styles.infoValue}>{currentRide.vehicleTier || vehicleTier}</span>
            </div>
            {currentRide.driverName && (
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Driver</span>
                <span style={styles.infoValue}>{currentRide.driverName}</span>
              </div>
            )}
            {currentRide.driverId && (
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Driver ID</span>
                <span style={styles.infoValue}>{currentRide.driverId?.slice(0, 8)}...</span>
              </div>
            )}
            {currentRide.surgeMultiplier && currentRide.surgeMultiplier > 1 && (
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Surge</span>
                <span style={{ ...styles.infoValue, color: '#ff5252' }}>{currentRide.surgeMultiplier}x</span>
              </div>
            )}
          </div>

          {canCancel && (
            <button style={styles.dangerBtn} onClick={handleCancel} disabled={loading}>
              Cancel Ride
            </button>
          )}
        </div>
      )}

      {/* Completed Ride Summary */}
      {currentRide && ['COMPLETED', 'NO_DRIVERS'].includes(currentRide.status) && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={styles.cardTitle}>Ride {currentRide.status === 'COMPLETED' ? 'Completed' : 'Failed'}</div>
            <StatusBadge status={currentRide.status} large />
          </div>

          {tripData && (
            <div style={styles.infoGrid}>
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Distance</span>
                <span style={styles.infoValue}>{tripData.distanceKm?.toFixed(2)} km</span>
              </div>
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Fare</span>
                <span style={{ ...styles.infoValue, fontSize: '18px', color: '#00e676' }}>
                  ₹{tripData.fareAmount?.toFixed(2) || tripData.fare?.toFixed(2) || '—'}
                </span>
              </div>
              {tripData.surgeMultiplier && tripData.surgeMultiplier > 1 && (
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Surge</span>
                  <span style={styles.infoValue}>{tripData.surgeMultiplier}x</span>
                </div>
              )}
            </div>
          )}

          {canPay && (
            <button style={styles.primaryBtn} onClick={handlePayment} disabled={loading}>
              {loading ? 'Processing...' : `Pay ₹${tripData.fareAmount?.toFixed(2) || tripData.fare?.toFixed(2) || ''}`}
            </button>
          )}

          {paymentData && (
            <div style={{ ...styles.infoGrid, marginTop: '12px' }}>
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Payment</span>
                <StatusBadge status={paymentData.status} />
              </div>
              {paymentData.pspTransactionId && (
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Txn ID</span>
                  <span style={styles.infoValue}>{paymentData.pspTransactionId?.slice(0, 12)}...</span>
                </div>
              )}
            </div>
          )}

          <button
            style={{ ...styles.secondaryBtn, marginTop: '12px' }}
            onClick={() => { setCurrentRide(null); setTripData(null); setPaymentData(null); }}
          >
            New Ride
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={styles.errorBox}>
          {error}
          <button style={styles.dismissBtn} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Event Log */}
      <EventLog events={events} />
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  card: {
    background: '#111122',
    border: '1px solid #1a1a2e',
    borderRadius: '14px',
    padding: '24px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#e0e0f0',
    marginBottom: '16px',
    fontFamily: "'DM Sans', sans-serif",
  },
  row: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
  },
  field: {
    flex: 1,
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#6c6c8a',
    marginBottom: '6px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #2a2a4a',
    background: '#0d0d1a',
    color: '#e0e0f0',
    fontSize: '14px',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    cursor: 'pointer',
  },
  primaryBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    marginTop: '8px',
    transition: 'opacity 0.2s',
  },
  secondaryBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #2a2a4a',
    background: 'transparent',
    color: '#b0b0cc',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  dangerBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #ff525240',
    background: '#ff525215',
    color: '#ff5252',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    marginTop: '8px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginTop: '8px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#6c6c8a',
    fontFamily: "'JetBrains Mono', monospace",
  },
  infoValue: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0f0',
    fontFamily: "'DM Sans', sans-serif",
  },
  hint: {
    fontSize: '12px',
    color: '#ff5252',
    marginTop: '8px',
    textAlign: 'center',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderRadius: '10px',
    background: '#ff525215',
    border: '1px solid #ff525240',
    color: '#ff5252',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#ff5252',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0 4px',
  },
};
