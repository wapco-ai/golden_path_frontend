let pendingRoutingRequests = 0;

export const ROUTING_ACTIVITY_EVENT = 'goldenpath:routing-activity-change';

const emitRoutingActivity = () => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(ROUTING_ACTIVITY_EVENT, {
      detail: { pending: pendingRoutingRequests }
    })
  );
};

export const beginRoutingRequest = () => {
  pendingRoutingRequests += 1;
  emitRoutingActivity();
};

export const endRoutingRequest = () => {
  pendingRoutingRequests = Math.max(0, pendingRoutingRequests - 1);
  emitRoutingActivity();
};

export const getPendingRoutingRequests = () => pendingRoutingRequests;
