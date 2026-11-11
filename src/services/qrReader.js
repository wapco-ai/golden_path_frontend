import { prepareZXingModule, purgeZXingModule } from 'zxing-wasm/reader';
import readerWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

let reader;

async function loadReader() {
  const response = await fetch(readerWasmUrl, { priority: 'high' });
  if (!response.ok) throw new Error(`QR reader download failed (${response.status})`);
  return prepareZXingModule({
    overrides: { wasmBinary: new Uint8Array(await response.arrayBuffer()) },
    fireImmediately: true
  });
}

export function prepareQrReader() {
  reader ??= loadReader().catch(error => {
    purgeZXingModule();
    reader = null;
    throw error;
  });
  return reader;
}
