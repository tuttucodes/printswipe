export function CMYKBar({ height = 6, className = "" }: { height?: number; className?: string }) {
  return (
    <div className={`flex w-full ${className}`} style={{ height }} aria-hidden="true">
      <div style={{ background: "#00AEEF", flex: 1 }} />
      <div style={{ background: "#EC008C", flex: 1 }} />
      <div style={{ background: "#FFF200", flex: 1 }} />
      <div style={{ background: "#000000", flex: 1 }} />
    </div>
  );
}
