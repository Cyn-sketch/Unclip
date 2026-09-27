import React from "react";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = "sm", className = "" }) => {
  // Width classes targeting mobile ~95-105px, desktop ~135-145px
  const widthClasses = {
    sm: "w-[100px] sm:w-[140px] h-auto",
    md: "w-[130px] sm:w-[180px] h-auto",
    lg: "w-[160px] sm:w-[220px] h-auto",
  };

  return (
    <div className={`relative flex items-center group cursor-pointer select-none overflow-visible ${className}`}>
      {/* Official Unclip Logo Graphic Asset */}
      <img
        src="/images/unclip-logo.png"
        alt="UNCLIP by MADAUTOMATE"
        className={`${widthClasses[size]} object-contain relative z-10 transition-transform duration-300 group-hover:scale-105 filter drop-shadow-xl`}
      />
    </div>
  );
};
