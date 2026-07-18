type Props = { size?: number; className?: string };

export default function AIIcon({ size = 16, className = '' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="11" y="2.5" width="10" height="10" rx="1.1" fill="#F4F4F2" stroke="#B9B9B7" strokeWidth="1" />
      <rect x="3" y="11.5" width="10" height="10" rx="1.1" fill="#F4C430" stroke="#C69212" strokeWidth="1" />
    </svg>
  );
}
