import { useEffect } from 'react';

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual style of the confirm button. `danger` is red; default is primary. */
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Minimal confirm modal. Reuses the app's existing dark card styling
 * (`.modal-backdrop` + `.modal` from styles.css). Closes on:
 *   - clicking the backdrop
 *   - pressing Escape
 *   - clicking either button
 *
 * The component is uncontrolled by design — parent owns the `open`
 * boolean and the cancel/confirm handlers, which keeps cleanup
 * (e.g. clearing a "pending" form state) at the call site.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: Props) {
  // Escape-to-close. Adding/removing the listener inside the effect
  // keeps the listener count at most 1 even with multiple dialogs
  // mounted (only one is `open` at a time in practice).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        // Only treat clicks on the backdrop itself as cancel — not
        // on the modal contents bubbling up to here.
        if (e.target === e.currentTarget) onCancel();
      }}
      role="presentation"
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {message && <div className="mute" style={{ marginBottom: 12 }}>{message}</div>}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-sm" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`btn btn-sm ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
