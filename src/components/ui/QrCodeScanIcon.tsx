import React from 'react';

/**
 * High Quality QR Code / Barcode Scan Vector Icon
 * Designed in the style of ChilliColor - Flaticon
 * Attribute: QR Code Icons created by ChilliColor - Flaticon (https://www.flaticon.com/free-icons/qr-code)
 */
export const QrCodeScanIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-5 h-5',
  size = 20,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Outer Corner Frame Brackets (Scanner Frame) */}
    <path d="M4 8V5C4 4.44772 4.44772 4 5 4H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 4H19C19.5523 4 20 4.44772 20 5V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 16V19C20 19.5523 19.5523 20 19 20H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 20H5C4.44772 20 4 19.5523 4 19V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

    {/* Top-Left QR Positioning Square */}
    <rect x="6.5" y="6.5" width="4" height="4" rx="1" fill="currentColor" />

    {/* Top-Right QR Positioning Square */}
    <rect x="13.5" y="6.5" width="4" height="4" rx="1" fill="currentColor" />

    {/* Bottom-Left QR Positioning Square */}
    <rect x="6.5" y="13.5" width="4" height="4" rx="1" fill="currentColor" />

    {/* Bottom-Right 2D Barcode Data Modules */}
    <rect x="13.5" y="13.5" width="2" height="2" rx="0.5" fill="currentColor" />
    <rect x="16.5" y="13.5" width="1" height="1" rx="0.3" fill="currentColor" />
    <rect x="13.5" y="16.5" width="1.5" height="1.5" rx="0.4" fill="currentColor" />
    <rect x="16" y="16" width="1.5" height="1.5" rx="0.4" fill="currentColor" />

    {/* Center Laser Scanning Line */}
    <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1 1.5" />
  </svg>
);
