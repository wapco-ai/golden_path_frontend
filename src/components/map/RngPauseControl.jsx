import React from 'react';
import { BiPause, BiPlay } from 'react-icons/bi';
import '../../styles/RngQrCorrection.css';

export default function RngPauseControl({ paused, busy, text, onClick }) {
  const label = paused ? text.resume : text.pause;
  return (
    <div className="rng-map-actions rng-pause-actions">
      <button type="button" className="rng-qr-button rng-pause-button"
        aria-label={label} title={label} aria-busy={busy} disabled={busy} onClick={onClick}>
        {paused ? <BiPlay size={25} aria-hidden="true" /> : <BiPause size={25} aria-hidden="true" />}
      </button>
      {paused && <span className="rng-pause-status" role="status">{busy ? text.checking : text.paused}</span>}
    </div>
  );
}
