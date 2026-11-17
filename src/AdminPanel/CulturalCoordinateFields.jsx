import React from 'react';
import { COORDINATE_FIELDS } from '../utils/culturalCoordinates.js';
import './CulturalCoordinateFields.css';

export default function CulturalCoordinateFields({ coordinates, editing = false }) {
  const prefix = `cultural-coordinates-${editing ? 'edit' : 'create'}`;
  return (
    <div className="cultural-coordinate-fields">
      {COORDINATE_FIELDS.map(({ name, label, placeholder }) => {
        const id = `${prefix}-${name}`;
        const error = coordinates.errors[name];
        return (
          <div className="cultural-coordinate-field" key={name}>
            <label className={editing ? 'edit-form-label' : 'form-label'} htmlFor={id}>{label}</label>
            <input
              id={id} type="text" inputMode="decimal" dir="ltr"
              className={editing ? 'edit-form-input' : 'form-input-cultural'}
              placeholder={placeholder} value={coordinates.draft[name]}
              onChange={event => coordinates.changeCoordinate(name, event.target.value)}
              aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
              autoComplete="off" spellCheck={false}
            />
            {error && <span id={`${id}-error`} className="cultural-coordinate-error" role="alert">{error}</span>}
          </div>
        );
      })}
    </div>
  );
}
