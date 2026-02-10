import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  disabled = false, 
  className = "" 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-4 py-4
        rounded-[14px] 
        font-semibold text-[16px] 
        bg-black text-white 
        transition-all 
        active:scale-[0.98] 
        disabled:opacity-50 disabled:pointer-events-none 
        w-fit 
        ${className}
      `.trim()}
    >
      {children}
    </button>
  );
};

export default Button;