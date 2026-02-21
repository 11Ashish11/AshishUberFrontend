import React, { useState, useEffect, useCallback, useRef } from 'react';
import CONFIG from './config';
import { goOnline, goOffline, sendLocation, acceptRide, declineRide, endTrip, getPendingOffers } from './api';
import StatusBadge from './StatusBadge';
import EventLog from './EventLog';

export default function DriverView({ selectedDriver, ws }) {
  const [isOnline, setIsOnline] = useState(false);
  const [locationPreset, setLocationPreset] = useState('KORAMANGALA');
  const [sendingLocation, setSendingLocation] = useState(false);
  const [incomingRide, setIncomingRide] = useState(null);
  const [currentTrip, setCurrentTrip] = useState(null);
  const [destinationPreset, setDestinationPreset] = useState('INDIRANAGAR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);

  const locationIntervalRef = useRef(null);

  const addEvent = useCallback((message) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setEvents((prev) => [{ time, message }, ...prev].slice(0, 50));
  }, []);

  // Subscribe to WebSocket for this driver
  useEffect(() => {
    if (!selectedDriver || !ws.connected) return;

    const topic = `/topic/driver/${selectedDriver.id}`;
    const unsub = ws.subscribe(topic, (data) => {
      addEvent(`WS: ${JSON.stringify(data).slice(0, 120)}`);

      // Check for ride assignment
      if (data.rideId && (data.type === 'RIDE_OFFER' || data.assignmentStatus === 'OFFERED' || data.status === 'OFFERED')) {
        setIncomingRide(data);
        addEvent(`Ride offer received: ${data.rideId?.slice(0, 8)}...`);
      }

      // Check for trip-related updates
      if (data.tripId || data.type === 'TRIP_STARTED') {
        setCurrentTrip((prev) => ({ ...prev, ...data }));
      }
    });

    return unsub;
  }, [selectedDriver, ws.connected, ws, addEvent]);

  // Fetch pending offers when driver is selected
  useEffect(() => {
    if (!selectedDriver) return;

    async function fetchPendingOffers() {
      try {
        const offers = await getPendingOffers(selectedDriver.id);
        if (offers && offers.length > 0) {
          setIncomingRide(offers[0]);
          addEvent(`Loaded pending offer: ${offers[0].rideId?.slice(0, 8)}...`);
        }
      } catch (err) {
        // Silently fail - driver may not have pending offers
        console.log('No pending offers or error fetching:', err.message);
      }
    }

    fetchPendingOffers();
  }, [selectedDriver, addEvent]);

  // Reset state when driver changes
  useEffect(() => {
    setIsOnline(false);
    setSendingLocation(false);
    setIncomingRide(null);
    setCurrentTrip(null);
    setError(null);
    setEvents([]);
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, [selectedDriver?.id]);

  // Clean up location interval on unmount
  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  const handleGoOnline = async () => {
    setLoading(true);
    setError(null);
    try {
      await goOnline(selectedDriver.id);
      setIsOnline(true);
      addEvent('Driver is now ONLINE');
    } catch (err) {
      setError(err.message);
      addEvent(`Error going online: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoOffline = async () => {
    setLoading(true);
    setError(null);
    try {
      await goOffline(selectedDriver.id);
      setIsOnline(false);
      setSendingLocation(false);
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      addEvent('Driver is now OFFLINE');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendLocationOnce = useCallback(async () => {
    const preset = CONFIG.LOCATION_PRESETS[locationPreset];
    // Add small random offset to simulate movement
    const lat = preset.lat + (Math.random() - 0.5) * 0.002;
    const lng = preset.lng + (Math.random() - 0.5) * 0.002;
    try {
      await sendLocation(selectedDriver.id, lat, lng);
    } catch {
      // Silently fail for periodic sends
    }
  }, [selectedDriver?.id, locationPreset]);

  const toggleLocationSending = () => {
    if (sendingLocation) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
      setSendingLocation(false);
      addEvent('Stopped sending location');
    } else {
      // Send immediately, then every 5s
      sendLocationOnce();
      locationIntervalRef.current = setInterval(sendLocationOnce, 5000);
      setSendingLocation(true);
      addEvent(`Sending location near ${CONFIG.LOCATION_PRESETS[locationPreset].label} every 5s`);
    }
  };

  const handleAccept = async () => {
    if (!incomingRide) return;
    setLoading(true);
    setError(null);
    try {
      const rideId = incomingRide.rideId || incomingRide.id;
      const result = await acceptRide(selectedDriver.id, rideId);
      addEvent(`Accepted ride ${rideId?.slice(0, 8)}...`);
      setCurrentTrip({ rideId, ...result });
      setIncomingRide(null);
    } catch (err) {
      setError(err.message);
      addEvent(`Accept error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!incomingRide) return;
    setLoading(true);
    try {
      const rideId = incomingRide.rideId || incomingRide.id;
      await declineRide(selectedDriver.id, rideId);
      addEvent(`Declined ride ${rideId?.slice(0, 8)}...`);
      setIncomingRide(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEndTrip = async () => {
    if (!currentTrip) return;
    setLoading(true);
    setError(null);
    const dest = CONFIG.LOCATION_PRESETS[destinationPreset];
    try {
      const tripId = currentTrip.tripId || currentTrip.id;
      const result = await endTrip(tripId, dest.lat, dest.lng);
      addEvent(`Trip ended. Fare: ₹${result.fareAmount?.toFixed(2) || result.fare?.toFixed(2) || '?'}`);
      setCurrentTrip({ ...currentTrip, ...result, ended: true });
    } catch (err) {
      setError(err.message);
      addEvent(`End trip error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const presetKeys = Object.keys(CONFIG.LOCATION_PRESETS);

  return (
    <div style={styles.container}>
      {/* Online/Offline Control */}
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={styles.cardTitle}>Driver Status</div>
          <StatusBadge status={isOnline ? 'ONLINE' : 'OFFLINE'} large />
        </div>

        <div style={styles.driverInfo}>
          <span style={styles.driverName}>{selectedDriver?.name}</span>
          <span style={styles.driverVehicle}>{selectedDriver?.vehicle}</span>
        </div>

        <button
          style={isOnline ? styles.dangerBtn : styles.primaryBtn}
          onClick={isOnline ? handleGoOffline : handleGoOnline}
          disabled={loading}
        >
          {loading ? '...' : isOnline ? 'Go Offline' : 'Go Online'}
        </button>
      </div>

      {/* Location Sending */}
      {isOnline && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Location Updates</div>

          <div style={styles.field}>
            <label style={styles.label}>Current Area</label>
            <select
              style={styles.select}
              value={locationPreset}
              onChange={(e) => setLocationPreset(e.target.value)}
              disabled={sendingLocation}
            >
              {presetKeys.map((k) => (
                <option key={k} value={k}>{CONFIG.LOCATION_PRESETS[k].label}</option>
              ))}
            </select>
          </div>

          <button
            style={sendingLocation ? styles.activeBtn : styles.secondaryBtn}
            onClick={toggleLocationSending}
          >
            {sendingLocation ? '⏸ Stop Sending Location' : '▶ Start Sending Location'}
          </button>

          {sendingLocation && (
            <div style={styles.pulse}>
              Sending location near {CONFIG.LOCATION_PRESETS[locationPreset].label}...
            </div>
          )}
        </div>
      )}

      {/* Incoming Ride Offer */}
      {incomingRide && (
        <div style={{ ...styles.card, border: '1px solid #6C63FF' }}>
          <div style={styles.cardTitle}>Incoming Ride Request</div>

          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Ride ID</span>
              <span style={styles.infoValue}>
                {(incomingRide.rideId || incomingRide.id)?.slice(0, 8)}...
              </span>
            </div>
            {incomingRide.vehicleTier && (
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Vehicle</span>
                <span style={styles.infoValue}>{incomingRide.vehicleTier}</span>
              </div>
            )}
            {incomingRide.pickupLat && (
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Pickup</span>
                <span style={styles.infoValue}>{incomingRide.pickupLat?.toFixed(4)}, {incomingRide.pickupLng?.toFixed(4)}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button style={{ ...styles.primaryBtn, flex: 1 }} onClick={handleAccept} disabled={loading}>
              Accept
            </button>
            <button style={{ ...styles.dangerBtn, flex: 1 }} onClick={handleDecline} disabled={loading}>
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Current Trip */}
      {currentTrip && !currentTrip.ended && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Current Trip</div>

          <div style={styles.field}>
            <label style={styles.label}>End Location</label>
            <select style={styles.select} value={destinationPreset} onChange={(e) => setDestinationPreset(e.target.value)}>
              {presetKeys.map((k) => (
                <option key={k} value={k}>{CONFIG.LOCATION_PRESETS[k].label}</option>
              ))}
            </select>
          </div>

          <button style={styles.primaryBtn} onClick={handleEndTrip} disabled={loading}>
            {loading ? 'Ending...' : 'End Trip'}
          </button>
        </div>
      )}

      {/* Trip Completed */}
      {currentTrip?.ended && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={styles.cardTitle}>Trip Completed</div>
            <StatusBadge status="COMPLETED" large />
          </div>

          <div style={styles.infoGrid}>
            {currentTrip.distanceKm && (
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Distance</span>
                <span style={styles.infoValue}>{currentTrip.distanceKm?.toFixed(2)} km</span>
              </div>
            )}
            {(currentTrip.fareAmount || currentTrip.fare) && (
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Fare</span>
                <span style={{ ...styles.infoValue, color: '#00e676', fontSize: '18px' }}>
                  ₹{currentTrip.fareAmount?.toFixed(2) || currentTrip.fare?.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <button
            style={{ ...styles.secondaryBtn, marginTop: '16px' }}
            onClick={() => { setCurrentTrip(null); setIncomingRide(null); }}
          >
            Ready for Next Ride
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
  driverInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  driverName: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#e0e0f0',
    fontFamily: "'DM Sans', sans-serif",
  },
  driverVehicle: {
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: '6px',
    background: '#1a1a2e',
    color: '#6C63FF',
    fontFamily: "'JetBrains Mono', monospace",
  },
  field: {
    marginBottom: '12px',
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
    marginTop: '8px',
  },
  activeBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #4ECDC440',
    background: '#4ECDC415',
    color: '#4ECDC4',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    marginTop: '8px',
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
  pulse: {
    marginTop: '12px',
    padding: '10px 14px',
    borderRadius: '8px',
    background: '#4ECDC410',
    color: '#4ECDC4',
    fontSize: '12px',
    fontFamily: "'JetBrains Mono', monospace",
    textAlign: 'center',
    animation: 'pulse 2s ease-in-out infinite',
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
