import {
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { X, type LucideIcon } from "lucide-react";
export function IconButton({
  icon: Icon,
  label,
  active,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`icon-button ${active ? "active" : ""} ${props.className ?? ""}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
    >
      <Icon size={18} strokeWidth={1.7} />
    </button>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    restore = useRef<HTMLElement | null>(null);
  useEffect(() => {
    restore.current = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      restore.current?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-inner">
        <header>
          <h2>{title}</h2>
          <IconButton icon={X} label="Fermer la fenêtre" onClick={onClose} />
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="M28 9a14 14 0 1 0 0 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="28" cy="9" r="3" className="brand-dot" />
      </svg>
      {!compact && (
        <span>
          clair<span className="brand-office">office</span>
        </span>
      )}
    </span>
  );
}
