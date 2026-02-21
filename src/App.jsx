import React, { useState, useEffect, useRef } from 'react';
import CONFIG from './config';
import { goOnline, sendLocation, acceptRide, endTrip, triggerPayment, getRiders, getDrivers, createRide, getPendingOffers } from './api';

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [riders, setRiders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedRider, setSelectedRider] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [rideData, setRideData] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const locationIntervalRef = useRef(null);

  // Fetch users on mount
  useEffect(() => {
    async function fetchUsers() {
      try {
        const [ridersData, driversData] = await Promise.all([
          getRiders().catch(() => [
            { id: '3f4e8c82-a590-4328-9066-5233c914b34e', name: 'Ashish' },
            { id: '4659495a-2552-4f66-9443-a9a45bfb8a42', name: 'Priya' },
          ]),
          getDrivers().catch(() => [
            { id: 'bb6524fd-28eb-4887-908a-b4e24b3d4b36', name: 'Raju', vehicleType: 'SEDAN' },
            { id: 'c0d97346-a728-4fed-9bc9-0bae7ea62a54', name: 'Kumar', vehicleType: 'AUTO' },
            { id: 'a08cd1bf-495b-4316-8f8d-31de65eae73c', name: 'Suresh', vehicleType: 'SUV' },
            { id: '13375c88-1211-4a68-9f13-8c723b1ef2cd', name: 'Venkat', vehicleType: 'SEDAN' },
            { id: '4bdf9826-43f2-4504-af63-7d03fdd55d3f', name: 'Anil', vehicleType: 'AUTO' },
          ]),
        ]);
        setRiders(ridersData || []);
        setDrivers(driversData || []);
        if (ridersData?.length > 0) setSelectedRider(ridersData[0]);
        if (driversData?.length > 0) setSelectedDriver(driversData[0]);
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    }
    fetchUsers();
  }, []);

  // Cleanup location interval on unmount
  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  const steps = [
    {
      title: 'Step 1: Select Driver & Go Online',
      description: 'Select a driver and put them online to start accepting rides',
      endpoint: `POST /v1/drivers/{driverId}/online`,
      curlCommand: selectedDriver
        ? `curl -X POST ${CONFIG.API_BASE}/v1/drivers/${selectedDriver.id}/online`
        : 'Select a driver first',
      action: async () => {
        if (!selectedDriver) throw new Error('Please select a driver');
        const result = await goOnline(selectedDriver.id);
        return result;
      },
      showDriverSelect: true,
    },
    {
      title: 'Step 2: Send Driver Location',
      description: 'Start sending driver location every 1 second (simulating real-time GPS updates)',
      endpoint: `POST /v1/drivers/{driverId}/location`,
      curlCommand: selectedDriver
        ? `curl -X POST ${CONFIG.API_BASE}/v1/drivers/${selectedDriver.id}/location \\
  -H "Content-Type: application/json" \\
  -d '{"latitude": 12.9352, "longitude": 77.6245}'`
        : 'Complete previous step first',
      action: async () => {
        if (!selectedDriver) throw new Error('Please select a driver');

        // Send location immediately
        const result = await sendLocation(selectedDriver.id, 12.9352, 77.6245);

        // Start continuous location updates every 1 second (1-2 updates/sec requirement)
        if (locationIntervalRef.current) {
          clearInterval(locationIntervalRef.current);
        }

        locationIntervalRef.current = setInterval(async () => {
          try {
            await sendLocation(selectedDriver.id, 12.9352, 77.6245);
          } catch (err) {
            // Silently fail for background updates
            console.log('Background location update failed:', err.message);
          }
        }, 1000); // 1 update per second

        return {
          ...result,
          note: 'Started sending location updates every 1 second in background',
        };
      },
    },
    {
      title: 'Step 3: Request Ride from Rider',
      description: 'Create a ride request from rider (Koramangala → Indiranagar)',
      endpoint: `POST /v1/rides`,
      curlCommand: selectedRider && selectedDriver
        ? `curl -X POST ${CONFIG.API_BASE}/v1/rides \\
  -H "Content-Type: application/json" \\
  -d '{
    "riderId": "${selectedRider.id}",
    "pickupLat": 12.9352,
    "pickupLng": 77.6245,
    "destinationLat": 12.9716,
    "destinationLng": 77.6412,
    "vehicleTier": "${selectedDriver.vehicleType}",
    "paymentMethod": "UPI",
    "idempotencyKey": "ride-${Date.now()}"
  }'`
        : 'Complete previous step first',
      action: async () => {
        if (!selectedRider || !selectedDriver) throw new Error('Please complete previous steps');
        const result = await createRide({
          riderId: selectedRider.id,
          pickupLat: 12.9352,
          pickupLng: 77.6245,
          destinationLat: 12.9716,
          destinationLng: 77.6412,
          vehicleTier: selectedDriver.vehicleType,
          paymentMethod: 'UPI',
          idempotencyKey: `ride-${Date.now()}`,
        });
        setRideData(result);
        return result;
      },
      showRiderSelect: true,
    },
    {
      title: 'Step 4: Driver Accepts Ride',
      description: 'Driver accepts the incoming ride offer (may be different driver than Step 1!)',
      endpoint: `POST /v1/drivers/{driverId}/accept?rideId={rideId}`,
      curlCommand: selectedDriver && rideData
        ? `curl -X POST "${CONFIG.API_BASE}/v1/drivers/${selectedDriver.id}/accept?rideId=${rideData.id}"`
        : 'Complete previous step first',
      action: async () => {
        // Check ALL drivers for pending offers (since matching picks nearest driver)
        let foundOffer = null;
        let matchedDriver = null;

        for (const driver of drivers) {
          try {
            const offers = await getPendingOffers(driver.id);
            if (offers?.length > 0) {
              foundOffer = offers[0];
              matchedDriver = driver;
              break;
            }
          } catch (err) {
            // Continue checking other drivers
          }
        }

        if (!foundOffer || !matchedDriver) {
          throw new Error('No pending ride offers found for any driver. Please ensure Step 2 (Send Location) was completed before Step 3.');
        }

        // Update selected driver to the matched one
        setSelectedDriver(matchedDriver);

        const result = await acceptRide(matchedDriver.id, foundOffer.rideId);
        setTripData({ tripId: result.tripId, rideId: result.id });

        return {
          ...result,
          note: `Ride was matched to ${matchedDriver.name} (${matchedDriver.vehicleType}) - automatically selected`,
        };
      },
    },
    {
      title: 'Step 5: End Trip',
      description: 'Driver completes the trip (arrives at destination)',
      endpoint: `POST /v1/trips/{tripId}/end`,
      curlCommand: tripData?.tripId
        ? `curl -X POST ${CONFIG.API_BASE}/v1/trips/${tripData.tripId}/end \\
  -H "Content-Type: application/json" \\
  -d '{"endLat": 12.9716, "endLng": 77.6412}'`
        : 'Complete previous step first',
      action: async () => {
        if (!tripData?.tripId) throw new Error('No active trip. Please complete Step 4 first.');
        const result = await endTrip(tripData.tripId, 12.9716, 77.6412);
        setTripData({ ...tripData, ...result });
        return result;
      },
    },
    {
      title: 'Step 6: Process Payment',
      description: 'Rider pays for the completed trip',
      endpoint: `POST /v1/payments`,
      curlCommand: tripData?.tripId
        ? `curl -X POST ${CONFIG.API_BASE}/v1/payments \\
  -H "Content-Type: application/json" \\
  -d '{
    "tripId": "${tripData.tripId}",
    "paymentMethod": "UPI",
    "idempotencyKey": "pay-${Date.now()}"
  }'`
        : 'Complete previous step first',
      action: async () => {
        if (!tripData?.tripId) throw new Error('No completed trip. Please complete Step 5 first.');
        const result = await triggerPayment({
          tripId: tripData.tripId,
          paymentMethod: 'UPI',
          idempotencyKey: `pay-${Date.now()}`,
        });
        setPaymentData(result);
        return result;
      },
    },
  ];

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await steps[currentStep].action();
      setResponse(result);

      // Auto-advance to next step after 2 seconds
      setTimeout(() => {
        if (currentStep < steps.length - 1) {
          setCurrentStep(currentStep + 1);
          setResponse(null);
        }
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    // Stop location updates
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }

    setCurrentStep(0);
    setRideData(null);
    setTripData(null);
    setPaymentData(null);
    setResponse(null);
    setError(null);
  };

  const handleCleanSlate = async () => {
    const confirmed = window.confirm(
      'This will reset the wizard. If you get "409 Rider already has active ride" errors, ' +
      'please ask the admin to clean the database.\n\nContinue?'
    );

    if (confirmed) {
      handleReset();
    }
  };

  const step = steps[currentStep];
  const isComplete = currentStep === steps.length - 1 && response;

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.brand}>
            <div style={styles.logo}>GC</div>
            <div>
              <div style={styles.title}>GoComet Rides - API Demo</div>
              <div style={styles.subtitle}>Step-by-Step Ride Flow</div>
            </div>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {/* Progress Bar */}
        <div style={styles.progressContainer}>
          {steps.map((s, idx) => (
            <div
              key={idx}
              style={{
                ...styles.progressStep,
                ...(idx <= currentStep ? styles.progressStepActive : {}),
              }}
            >
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Current Step */}
        <div style={styles.card}>
          <div style={styles.stepTitle}>{step.title}</div>
          <div style={styles.stepDescription}>{step.description}</div>

          {/* Driver Select */}
          {step.showDriverSelect && (
            <div style={styles.selectSection}>
              <label style={styles.label}>Select Driver:</label>
              <div style={styles.buttonGroup}>
                {drivers.map((d) => (
                  <button
                    key={d.id}
                    style={
                      selectedDriver?.id === d.id
                        ? styles.selectButtonActive
                        : styles.selectButton
                    }
                    onClick={() => setSelectedDriver(d)}
                  >
                    {d.name} <span style={styles.vehicleTag}>{d.vehicleType}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rider Select */}
          {step.showRiderSelect && (
            <div style={styles.selectSection}>
              <label style={styles.label}>Select Rider:</label>
              <div style={styles.buttonGroup}>
                {riders.map((r) => (
                  <button
                    key={r.id}
                    style={
                      selectedRider?.id === r.id
                        ? styles.selectButtonActive
                        : styles.selectButton
                    }
                    onClick={() => setSelectedRider(r)}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* API Endpoint */}
          <div style={styles.section}>
            <label style={styles.label}>API Endpoint:</label>
            <div style={styles.codeBlock}>{step.endpoint}</div>
          </div>

          {/* Curl Command */}
          <div style={styles.section}>
            <label style={styles.label}>Curl Command:</label>
            <pre style={styles.curlBlock}>{step.curlCommand}</pre>
          </div>

          {/* Execute Button */}
          <button
            style={{
              ...styles.executeBtn,
              opacity: loading ? 0.6 : 1,
            }}
            onClick={handleExecute}
            disabled={loading}
          >
            {loading ? 'Executing...' : 'Execute API Call'}
          </button>

          {/* Response */}
          {response && (
            <div style={styles.responseBox}>
              <div style={styles.responseTitle}>✅ Success! Response:</div>
              <pre style={styles.responseContent}>
                {JSON.stringify(response, null, 2)}
              </pre>
              {currentStep < steps.length - 1 && (
                <div style={styles.autoAdvance}>Auto-advancing to next step...</div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={styles.errorBox}>
              <div style={styles.errorTitle}>❌ Error:</div>
              <div style={styles.errorContent}>{error}</div>
            </div>
          )}
        </div>

        {/* Completion Message */}
        {isComplete && (
          <div style={styles.completeCard}>
            <div style={styles.completeTitle}>🎉 Ride Flow Complete!</div>
            <div style={styles.completeMessage}>
              You've successfully completed the entire ride-hailing flow from driver onboarding to payment.
            </div>
            <button style={styles.resetBtn} onClick={handleReset}>
              Start Over
            </button>
          </div>
        )}

        {/* Navigation */}
        {!isComplete && (
          <>
            <div style={styles.navButtons}>
              <button
                style={styles.navBtn}
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
              >
                ← Previous
              </button>
              <button
                style={styles.navBtn}
                onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                disabled={currentStep === steps.length - 1}
              >
                Next →
              </button>
            </div>
            <div style={styles.cleanSlateContainer}>
              <button
                style={styles.cleanSlateBtn}
                onClick={handleCleanSlate}
                disabled={loading}
              >
                🧹 Clean Slate (Cancel Active Rides & Start Over)
              </button>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <span>GoComet SDE-2 Assignment · API: {CONFIG.API_BASE}</span>
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
    maxWidth: '900px',
    margin: '0 auto',
    padding: '16px 20px',
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
  main: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '30px 20px',
  },
  progressContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '30px',
    justifyContent: 'center',
  },
  progressStep: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#1a1a2e',
    color: '#6c6c8a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 700,
    border: '2px solid #1a1a2e',
    fontFamily: "'JetBrains Mono', monospace",
  },
  progressStepActive: {
    background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)',
    color: '#fff',
    border: '2px solid #6C63FF',
  },
  card: {
    background: '#111122',
    border: '1px solid #1a1a2e',
    borderRadius: '14px',
    padding: '30px',
    marginBottom: '20px',
  },
  stepTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#e0e0f0',
    marginBottom: '8px',
  },
  stepDescription: {
    fontSize: '14px',
    color: '#9c9caa',
    marginBottom: '24px',
  },
  selectSection: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#6c6c8a',
    marginBottom: '10px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  selectButton: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #2a2a4a',
    background: 'transparent',
    color: '#b0b0cc',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  selectButtonActive: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #6C63FF',
    background: '#6C63FF20',
    color: '#e0e0f0',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
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
  section: {
    marginBottom: '20px',
  },
  codeBlock: {
    background: '#0d0d1a',
    border: '1px solid #1a1a2e',
    borderRadius: '8px',
    padding: '12px 16px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '13px',
    color: '#4ECDC4',
  },
  curlBlock: {
    background: '#0d0d1a',
    border: '1px solid #1a1a2e',
    borderRadius: '8px',
    padding: '16px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
    color: '#9c9caa',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  },
  executeBtn: {
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
  responseBox: {
    marginTop: '20px',
    background: '#00e67615',
    border: '1px solid #00e67640',
    borderRadius: '10px',
    padding: '16px',
  },
  responseTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#00e676',
    marginBottom: '12px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  responseContent: {
    background: '#0d0d1a',
    border: '1px solid #1a1a2e',
    borderRadius: '8px',
    padding: '12px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
    color: '#9c9caa',
    overflowX: 'auto',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  autoAdvance: {
    marginTop: '12px',
    fontSize: '12px',
    color: '#6c6c8a',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorBox: {
    marginTop: '20px',
    background: '#ff525215',
    border: '1px solid #ff525240',
    borderRadius: '10px',
    padding: '16px',
  },
  errorTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#ff5252',
    marginBottom: '8px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  errorContent: {
    fontSize: '13px',
    color: '#ff8080',
    fontFamily: "'DM Sans', sans-serif",
  },
  completeCard: {
    background: '#00e67615',
    border: '1px solid #00e67640',
    borderRadius: '14px',
    padding: '30px',
    textAlign: 'center',
  },
  completeTitle: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#00e676',
    marginBottom: '12px',
  },
  completeMessage: {
    fontSize: '14px',
    color: '#9c9caa',
    marginBottom: '24px',
    lineHeight: '1.6',
  },
  resetBtn: {
    padding: '12px 24px',
    borderRadius: '10px',
    border: '1px solid #00e67640',
    background: 'transparent',
    color: '#00e676',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  navButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  navBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid #2a2a4a',
    background: 'transparent',
    color: '#b0b0cc',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  cleanSlateContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '16px',
  },
  cleanSlateBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid #ff525240',
    background: '#ff525215',
    color: '#ff8080',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  footer: {
    maxWidth: '900px',
    margin: '40px auto 20px',
    padding: '0 20px',
    textAlign: 'center',
    fontSize: '11px',
    color: '#4a4a6a',
    fontFamily: "'JetBrains Mono', monospace",
  },
};
