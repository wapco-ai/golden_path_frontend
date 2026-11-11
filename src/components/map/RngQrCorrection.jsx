import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BiQrScan } from 'react-icons/bi';
import { FormattedMessage } from 'react-intl';
import { readBarcodes } from 'zxing-wasm/reader';
import { prepareQrReader } from '../../services/qrReader';
import '../../styles/RngQrCorrection.css';

const CAMERA = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 720 } }, audio: false };
const READER_OPTIONS = { formats: ['QRCode'], maxNumberOfSymbols: 1 };
const HINT_KEY = 'rngQrCorrectionHintSeen';

export default function RngQrCorrection({ text, onScan }) {
  const dialog = useRef(null);
  const videoRef = useRef(null);
  const request = useRef(null);
  const scanHandler = useRef(onScan);
  const [phase, setPhase] = useState(null);
  const [showHint, setShowHint] = useState(() => !sessionStorage.getItem(HINT_KEY));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(HINT_KEY, '1');
      setShowHint(false);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { scanHandler.current = onScan; }, [onScan]);

  const close = useCallback(() => {
    request.current?.abort();
    request.current = null;
    dialog.current.close();
    setPhase(null);
  }, []);

  const scan = useCallback(async (value) => {
    if (!dialog.current?.open || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPhase('loading');
    try {
      const error = await scanHandler.current(value, controller.signal);
      if (controller.signal.aborted) return;
      if (error) setPhase(error);
      else close();
    } catch {
      if (!controller.signal.aborted) setPhase('connection');
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [close]);

  useEffect(() => {
    if (phase !== 'cameraOpen') return undefined;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let stopped = false;
    let timer;
    let stream;
    const release = () => stream?.getTracks().forEach(track => track.stop());
    const fail = () => { if (!stopped) setPhase('camera'); };

    const readFrame = async () => {
      try {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
          const width = Math.round(video.videoWidth * scale);
          const height = Math.round(video.videoHeight * scale);
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          context.drawImage(video, 0, 0, width, height);
          const [code] = await readBarcodes(context.getImageData(0, 0, width, height), READER_OPTIONS);
          if (stopped) return;
          if (code?.text) {
            release();
            void scan(code.text);
            return;
          }
        }
        timer = window.setTimeout(readFrame, 250);
      } catch {
        fail();
      }
    };

    navigator.mediaDevices.getUserMedia(CAMERA).then(async (camera) => {
      stream = camera;
      if (stopped) return release();
      video.srcObject = stream;
      await Promise.all([video.play(), prepareQrReader()]);
      if (!stopped) void readFrame();
    }).catch(fail);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      release();
      video.srcObject = null;
    };
  }, [phase, scan]);

  const openCamera = () => setPhase(navigator.mediaDevices?.getUserMedia ? 'cameraOpen' : 'camera');

  const failed = phase && phase !== 'cameraOpen' && phase !== 'loading';
  return (
    <>
      <div className="rng-map-actions">
        {showHint && <span className="rng-qr-hint" aria-hidden="true">{text.scan}</span>}
        <button
          type="button"
          className="rng-qr-button"
          aria-label={text.scan}
          aria-haspopup="dialog"
          title={text.scan}
          onClick={() => {
            sessionStorage.setItem(HINT_KEY, '1');
            setShowHint(false);
            dialog.current.showModal();
            openCamera();
          }}
        >
          <BiQrScan size={25} aria-hidden="true" />
        </button>
      </div>
      <dialog
        className="rng-qr-dialog"
        ref={dialog}
        aria-labelledby="rng-qr-dialog-title"
        onCancel={event => { event.preventDefault(); close(); }}
      >
        <h2 id="rng-qr-dialog-title">{text.scan}</h2>
        {phase === 'cameraOpen' && (
          <>
            <p><FormattedMessage id="qrScanInstruction" /></p>
            <div className="rng-qr-camera">
              <video ref={videoRef} autoPlay muted playsInline aria-hidden="true" />
            </div>
          </>
        )}
        {phase === 'loading' && <p role="status">{text.loading}</p>}
        {failed && <p role="alert">{text[phase] || <FormattedMessage id={phase} />}</p>}
        <div className="rng-qr-dialog-actions">
          {failed && <button type="button" onClick={openCamera}>{text.retry}</button>}
          <button type="button" onClick={close}>
            {failed ? text.continue : <FormattedMessage id="cancel" />}
          </button>
        </div>
      </dialog>
    </>
  );
}
