import { useEffect, type ReactNode } from 'react';

type DialogProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  titleId?: string;
  contentClassName: string;
  showCloseButton?: boolean;
  closeButtonClassName?: string;
  closeButtonLabel?: string;
  closeOnBackdrop?: boolean;
};

function Dialog({
  isOpen,
  onClose,
  children,
  titleId,
  contentClassName,
  showCloseButton = false,
  closeButtonClassName = 'dialog-close-button',
  closeButtonLabel = '닫기',
  closeOnBackdrop = true,
}: DialogProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onClick={handleBackdropClick}>
      <section
        className={contentClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        {showCloseButton ? (
          <button
            className={closeButtonClassName}
            type="button"
            aria-label={closeButtonLabel}
            onClick={onClose}
          >
            x
          </button>
        ) : null}
        {children}
      </section>
    </div>
  );
}

export default Dialog;
