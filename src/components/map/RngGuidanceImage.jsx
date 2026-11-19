import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

function GuidanceImageFile({ url, reload, onError, ...imageProps }) {
  const [source, setSource] = useState(reload ? null : url);

  useEffect(() => {
    if (!reload) return undefined;

    const controller = new AbortController();
    const { signal } = controller;
    let objectUrl;
    const timeout = setTimeout(() => {
      controller.abort();
      onError();
    }, 10000);

    async function loadFile() {
      try {
        // A previous response may have cached a broken file at this exact URL.
        const response = await fetch(url, { cache: 'reload', signal });
        if (signal.aborted) return;
        if (!response.ok) {
          onError();
          return;
        }
        const blob = await response.blob();
        if (signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      } catch (error) {
        if (signal.aborted) return;
        // Native image loads also support public hosts without CORS headers.
        if (error instanceof TypeError && new URL(url, window.location.href).origin !== window.location.origin) {
          setSource(url);
        } else onError();
      } finally {
        clearTimeout(timeout);
      }
    }
    loadFile();

    return () => {
      clearTimeout(timeout);
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, reload, onError]);

  return source ? <img {...imageProps} src={source} onError={onError} /> : null;
}

export default function RngGuidanceImage({ lookup, loading, error, retryOnNewLookup }) {
  const intl = useIntl();
  const url = lookup?.image?.url;
  const title = lookup?.content?.title;
  const [loaded, setLoaded] = useState(false);
  const [failedLookup, setFailedLookup] = useState(null);
  const latestLookup = useRef(lookup);
  latestLookup.current = lookup;
  const onImageError = useCallback(() => {
    setLoaded(false);
    setFailedLookup(latestLookup.current);
  }, []);
  const waitingToRetry = failedLookup && !loaded && (!retryOnNewLookup || lookup === failedLookup);
  const failed = error || waitingToRetry;
  const showImage = url && loaded;
  const message = failed ? 'guidanceImageError'
    : loading || url ? 'guidanceImageLoading' : 'guidanceImageUnavailable';

  return (
    <div className="image-placeholder">
      {url && !failed && (
        <GuidanceImageFile
          url={url}
          reload={Boolean(failedLookup)}
          alt={title || intl.formatMessage({ id: 'guidanceImageAlt' })}
          className="live-landmark-image"
          hidden={!showImage}
          onLoad={() => setLoaded(true)}
          onError={onImageError}
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
