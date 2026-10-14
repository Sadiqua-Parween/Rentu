import React from 'react';

interface CuteBotAvatarProps {
  size?: number | string;
  className?: string;
  isThinking?: boolean;
}

export const CuteBotAvatar: React.FC<CuteBotAvatarProps> = ({
  size = 36,
  className = '',
  isThinking = false,
}) => {
  return (
    <div 
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        {/* Antenna stalk */}
        <line x1="20" y1="7" x2="20" y2="12" stroke="#E11D74" strokeWidth="2.5" strokeLinecap="round" />
        
        {/* Antenna glowing orb */}
        <circle cx="20" cy="5" r="3" fill="#E11D74" />
        <circle cx="20" cy="5" r="1.5" fill="#FFF0F6" className="animate-ping" style={{ animationDuration: '2s' }} />
        <circle cx="20" cy="5" r="1.5" fill="#FFFFFF" />

        {/* Cute headphones / side ears */}
        <rect x="2.5" y="17" width="4.5" height="10" rx="2.2" fill="#E11D74" />
        <rect x="33" y="17" width="4.5" height="10" rx="2.2" fill="#E11D74" />
        <path d="M 6 18 A 14 14 0 0 1 34 18" stroke="#E11D74" strokeWidth="2.2" fill="none" strokeLinecap="round" />

        {/* Bot Head Body */}
        <rect
          x="5.5"
          y="11"
          width="29"
          height="24"
          rx="9"
          fill="url(#cuteBotHeadGrad)"
          stroke="#E11D74"
          strokeWidth="2"
        />

        {/* Face screen inset */}
        <rect
          x="8.5"
          y="14"
          width="23"
          height="17"
          rx="6"
          fill="#FFF5F8"
          stroke="#FBCFE8"
          strokeWidth="1.2"
        />

        {/* Cute Blushing Cheeks */}
        <ellipse cx="11.5" cy="24.5" rx="2.2" ry="1.4" fill="#FDA4AF" opacity="0.9" />
        <ellipse cx="28.5" cy="24.5" rx="2.2" ry="1.4" fill="#FDA4AF" opacity="0.9" />

        {/* Cute Eyes */}
        {isThinking ? (
          <>
            {/* Thinking / happy eyes (^  ^) */}
            <path d="M 12.5 21.5 Q 15 18.5 17.5 21.5" stroke="#E11D74" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M 22.5 21.5 Q 25 18.5 27.5 21.5" stroke="#E11D74" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            {/* Left Eye */}
            <circle cx="15" cy="20.5" r="2.8" fill="#1E1B4B" />
            <circle cx="16" cy="19.5" r="1.1" fill="#FFFFFF" />
            {/* Right Eye */}
            <circle cx="25" cy="20.5" r="2.8" fill="#1E1B4B" />
            <circle cx="26" cy="19.5" r="1.1" fill="#FFFFFF" />
          </>
        )}

        {/* Cute Smile */}
        <path
          d="M 18 24.8 Q 20 27.2 22 24.8"
          fill="none"
          stroke="#E11D74"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Sparkle on head */}
        <circle cx="10" cy="15" r="1" fill="#FFFFFF" opacity="0.9" />

        {/* Gradient */}
        <defs>
          <linearGradient id="cuteBotHeadGrad" x1="5" y1="11" x2="35" y2="35" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.7" stopColor="#FFF1F4" />
            <stop offset="1" stopColor="#FCE7F3" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
