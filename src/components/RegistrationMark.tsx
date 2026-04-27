export function RegistrationMark({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      className={className}
      aria-hidden="true"
    >
      <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="0.6" />
      <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="0.6" />
      <circle cx="6" cy="6" r="3.5" fill="none" stroke="currentColor" strokeWidth="0.6" />
    </svg>
  );
}
