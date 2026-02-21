# GoComet Ride-Hailing Frontend

A React-based frontend for demonstrating the GoComet ride-hailing API. The app provides a step-by-step wizard that walks through the complete ride flow — from driver onboarding to payment — with live curl commands and API responses.

<img width="1020" height="665" alt="Screenshot 2026-02-21 at 6 32 40 PM" src="https://github.com/user-attachments/assets/c4aa54c8-27f9-4c8f-bc8b-df431b48ebb1" />




## Features

- **Step-by-step API demo wizard** — 6 sequential steps covering the full ride lifecycle
- **Curl command display** — shows the exact curl command for each API call
- **Auto-advance** — automatically moves to the next step after a successful response
- **Smart driver matching** — automatically detects which driver was matched by checking pending offers across all drivers
- **Fallback data** — gracefully falls back to demo riders/drivers if the backend is unavailable
- **Continuous location updates** — simulates GPS by sending driver location every 1 second
- **Dark-themed UI** — modern dark interface with gradient accents

## Ride Flow (6 Steps)

| Step | Action | API Endpoint |
|------|--------|-------------|
| 1 | Select driver & go online | `POST /v1/drivers/{driverId}/online` |
| 2 | Send driver location (continuous, every 1s) | `POST /v1/drivers/{driverId}/location` |
| 3 | Request ride from rider (Koramangala → Indiranagar) | `POST /v1/rides` |
| 4 | Driver accepts ride (auto-detects matched driver) | `POST /v1/drivers/{driverId}/accept?rideId={rideId}` |
| 5 | End trip | `POST /v1/trips/{tripId}/end` |
| 6 | Process payment | `POST /v1/payments` |

## Tech Stack

- **React** 18.2.0
- **React Scripts** 5.0.1
- **@stomp/stompjs** 7.0.0
- **sockjs-client** 1.6.1

## Project Structure

```
files/
├── public/
│   └── index.html            # HTML template (loads DM Sans & JetBrains Mono fonts)
├── src/
│   ├── index.js              # Entry point, global styles, renders App
│   ├── App.jsx               # Step-by-step wizard (main UI)
│   ├── config.js             # API base URL and location presets
│   ├── api.js                # All REST API client functions
│   ├── useWebSocket.js       # WebSocket hook (unused by wizard, available for future use)
│   ├── RiderView.jsx         # Rider interface (unused by wizard, available for future use)
│   ├── DriverView.jsx        # Driver interface (unused by wizard, available for future use)
│   ├── StatusBadge.jsx       # Status badge component (unused by wizard, available for future use)
│   └── EventLog.jsx          # Event log component (unused by wizard, available for future use)
├── package.json
└── README.md
```

> **Note:** `RiderView`, `DriverView`, `useWebSocket`, `StatusBadge`, and `EventLog` are from a previous dual-mode Rider/Driver architecture. They are not currently used by `App.jsx` but remain in the codebase for potential future use.

## Getting Started

### Prerequisites

- **Node.js** (v14 or higher)
- **npm**
- Backend API running (defaults to `http://localhost:8080`)

### Installation

```bash
cd files
npm install
```

### Configuration

Edit `src/config.js` to point to your backend:

```javascript
const CONFIG = {
  API_BASE: 'http://localhost:8080',
  WS_URL: 'http://localhost:8080/ws',
  // For deployed backend, uncomment:
  // API_BASE: 'https://ashishridehailing-api.onrender.com',
  // WS_URL: 'https://ashishridehailing-api.onrender.com/ws',
};
```

### Running

```bash
npm start
```

Opens on `http://localhost:3000` (or the next available port).

### Production Build

```bash
npm run build
```

## API Endpoints

The frontend uses the following backend endpoints:

### User & Config

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/riders` | Fetch list of riders |
| `GET` | `/v1/drivers` | Fetch list of drivers |

### Driver

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/drivers/{driverId}/online` | Set driver online |
| `POST` | `/v1/drivers/{driverId}/offline` | Set driver offline |
| `POST` | `/v1/drivers/{driverId}/location` | Update driver location (`{ latitude, longitude }`) |
| `POST` | `/v1/drivers/{driverId}/accept?rideId={rideId}` | Accept a ride |
| `POST` | `/v1/drivers/{driverId}/decline?rideId={rideId}` | Decline a ride |
| `GET` | `/v1/drivers/{driverId}/pending-offers` | Get pending ride offers for a driver |

### Ride

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/rides` | Create a ride request (see payload below) |
| `GET` | `/v1/rides/{rideId}` | Get ride details |
| `POST` | `/v1/rides/{rideId}/cancel` | Cancel a ride |

**Create ride payload:**
```json
{
  "riderId": "uuid",
  "pickupLat": 12.9352,
  "pickupLng": 77.6245,
  "destinationLat": 12.9716,
  "destinationLng": 77.6412,
  "vehicleTier": "SEDAN",
  "paymentMethod": "UPI",
  "idempotencyKey": "ride-<timestamp>"
}
```

### Trip

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/trips/{tripId}` | Get trip details |
| `POST` | `/v1/trips/{tripId}/end` | End a trip (`{ endLat, endLng }`) |

### Payment

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/payments` | Process payment (`{ tripId, paymentMethod, idempotencyKey }`) |

## Fallback Data

When the backend is unavailable, the app falls back to hardcoded demo data:

- **Riders:** Ashish, Priya
- **Drivers:** Raju (SEDAN), Kumar (AUTO), Suresh (SUV), Venkat (SEDAN), Anil (AUTO)
- **Location presets:** Koramangala, Indiranagar, MG Road, Whitefield, HSR Layout, Jayanagar (all Bangalore)

## How the Wizard Works

1. On mount, the app fetches riders and drivers from the backend (falls back to demo data on failure).
2. Each step shows the API endpoint, a ready-to-copy curl command, and an "Execute API Call" button.
3. After a successful API call, the response JSON is displayed and the wizard auto-advances to the next step after 2 seconds.
4. **Step 4 (Accept Ride)** iterates through all drivers to find which one received the pending offer, since the matching system assigns the nearest driver — not necessarily the one selected in Step 1.
5. After Step 6, a completion screen appears with a "Start Over" button.
6. The "Clean Slate" button resets the wizard and stops background location updates.

## Error Handling

- **30-second request timeout** with a helpful message about cold-starting servers
- **Fallback to demo data** when backend user/config endpoints are unavailable
- **Error display** with the raw status code and response body
- **409 Conflict handling** — if a rider already has an active ride, the error is shown so the user can clean up via the backend

## License

This project is part of the GoComet SDE-2 Assignment.

## Author

Ashish Bhoya
