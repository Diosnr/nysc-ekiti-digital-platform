/** Official-style NYSC mark used site-wide (green circle + monogram). */
export function NyscLogo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="NYSC"
    >
      <circle cx="32" cy="32" r="30" fill="#006400" />
      <circle cx="32" cy="32" r="26" fill="none" stroke="#FFD700" strokeWidth="2" />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
        fontSize="16"
        fill="#FFFFFF"
      >
        NYSC
      </text>
    </svg>
  );
}
