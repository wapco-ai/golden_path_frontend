import React, { useEffect, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import '../../styles/SaveDestinationModal.css';

const SaveDestinationModal = ({
  isOpen,
  defaultName = '',
  defaultDescription = '',
  isSaving = false,
  onCancel,
  onSave
}) => {
  const intl = useIntl();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(defaultName || '');
    setDescription(defaultDescription || '');
    setNameError('');
  }, [defaultDescription, defaultName, isOpen]);

  const wordCount = useMemo(
    () => description.trim().split(/\s+/).filter(Boolean).length,
    [description]
  );

  if (!isOpen) return null;

  const handleDescriptionChange = (event) => {
    const nextValue = event.target.value;
    const nextWordCount = nextValue.trim().split(/\s+/).filter(Boolean).length;
    if (nextWordCount <= 60) {
      setDescription(nextValue);
    }
  };

  const handleSubmit = () => {
    const resolvedName = name.trim();
    if (!resolvedName) {
      setNameError(intl.formatMessage({ id: 'nameRequiredError' }));
      return;
    }

    onSave?.({
      title: resolvedName,
      description: description.trim()
    });
  };

  return (
    <div className="save-destination-modal" role="presentation">
      <div className="save-destination-modal-content" role="dialog" aria-modal="true">
        <div className="save-destination-modal-header">
          <h3 className="save-destination-modal-title">
            <FormattedMessage id="saveLocationTitle" />
          </h3>
          <p className="save-destination-modal-subtitle">
            <FormattedMessage id="saveLocationSubtitle" />
          </p>
        </div>

        <div className="save-destination-form">
          <div className="save-destination-form-group">
            <label className="save-destination-form-label" htmlFor="saved-destination-name">
              <FormattedMessage id="locationNameLabel" />
            </label>
            <input
              id="saved-destination-name"
              type="text"
              className={`save-destination-form-input ${nameError ? 'error' : ''}`}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError('');
              }}
              placeholder={intl.formatMessage({ id: 'locationNamePlaceholder' })}
              maxLength={50}
              autoFocus
              disabled={isSaving}
            />
            {nameError && <div className="save-destination-form-error">{nameError}</div>}
          </div>

          <div className="save-destination-form-group">
            <label className="save-destination-form-label" htmlFor="saved-destination-description">
              <FormattedMessage id="locationDescriptionLabel" />
              <span className="save-destination-word-count">
                ({wordCount}/60 <FormattedMessage id="words" />)
              </span>
            </label>
            <textarea
              id="saved-destination-description"
              className="save-destination-form-textarea"
              value={description}
              onChange={handleDescriptionChange}
              placeholder={intl.formatMessage({ id: 'locationDescriptionPlaceholder' })}
              rows="3"
              maxLength={300}
              disabled={isSaving}
            />
            <div className="save-destination-form-hint">
              <FormattedMessage id="descriptionHint" />
            </div>
          </div>
        </div>

        <div className="save-destination-modal-buttons">
          <button
            type="button"
            className="save-destination-cancel-button"
            onClick={onCancel}
            disabled={isSaving}
          >
            <FormattedMessage id="cancel" />
          </button>
          <button
            type="button"
            className="save-destination-save-button"
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? <FormattedMessage id="saving" /> : <FormattedMessage id="saveLocation" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveDestinationModal;
