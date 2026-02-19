import React from 'react';

export default function EventLog({ events }) {
  if (!events.length) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>Live Events</div>
      <div style={styles.list}>
        {events.map((event, i) => (
          <div key={i} style={styles.event}>
            <span style={styles.time}>{event.time}</span>
            <span style={styles.dot}>●</span>
            <span style={styles.message}>{event.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    marginTop: '20px',
    border: '1px solid #1a1a2e',
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#0d0d1a',
  },
  header: {
    padding: '10px 16px',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#6c6c8a',
    borderBottom: '1px solid #1a1a2e',
    fontFamily: "'JetBrains Mono', monospace",
  },
  list: {
    maxHeight: '200px',
    overflowY: 'auto',
    padding: '8px 0',
  },
  event: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 16px',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', monospace",
    color: '#b0b0cc',
  },
  time: {
    color: '#4a4a6a',
    fontSize: '11px',
    flexShrink: 0,
  },
  dot: {
    color: '#00e676',
    fontSize: '6px',
    flexShrink: 0,
  },
  message: {
    flex: 1,
  },
};
