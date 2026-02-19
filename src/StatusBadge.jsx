import React from 'react';

const STATUS_STYLES = {
  REQUESTED:   { bg: '#FFF3E0', color: '#E65100', label: 'Requested' },
  MATCHING:    { bg: '#E3F2FD', color: '#1565C0', label: 'Matching' },
  MATCHED:     { bg: '#E8F5E9', color: '#2E7D32', label: 'Matched' },
  ACCEPTED:    { bg: '#E8F5E9', color: '#1B5E20', label: 'Accepted' },
  IN_PROGRESS: { bg: '#EDE7F6', color: '#4527A0', label: 'In Progress' },
  COMPLETED:   { bg: '#E0F2F1', color: '#00695C', label: 'Completed' },
  CANCELLED:   { bg: '#FFEBEE', color: '#C62828', label: 'Cancelled' },
  NO_DRIVERS:  { bg: '#FFEBEE', color: '#C62828', label: 'No Drivers' },
  // Trip statuses
  STARTED:     { bg: '#EDE7F6', color: '#4527A0', label: 'In Progress' },
  FARE_CALCULATED: { bg: '#E0F2F1', color: '#00695C', label: 'Fare Ready' },
  // Payment statuses
  PENDING:     { bg: '#FFF3E0', color: '#E65100', label: 'Pending' },
  SUCCESS:     { bg: '#E8F5E9', color: '#1B5E20', label: 'Paid' },
  FAILED:      { bg: '#FFEBEE', color: '#C62828', label: 'Failed' },
  // Driver statuses
  ONLINE:      { bg: '#E8F5E9', color: '#2E7D32', label: 'Online' },
  OFFLINE:     { bg: '#ECEFF1', color: '#546E7A', label: 'Offline' },
  ON_TRIP:     { bg: '#EDE7F6', color: '#4527A0', label: 'On Trip' },
  // Assignment
  OFFERED:     { bg: '#FFF3E0', color: '#E65100', label: 'Offered' },
  DECLINED:    { bg: '#FFEBEE', color: '#C62828', label: 'Declined' },
};

export default function StatusBadge({ status, large }) {
  const style = STATUS_STYLES[status] || { bg: '#ECEFF1', color: '#546E7A', label: status };

  return (
    <span
      style={{
        display: 'inline-block',
        padding: large ? '6px 16px' : '3px 10px',
        borderRadius: '20px',
        fontSize: large ? '14px' : '12px',
        fontWeight: 600,
        backgroundColor: style.bg,
        color: style.color,
        letterSpacing: '0.02em',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {style.label}
    </span>
  );
}
