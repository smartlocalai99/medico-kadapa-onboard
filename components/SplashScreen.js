import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';

export default function SplashScreen({ onComplete }) {
  const [fadeAway, setFadeAway] = useState(false);

  const handleComplete = useCallback(() => {
    setFadeAway(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 600);
  }, [onComplete]);

  useEffect(() => {
    // Safety fallback: transition after 4 seconds
    const timeout = setTimeout(() => {
      handleComplete();
    }, 4000);

    return () => clearTimeout(timeout);
  }, [handleComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black transition-opacity duration-600 ease-in-out ${
        fadeAway ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Animated image avoids native mobile video controls entirely. */}
      <Image
        src="/splashscreen.webp"
        alt=""
        aria-hidden="true"
        fill
        priority
        unoptimized
        sizes="100vw"
        className="object-cover pointer-events-none"
      />

    </div>
  );
}
