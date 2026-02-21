const CONFIG = {
  API_BASE: 'http://localhost:8080',
  WS_URL: 'http://localhost:8080/ws',
  // API_BASE: 'https://ashishridehailing-api.onrender.com',
  // WS_URL: 'https://ashishridehailing-api.onrender.com/ws',

  // Fallback location presets (for demo/testing - in production, use geocoding API)
  LOCATION_PRESETS: {
    KORAMANGALA: { lat: 12.9352, lng: 77.6245, label: 'Koramangala' },
    INDIRANAGAR: { lat: 12.9716, lng: 77.6412, label: 'Indiranagar' },
    MG_ROAD: { lat: 12.9758, lng: 77.6045, label: 'MG Road' },
    WHITEFIELD: { lat: 12.9698, lng: 77.7500, label: 'Whitefield' },
    HSR_LAYOUT: { lat: 12.9116, lng: 77.6474, label: 'HSR Layout' },
    JAYANAGAR: { lat: 12.9299, lng: 77.5838, label: 'Jayanagar' },
  },
};

export default CONFIG;
