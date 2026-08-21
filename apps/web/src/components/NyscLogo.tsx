/** Official NYSC crest — uses public asset or embedded fallback. */
export function NyscLogo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/nysc-logo.png"
      width={size}
      height={size}
      alt="NYSC — Service and Humility"
      className={`object-contain ${className}`}
      onError={(e) => {
        const el = e.currentTarget;
        if (el.dataset.fallback) return;
        el.dataset.fallback = "1";
        el.src =
          "data:image/svg+xml," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#000"/><circle cx="32" cy="32" r="26" fill="none" stroke="#C9A227" stroke-width="2"/><text x="32" y="38" text-anchor="middle" fill="#C9A227" font-size="12" font-weight="700" font-family="sans-serif">NYSC</text></svg>`
          );
      }}
    />
  );
}
