"use client";

import React, { useState } from 'react';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  sizeClassName?: string;
  className?: string;
  ringColor?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  sizeClassName = "h-7 w-7",
  className = "",
  ringColor = "ring-[#05BB75]",
}) => {
  const [hasError, setHasError] = useState(false);
  const initial = (name?.trim()?.[0] || 'U').toUpperCase();

  const isCustomRounded = className.includes('rounded-');
  const roundedClass = isCustomRounded ? '' : 'rounded-full';

  if (!src || hasError) {
    return (
      <div
        className={`flex items-center justify-center ${roundedClass} bg-gradient-to-tr from-emerald-600 to-teal-400 font-black text-white select-none shrink-0 ring-2 ${ringColor} ${sizeClassName} ${className}`}
        title={name || 'User'}
      >
        <span className="text-xs leading-none uppercase font-black">{initial}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || 'User'}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`${roundedClass} object-cover ring-2 ${ringColor} shrink-0 ${sizeClassName} ${className}`}
    />
  );
};
