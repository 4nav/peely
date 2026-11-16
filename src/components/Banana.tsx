
export default function Banana({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      stroke="#292725"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Left peel flap */}
      <path
        d="M25 24 C18 32 14 41 8 44 C5 46 3 47 3 49
          C4 52 11 53 17 52 C23 51 27 47 30 42
          L34 32"
        fill="#E9B83F"
        strokeWidth="1.5"
      />
      <path d="M5 49 Q14 48 23 44" strokeWidth=".7"/>

      {/* Lower-left peel flap */}
      <path
        d="M22 34 C17 41 12 48 8 53
          C5 56 7 59 11 57 C19 54 27 49 32 42
          L35 35"
        fill="#F0C34F"
        strokeWidth="1.5"
      />
      <path d="M10 56 Q18 50 25 44" strokeWidth=".7"/>

      {/* Right peel flap */}
      <path
        d="M39 29 C38 38 41 44 47 47
          C52 50 57 52 60 55 C62 57 60 59 57 58
          C49 56 41 54 37 48 L34 38"
        fill="#E9B83F"
        strokeWidth="1.5"
      />
      <path d="M43 43 Q50 49 59 55" strokeWidth=".7"/>

      {/* Exposed banana fruit */}
      <path
        d="M29 11 C27 17 25 24 22 29
          C18 35 17 42 14 49
          C12 54 14 57 19 54
          C25 51 31 45 34 38
          C38 30 40 22 39 16
          C38 13 36 11 34 10 Z"
        fill="#FFE7A6"
        strokeWidth="1.6"
      />

      {/* Fruit contour details */}
      <path d="M29 17 C28 24 24 29 21 34" strokeWidth=".8"/>
      <path d="M34 18 C36 25 33 33 30 39" strokeWidth=".8"/>
      <path d="M25 37 Q23 42 21 46" strokeWidth=".7"/>

      {/* Stem */}
      <path
        d="M29 12 L31 4 Q32 2 35 4
          L41 6 Q44 7 41 9 L36 12"
        fill="#76502E"
        strokeWidth="1.5"
      />
      <path d="M31 5 Q35 7 40 7" stroke="#E6C99C" strokeWidth=".7"/>

      {/* Small fruit speckles */}
      <g fill="#B58A4B" stroke="none">
        <circle cx="32" cy="25" r=".65"/>
        <circle cx="35" cy="29" r=".5"/>
        <circle cx="29" cy="33" r=".6"/>
        <circle cx="34" cy="36" r=".45"/>
        <circle cx="26" cy="41" r=".5"/>
      </g>

      {/* Peel texture */}
      <g stroke="#A77A2D" strokeWidth=".65" opacity=".8">
        <path d="M12 48 Q15 49 18 48"/>
        <path d="M15 53 Q19 52 21 50"/>
        <path d="M49 49 Q53 51 56 53"/>
      </g>
    </svg>
  );
}
