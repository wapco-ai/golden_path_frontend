// One in-flight request, latest coordinates at each poll. Sensor updates must
// not continually abort/restart the request before it can finish.
export const startGuidanceImagePolling = ({
  readRequest, fetchImage, onResult, onError, onLoading,
  intervalMs = 1500, timeoutMs = 10000,
  schedule = setTimeout, cancel = clearTimeout
}) => {
  let disposed = false;
  let timer;
  let controller;
  let deadline;
  const poll = async () => {
    if (disposed) return;
    controller = new AbortController();
    let timedOut = false;
    deadline = schedule(() => { timedOut = true; controller.abort(); }, timeoutMs);
    onLoading(true);
    try {
      const data = await fetchImage({ ...readRequest(), source: 'guidance_points', signal: controller.signal });
      if (!disposed) onResult(data);
    } catch (error) {
      if (!disposed) onError(timedOut ? new Error('Guidance image request timed out.') : error);
    } finally {
      cancel(deadline);
      if (!disposed) {
        onLoading(false);
        timer = schedule(poll, intervalMs);
      }
    }
  };
  poll();
  return () => {
    disposed = true;
    cancel(timer);
    cancel(deadline);
    controller?.abort();
  };
};
