'use client';

import { useId } from 'react';

export default function BrandLogo({
  size = 36,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  const gradientId = useId();

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full drop-shadow-[0_4px_14px_rgba(37,99,235,0.45)]"
      >
        <rect width="48" height="48" rx="13" fill={`url(#${gradientId})`} />
        <path
          d="M24 11C18.48 11 14 15.48 14 21C14 28.5 24 38 24 38C24 38 34 28.5 34 21C34 15.48 29.52 11 24 11ZM24 24.5C22.07 24.5 20.5 22.93 20.5 21C20.5 19.07 22.07 17.5 24 17.5C25.93 17.5 27.5 19.07 27.5 21C27.5 22.93 25.93 24.5 24 24.5Z"
          fill="#FFFFFF"
        />
        <circle cx="35" cy="35" r="4.5" fill="#10B981" stroke="#070b14" strokeWidth="2" />
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="48"
            y2="48"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#2563EB" />
            <stop offset="0.5" stopColor="#4F46E5" />
            <stop offset="1" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
