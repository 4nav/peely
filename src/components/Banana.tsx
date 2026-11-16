export default function Banana({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 8.2C4.6 16.6 14 20.4 21.6 14.6c.4-.3.5-.8.1-1.1-6.2 2.6-13.4-.2-17-6.1z" fill="#e3b93c" />
      <path d="M2.5 8.2l1.7-1.7 1.1 1.4z" fill="#6b5a2a" />
    </svg>
  );
}
