import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

export default function RngGuidanceImage({ url, title, loading, error }) {
  const intl = useIntl();
  const [imageStatus, setImageStatus] = useState('loading');
  const failed = error || imageStatus === 'error';
  const showImage = url && imageStatus === 'loaded';
  const message = failed ? 'guidanceImageError'
    : loading || url ? 'guidanceImageLoading' : 'guidanceImageUnavailable';

  return (
    <div className="image-placeholder">
      {url && !failed && (
        <img
          src={url}
          alt={title || intl.formatMessage({ id: 'guidanceImageAlt' })}
          className="live-landmark-image"
          hidden={!showImage}
          onLoad={() => setImageStatus('loaded')}
          onError={() => setImageStatus('error')}
        />
      )}
      {!showImage && (
        <div className="image-placeholder-text" role="status">
          <FormattedMessage id={message} />
        </div>
      )}
    </div>
  );
}
