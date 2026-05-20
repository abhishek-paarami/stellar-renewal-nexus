// Reusable "finger" loader animation (custom Paarami spinner).
// Use <FingerLoader /> for inline contexts or <FullPageLoader /> for full-screen overlays.
import React from "react";

export function FingerLoader({ label }: { label?: string }) {
  return (
    <div className="loader" role="status" aria-label={label || "Loading"}>
      {label ? <div className="text">{label}</div> : null}
      <div className="finger finger-1"><div className="finger-item"><span /><i /></div></div>
      <div className="finger finger-2"><div className="finger-item"><span /><i /></div></div>
      <div className="finger finger-3"><div className="finger-item"><span /><i /></div></div>
      <div className="finger finger-4"><div className="finger-item"><span /><i /></div></div>
      <div className="last-finger"><div className="last-finger-item"><i /></div></div>
    </div>
  );
}

export function FullPageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="paarami-loader-overlay">
      <FingerLoader label={label} />
    </div>
  );
}

/** Delayed loader: only shows after `delayMs` to avoid flicker on fast transitions. */
export function DelayedLoader({ delayMs = 180, label }: { delayMs?: number; label?: string }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  if (!show) return null;
  return <FullPageLoader label={label} />;
}