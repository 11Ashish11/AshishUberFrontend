# GoComet Ride-Hailing Frontend

A modern React-based frontend application for a ride-hailing platform, featuring real-time WebSocket updates, dual-mode interface (Rider/Driver), and seamless integration with backend APIs.

## 🚀 Features

### Rider Features
- **Request Rides**: Select pickup and destination locations, choose vehicle tier, and payment method
- **Real-time Updates**: Live ride status updates via WebSocket
- **Ride Management**: Cancel rides, track ride progress, and view ride history
- **Payment Processing**: Complete payment after ride completion
- **Event Logging**: Real-time event log for debugging and monitoring

### Driver Features
- **Online/Offline Toggle**: Control driver availability status
- **Location Updates**: Simulate location updates for driver tracking
- **Ride Offers**: Receive and respond to incoming ride requests
- **Trip Management**: Accept rides, start trips, and end trips with fare calculation
- **Real-time Notifications**: WebSocket-based notifications for ride assignments

### Technical Features
- **Real-time Communication**: WebSocket integration using STOMP protocol
- **Dynamic Data Loading**: Fetches riders, drivers, and configuration from backend APIs
- **Graceful Fallbacks**: Automatic fallback to demo data if backend endpoints are unavailable
- **Responsive Design**: Modern dark-themed UI optimized for mobile and desktop
- **Error Handling**: Comprehensive error handling with user-friendly messages

## 🛠️ Tech Stack

- **React** 18.2.0 - UI framework
- **React DOM** 18.2.0 - React rendering
- **React Scripts** 5.0.1 - Build tooling
- **@stomp/stompjs** 7.0.0 - STOMP WebSocket client
- **sockjs-client** 1.6.1 - WebSocket fallback transport

## 📁 Project Structure

```
files/
├── public/
│   └── index.html          # HTML template
├── src/
│   ├── index.js            # Application entry point
│   ├── App.jsx             # Main application component
│   ├── config.js           # Configuration and constants
│   ├── api.js              # API client functions
│   ├── useWebSocket.js     # WebSocket hook
│   ├── RiderView.jsx       # Rider interface component
│   ├── DriverView.jsx      # Driver interface component
│   ├── StatusBadge.jsx     # Status badge component
│   └── EventLog.jsx        # Event log component
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

## 🚦 Getting Started

### Prerequisites

- **Node.js** (v14 or higher recommended)
- **npm** or **yarn**

### Installation

1. **Clone the repository** (if applicable) or navigate to the project directory:
   ```bash
   cd files
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure API endpoints** (if needed):
   Edit `src/config.js` to update API base URL and WebSocket URL:
   ```javascript
   const CONFIG = {
     API_BASE: 'https://your-api-url.com',
     WS_URL: 'https://your-api-url.com/ws',
     // ...
   };
   ```

### Running the Application

**Development mode**:
```bash
npm start
```

The application will start on `http://localhost:3000` (or the next available port).

**Production build**:
```bash
npm run build
```

This creates an optimized production build in the `build/` directory.

## 🔌 API Endpoints

The frontend expects the following backend API endpoints:

### User Endpoints
- `GET /v1/riders` - Fetch list of riders
- `GET /v1/drivers` - Fetch list of drivers

### Configuration Endpoints
- `GET /v1/config/vehicle-tiers` - Fetch available vehicle tiers
- `GET /v1/config/payment-methods` - Fetch available payment methods

### Ride Endpoints
- `POST /v1/rides` - Create a new ride request
- `GET /v1/rides/:rideId` - Get ride details
- `POST /v1/rides/:rideId/cancel` - Cancel a ride

### Driver Endpoints
- `POST /v1/drivers/:driverId/online` - Set driver online
- `POST /v1/drivers/:driverId/offline` - Set driver offline
- `POST /v1/drivers/:driverId/location` - Update driver location
- `POST /v1/drivers/:driverId/accept?rideId=:rideId` - Accept a ride
- `POST /v1/drivers/:driverId/decline?rideId=:rideId` - Decline a ride

### Trip Endpoints
- `GET /v1/trips/:tripId` - Get trip details
- `POST /v1/trips/:tripId/end` - End a trip

### Payment Endpoints
- `POST /v1/payments` - Process payment

### WebSocket
- `WS /ws` - WebSocket endpoint for real-time updates
  - Subscribe to `/topic/rider/:riderId` for rider updates
  - Subscribe to `/topic/driver/:driverId` for driver updates

## 🔧 Configuration

### Environment Variables

Currently, configuration is managed in `src/config.js`. For production, consider using environment variables:

```javascript
const CONFIG = {
  API_BASE: process.env.REACT_APP_API_BASE || 'https://ashishridehailing-api.onrender.com',
  WS_URL: process.env.REACT_APP_WS_URL || 'https://ashishridehailing-api.onrender.com/ws',
  // ...
};
```

### Fallback Data

The application includes fallback data for development and testing when backend endpoints are unavailable:
- **Riders**: Demo rider accounts
- **Drivers**: Demo driver accounts with vehicle types
- **Vehicle Tiers**: SEDAN, AUTO, SUV
- **Payment Methods**: UPI, CASH, CARD
- **Location Presets**: Bangalore locations (Koramangala, Indiranagar, etc.)

## 🎨 UI Components

### StatusBadge
Displays status badges with color-coded styling for different states:
- Ride statuses: REQUESTED, MATCHING, MATCHED, IN_PROGRESS, COMPLETED, CANCELLED
- Payment statuses: PENDING, SUCCESS, FAILED
- Driver statuses: ONLINE, OFFLINE, ON_TRIP

### EventLog
Real-time event logging component that displays:
- WebSocket messages
- API responses
- User actions
- Error messages

## 🔄 State Management

The application uses React hooks for state management:
- `useState` for component-level state
- `useEffect` for side effects and data fetching
- `useCallback` for memoized callbacks
- `useRef` for mutable references (polling intervals, WebSocket clients)

## 🐛 Error Handling

- **API Errors**: Graceful fallback to demo data
- **WebSocket Errors**: Connection status indicators and error messages
- **Network Errors**: User-friendly error messages with retry options
- **Timeout Handling**: 30-second timeout for API requests with helpful messages

## 📝 Development Notes

### WebSocket Connection
- Automatic reconnection with 5-second delay
- Heartbeat mechanism (10-second intervals)
- Subscription queue for pending subscriptions
- Connection status indicator in UI

### Polling Strategy
- Fallback polling every 3 seconds for active rides
- Automatic cleanup on component unmount
- Prevents memory leaks with proper interval management

### Code Quality
- Clean component structure
- Separation of concerns (API, WebSocket, UI)
- Consistent styling with inline styles
- Error boundaries ready for implementation

## 🚧 Future Improvements

- [ ] Add TypeScript for type safety
- [ ] Implement error boundaries
- [ ] Add unit and integration tests
- [ ] Extract shared styles to a theme file
- [ ] Add PropTypes or TypeScript types
- [ ] Implement proper authentication
- [ ] Add geocoding API integration for location search
- [ ] Improve accessibility (ARIA labels, keyboard navigation)
- [ ] Add loading skeletons
- [ ] Implement state management library (Redux/Zustand) if needed

## 📄 License

This project is part of the GoComet SDE-2 Assignment.

## 👤 Author

Ashish Bhoya

---
