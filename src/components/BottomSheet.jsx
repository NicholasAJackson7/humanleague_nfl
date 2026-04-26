import React, { useEffect } from 'react';
import './BottomSheet.css';

export default function BottomSheet({ open, onClose, title, children, footer, dismissable = true }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissable) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-overlay" onClick={dismissable ? onClose : undefined} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grabber" />
        {title && (
          <div className="sheet-header">
            <h3 style={{ margin: 0 }}>{title}</h3>
            {dismissable && (
              <button className="btn btn-ghost sheet-close" onClick={onClose} aria-label="Close">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}
