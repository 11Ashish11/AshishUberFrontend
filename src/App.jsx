import React, { useState, useEffect } from 'react';
import CONFIG from './config';
import { useWebSocket } from './useWebSocket';
import { getRiders, getDrivers } from './api';
import RiderView from './RiderView';
import DriverView from './DriverView';

export default function App() {
  const [mode, setMode] = useState('rider'); // 'rider' or 'driver'
  const [riders, setRiders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedRider, setSelectedRider] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ws = useWebSocket();

  // Fetch riders and drivers from backend on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Fallback data if backend endpoints don't exist
        const fallbackRiders = [
          { id: '5db4ae0c-5dca-4b64-8486-7d2aaf2f8e44', name: 'Ashish' },
          { id: '4659495a-2552-4f66-9443-a9a45bfb8a42', name: 'Priya' },
        ];
        
        const fallbackDrivers = [
          { id: 'f7e431bb-7c1f-4465-8a58-47cb6683d08b', name: 'Raju', vehicle: 'SEDAN' },
          { id: 'c0d97346-a728-4fed-9bc9-0bae7ea62a54', name: 'Kumar', vehicle: 'AUTO' },
          { id: '330a3b03-7cd7-4a7f-bd94-691dc174e92b', name: 'Suresh', vehicle: 'SUV' },
          { id: '7300e3a9-cfd2-4cee-8664-b1318ecdc0d6', name: 'Venkat', vehicle: 'SEDAN' },
          { id: '8d6a3c46-ecec-4b06-9ba5-e1f43b85241e', name: 'Anil', vehicle: 'AUTO' },
        ];
        
        const [ridersData, driversData] = await Promise.all([
          getRiders().catch((err) => {
            console.warn('Backend /v1/riders endpoint not available, using fallback data:', err.message);
            return fallbackRiders;
          }),
          getDrivers().catch((err) => {
            console.warn('Backend /v1/drivers endpoint not available, using fallback data:', err.message);
            return fallbackDrivers;
          }),
        ]);
        
        // Use data from API if available, otherwise use fallback
        const finalRiders = (ridersData && ridersData.length > 0) ? ridersData : fallbackRiders;
        const finalDrivers = (driversData && driversData.length > 0) ? driversData : fallbackDrivers;
        
        setRiders(finalRiders);
        setDrivers(finalDrivers);
        
        // Set default selections
        if (finalRiders.length > 0) {
          setSelectedRider(finalRiders[0]);
        }
        if (finalDrivers.length > 0) {
          setSelectedDriver(finalDrivers[0]);
        }
      } catch (err) {
        setError(`Failed to load users: ${err.message}`);
        console.error('Error fetching users:', err);
        // Even on error, set fallback data so app can still work
        const fallbackRiders = [
          { id: '5db4ae0c-5dca-4b64-8486-7d2aaf2f8e44', name: 'Ashish' },
          { id: '4659495a-2552-4f66-9443-a9a45bfb8a42', name: 'Priya' },
        ];
        const fallbackDrivers = [
          { id: 'f7e431bb-7c1f-4465-8a58-47cb6683d08b', name: 'Raju', vehicle: 'SEDAN' },
          { id: 'c0d97346-a728-4fed-9bc9-0bae7ea62a54', name: 'Kumar', vehicle: 'AUTO' },
          { id: '330a3b03-7cd7-4a7f-bd94-691dc174e92b', name: 'Suresh', vehicle: 'SUV' },
          { id: '7300e3a9-cfd2-4cee-8664-b1318ecdc0d6', name: 'Venkat', vehicle: 'SEDAN' },
          { id: '8d6a3c46-ecec-4b06-9ba5-e1f43b85241e', name: 'Anil', vehicle: 'AUTO' },
        ];
        setRiders(fallbackRiders);
        setDrivers(fallbackDrivers);
        if (fallbackRiders.length > 0) setSelectedRider(fallbackRiders[0]);
        if (fallbackDrivers.length > 0) setSelectedDriver(fallbackDrivers[0]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.brand}>
            <div style={styles.logo}>GC</div>
            <div>
              <div style={styles.title}>GoComet Rides</div>
              <div style={styles.subtitle}>Ride-Hailing Dashboard</div>
            </div>
          </div>

          <div style={styles.wsStatus}>
            <span style={{ ...styles.wsDot, background: ws.connected ? '#00e676' : '#ff5252' }} />
            <span style={styles.wsLabel}>{ws.connected ? 'Live' : 'Connecting...'}</span>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {/* Mode Toggle */}
        <div style={styles.toggleContainer}>
          <button
            style={mode === 'rider' ? styles.toggleActive : styles.toggleInactive}
            onClick={() => setMode('rider')}
          >
            Rider
          </button>
          <button
            style={mode === 'driver' ? styles.toggleActive : styles.toggleInactive}
            onClick={() => setMode('driver')}
          >
            Driver
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={styles.loadingBox}>
            Loading users from backend...
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={styles.errorBox}>
            {error}
            <button style={styles.dismissBtn} onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Entity Selector */}
        {!loading && (
          <div style={styles.selectorCard}>
            {mode === 'rider' ? (
              <div style={styles.selectorInner}>
                <label style={styles.selectorLabel}>Select Rider</label>
                {riders.length === 0 ? (
                  <div style={styles.emptyState}>No riders available. Please check backend API.</div>
                ) : (
                  <div style={styles.entityButtons}>
                    {riders.map((r) => (
                      <button
                        key={r.id}
                        style={selectedRider?.id === r.id ? styles.entityActive : styles.entityBtn}
                        onClick={() => setSelectedRider(r)}
                      >
                        {r.name || r.id?.slice(0, 8)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={styles.selectorInner}>
                <label style={styles.selectorLabel}>Select Driver</label>
                {drivers.length === 0 ? (
                  <div style={styles.emptyState}>No drivers available. Please check backend API.</div>
                ) : (
                  <div style={styles.entityButtons}>
                    {drivers.map((d) => (
                      <button
                        key={d.id}
                        style={selectedDriver?.id === d.id ? styles.entityActive : styles.entityBtn}
                        onClick={() => setSelectedDriver(d)}
                      >
                        <span>{d.name || d.id?.slice(0, 8)}</span>
                        {d.vehicle && <span style={styles.vehicleTag}>{d.vehicle}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* WebSocket Error */}
        {ws.error && (
          <div style={styles.wsError}>
            {ws.error}
          </div>
        )}

        {/* Main View */}
        {!loading && (mode === 'rider' ? (
          selectedRider ? (
            <RiderView selectedRider={selectedRider} ws={ws} />
          ) : (
            <div style={styles.emptyState}>Please select a rider</div>
          )
        ) : (
          selectedDriver ? (
            <DriverView selectedDriver={selectedDriver} ws={ws} />
          ) : (
            <div style={styles.emptyState}>Please select a driver</div>
          )
        ))}
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <span>GoComet SDE-2 Assignment</span>
        <span style={styles.footerDot}>·</span>
        <span>API: {CONFIG.API_BASE.replace('https://', '')}</span>
      </footer>
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: '#0a0a14',
    color: '#e0e0f0',
    fontFamily: "'DM Sans', sans-serif",
  },
  header: {
    borderBottom: '1px solid #1a1a2e',
    background: '#0d0d1a',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 800,
    color: '#fff',
    fontFamily: "'JetBrains Mono', monospace",
  },
  title: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#e0e0f0',
  },
  subtitle: {
    fontSize: '11px',
    color: '#6c6c8a',
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.04em',
  },
  wsStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  wsDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  wsLabel: {
    fontSize: '12px',
    color: '#6c6c8a',
    fontFamily: "'JetBrains Mono', monospace",
  },
  main: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
  },
  toggleContainer: {
    display: 'flex',
    background: '#111122',
    borderRadius: '12px',
    padding: '4px',
    marginBottom: '16px',
    border: '1px solid #1a1a2e',
  },
  toggleActive: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  toggleInactive: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    border: 'none',
    background: 'transparent',
    color: '#6c6c8a',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  selectorCard: {
    background: '#111122',
    border: '1px solid #1a1a2e',
    borderRadius: '14px',
    padding: '16px 20px',
    marginBottom: '16px',
  },
  selectorInner: {},
  selectorLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#6c6c8a',
    marginBottom: '10px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  entityButtons: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  entityBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #2a2a4a',
    background: 'transparent',
    color: '#b0b0cc',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.15s',
  },
  entityActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #6C63FF',
    background: '#6C63FF20',
    color: '#e0e0f0',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  vehicleTag: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '4px',
    background: '#1a1a2e',
    color: '#6c6c8a',
    fontFamily: "'JetBrains Mono', monospace",
  },
  wsError: {
    padding: '12px 16px',
    borderRadius: '10px',
    background: '#ff525215',
    border: '1px solid #ff525240',
    color: '#ff5252',
    fontSize: '13px',
    marginBottom: '16px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  footer: {
    maxWidth: '600px',
    margin: '40px auto 20px',
    padding: '0 20px',
    textAlign: 'center',
    fontSize: '11px',
    color: '#4a4a6a',
    fontFamily: "'JetBrains Mono', monospace",
  },
  footerDot: {
    margin: '0 6px',
  },
  loadingBox: {
    padding: '16px',
    borderRadius: '10px',
    background: '#111122',
    border: '1px solid #1a1a2e',
    color: '#6c6c8a',
    fontSize: '13px',
    textAlign: 'center',
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: '16px',
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
    marginBottom: '16px',
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
  emptyState: {
    padding: '12px',
    color: '#6c6c8a',
    fontSize: '13px',
    textAlign: 'center',
    fontFamily: "'JetBrains Mono', monospace",
  },
};
