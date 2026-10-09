/** Theme-aware Studio identity, shared by chrome, Home and About. */
export function PCSLogo({ boxed = false, className = '', decorative = false }: {
  boxed?: boolean; className?: string; decorative?: boolean;
}) {
  return <span className={`pcs-logo${boxed ? ' pcs-logo-boxed' : ''} ${className}`}
    role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'PCS logo'} aria-hidden={decorative || undefined}>
    <span className="pcs-logo-letters"><span className="pcs-letter-p">P</span><span className="pcs-letter-cs">CS</span></span>
  </span>;
}
