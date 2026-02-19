import { useEffect, useRef, useCallback, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import CONFIG from './config';

export function useWebSocket() {
  const clientRef = useRef(null);
  const subscriptionsRef = useRef({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const pendingSubscriptions = useRef([]);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(CONFIG.WS_URL),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: (msg) => {
        if (msg.includes('ERROR')) console.error('[WS]', msg);
      },
      onConnect: () => {
        console.log('[WS] Connected');
        setConnected(true);
        setError(null);
        // Re-apply any pending subscriptions
        pendingSubscriptions.current.forEach(({ topic, callback }) => {
          const sub = client.subscribe(topic, (message) => {
            try {
              const body = JSON.parse(message.body);
              callback(body);
            } catch {
              callback(message.body);
            }
          });
          subscriptionsRef.current[topic] = sub;
        });
        pendingSubscriptions.current = [];
      },
      onDisconnect: () => {
        console.log('[WS] Disconnected');
        setConnected(false);
      },
      onStompError: (frame) => {
        console.error('[WS] STOMP error:', frame.headers?.message);
        setError(frame.headers?.message || 'WebSocket error');
      },
      onWebSocketError: () => {
        setError('WebSocket connection failed — server may be starting up');
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
    };
  }, []);

  const subscribe = useCallback((topic, callback) => {
    // Unsubscribe from existing same-topic subscription
    if (subscriptionsRef.current[topic]) {
      subscriptionsRef.current[topic].unsubscribe();
      delete subscriptionsRef.current[topic];
    }

    if (clientRef.current?.connected) {
      const sub = clientRef.current.subscribe(topic, (message) => {
        try {
          const body = JSON.parse(message.body);
          callback(body);
        } catch {
          callback(message.body);
        }
      });
      subscriptionsRef.current[topic] = sub;
    } else {
      // Queue for when connection is ready
      pendingSubscriptions.current = pendingSubscriptions.current.filter(p => p.topic !== topic);
      pendingSubscriptions.current.push({ topic, callback });
    }

    return () => {
      if (subscriptionsRef.current[topic]) {
        subscriptionsRef.current[topic].unsubscribe();
        delete subscriptionsRef.current[topic];
      }
    };
  }, []);

  const unsubscribe = useCallback((topic) => {
    if (subscriptionsRef.current[topic]) {
      subscriptionsRef.current[topic].unsubscribe();
      delete subscriptionsRef.current[topic];
    }
    pendingSubscriptions.current = pendingSubscriptions.current.filter(p => p.topic !== topic);
  }, []);

  return { connected, error, subscribe, unsubscribe };
}
