import React from 'react';

export interface SagaIconProps {
  className?: string;
  size?: number;
  ariaLabel?: string;
  tone?: 'light' | 'dark';
}

export interface SagaNavIconProps extends SagaIconProps {
  active?: boolean;
}

function getSvgAccessibilityProps(ariaLabel?: string) {
  if (ariaLabel) {
    return {
      role: 'img' as const,
      'aria-label': ariaLabel,
    };
  }
  return {
    'aria-hidden': true as const,
  };
}

function getInkStroke(tone: 'light' | 'dark' = 'light'): string {
  return tone === 'dark' ? '#FFFFFF' : '#1E293B';
}

/**
 * 1. AKSI KARTU ABSENSI UTAMA & NAV ABSEN
 */
export const SagaScanQrIcon: React.FC<SagaIconProps> = ({
  className = 'w-6 h-6',
  size,
  ariaLabel,
  tone = 'light',
}) => {
  const ink = getInkStroke(tone);
  const darkMode = tone === 'dark';
  const fillYellow = '#FDE047';
  const fillBlue = darkMode ? '#93C5FD' : '#60A5FA';
  const fillGreen = darkMode ? '#6EE7B7' : '#4ADE80';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...getSvgAccessibilityProps(ariaLabel)}
    >
      {/* Offset cheerful paper fill */}
      <rect x="9" y="9" width="20" height="20" rx="5" fill={darkMode ? fillBlue : '#FEF3C7'} fillOpacity={darkMode ? 0.25 : 0.9} />
      {/* QR Blocks with slight offset */}
      <rect x="10.5" y="10.5" width="7" height="7" rx="1.8" fill={fillYellow} />
      <rect x="20.5" y="10.5" width="7" height="7" rx="1.8" fill={fillBlue} />
      <rect x="10.5" y="20.5" width="7" height="7" rx="1.8" fill={fillGreen} />
      <rect x="20.5" y="20.5" width="3.5" height="3.5" rx="0.9" fill={fillYellow} />
      <rect x="24.5" y="24.5" width="3" height="3" rx="0.8" fill={darkMode ? fillGreen : '#FB923C'} />

      {/* Organic hand-drawn scanner brackets */}
      <path d="M5.5 11.5C5.3 7.5 6.8 5.5 11.5 5.5" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24.5 5.5C28.8 5.3 30.7 6.8 30.5 11.5" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30.5 24.5C30.7 28.8 29.2 30.7 24.5 30.5" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 30.5C7.2 30.7 5.3 29.2 5.5 24.5" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />

      {/* Hand-drawn code outlines */}
      <rect x="9.5" y="9.5" width="7" height="7" rx="1.8" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="19.5" y="9.5" width="7" height="7" rx="1.8" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="9.5" y="19.5" width="7" height="7" rx="1.8" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 20.5H23V23.5M25.5 20.5H26.5M20 26.2H22M24.2 24.2H26.5V26.5H24.2Z" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Laser line */}
      <path d="M7 18.2C14 17.8 22 18.4 29 18" stroke={darkMode ? fillYellow : ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const SagaFingerprintIcon: React.FC<SagaIconProps> = ({
  className = 'w-6 h-6',
  size,
  ariaLabel,
  tone = 'light',
}) => {
  const ink = getInkStroke(tone);
  const darkMode = tone === 'dark';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...getSvgAccessibilityProps(ariaLabel)}
    >
      {/* Offset warm rounded badge */}
      <rect x="7" y="6.5" width="23.5" height="24.5" rx="9" fill={darkMode ? '#6EE7B7' : '#FEF3C7'} fillOpacity={darkMode ? 0.28 : 1} />
      <circle cx="19" cy="18.5" r="7.5" fill={darkMode ? '#93C5FD' : '#4ADE80'} fillOpacity={darkMode ? 0.35 : 0.45} />
      <circle cx="25.5" cy="24.5" r="4.8" fill="#FDE047" />

      {/* Organic hand-drawn fingerprint ridges */}
      <path d="M10.2 16.5C10.2 11.4 13.8 8.2 18.2 8.2C22.6 8.2 26 11.6 26 16.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M13.2 21.5C13 18 13.3 15.2 14.5 13.5C15.5 12 17 11.4 18.4 11.4C20.8 11.4 22.8 13.3 22.8 16.2V20.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M10.4 21.8C10.6 24.4 11.7 26.6 13.5 28" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M17.8 15.5V20.8C17.8 23.2 16.2 25 14.2 25.4" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <circle cx="25" cy="24" r="4.5" stroke={ink} strokeWidth="2" />
      <path d="M23.3 24L24.5 25.3L26.9 22.8" stroke={darkMode ? '#1E293B' : ink} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaLeavePermitIcon: React.FC<SagaIconProps> = ({
  className = 'w-6 h-6',
  size,
  ariaLabel,
  tone = 'light',
}) => {
  const ink = getInkStroke(tone);
  const darkMode = tone === 'dark';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...getSvgAccessibilityProps(ariaLabel)}
    >
      {/* Offset warm sheet & fold fill */}
      <path d="M9.5 7.5C9.5 6 10.6 5 12 5H21.2L27.5 11.2V27.5C27.5 29 26.4 30 25 30H12C10.6 30 9.5 29 9.5 27.5V7.5Z" fill={darkMode ? '#93C5FD' : '#FEF3C7'} fillOpacity={darkMode ? 0.35 : 1} />
      <path d="M20.5 5.2L27 11.2H20.5V5.2Z" fill={darkMode ? '#FDE047' : '#FB923C'} fillOpacity={0.85} />
      <circle cx="26.5" cy="25.5" r="6" fill={darkMode ? '#6EE7B7' : '#4ADE80'} />

      {/* Crisp ink lines */}
      <path d="M8 6.8C8 5.4 9.1 4.4 10.5 4.4H19.8L26 10.5V26.2C26 27.6 24.9 28.7 23.5 28.7H10.5C9.1 28.7 8 27.6 8 26.2V6.8Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M19.8 4.4V10.5H26" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 15.2H19.5M12 19.8H16.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <circle cx="25.5" cy="24.8" r="5.6" stroke={ink} strokeWidth="2" />
      <path d="M23.2 24.9L24.8 26.5L28 23.3" stroke={darkMode ? '#1E293B' : ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/**
 * 2. 8 LAYANAN KISI UTAMA & IKON LAYANAN SEKUNDER (DOODLE BERWARNA)
 */
export const SagaScheduleIcon: React.FC<SagaIconProps> = ({
  className = 'w-7 h-7',
  size,
  ariaLabel,
  tone = 'light',
}) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="6.5" y="9" width="24.5" height="21.5" rx="4.5" fill="#FEF3C7" />
      <path d="M6.5 13C6.5 10.5 8.5 8.8 11 8.8H26.5C29 8.8 31 10.5 31 13V15H6.5V13Z" fill="#4ADE80" />
      <rect x="10.2" y="18.2" width="6.5" height="5.5" rx="1.4" fill="#FDE047" />
      <rect x="19" y="18.8" width="8.5" height="2.4" rx="1.2" fill="#60A5FA" />
      <rect x="19" y="23.5" width="6.2" height="2.4" rx="1.2" fill="#FB923C" />
      {/* Rings & Body outline */}
      <rect x="5" y="7.5" width="25" height="22" rx="4.5" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M5.3 13.8H29.7" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M11.5 4.8V9.2M23.5 4.8V9.2" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <rect x="9.5" y="17.5" width="6" height="5.2" rx="1.2" stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18.5 19H25.5M18.5 23.2H23.2" stroke={ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const SagaHistoryIcon: React.FC<SagaIconProps> = ({
  className = 'w-7 h-7',
  size,
  ariaLabel,
  tone = 'light',
}) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="7" y="6.2" width="23.5" height="24" rx="4.5" fill="#FEF3C7" />
      <rect x="11" y="20" width="4" height="7" rx="1.2" fill="#60A5FA" />
      <rect x="16.8" y="15.5" width="4" height="11.5" rx="1.2" fill="#4ADE80" />
      <rect x="22.5" y="11.8" width="4" height="15.2" rx="1.2" fill="#FDE047" />
      <rect x="5.5" y="5" width="24" height="24" rx="4.5" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="10" y="19.2" width="3.8" height="6.8" rx="1" stroke={ink} strokeWidth="1.9" strokeLinejoin="round" />
      <rect x="15.8" y="14.5" width="3.8" height="11.5" rx="1" stroke={ink} strokeWidth="1.9" strokeLinejoin="round" />
      <rect x="21.5" y="10.8" width="3.8" height="15.2" rx="1" stroke={ink} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M10.5 13.5C13.5 11 15.8 11.8 18.2 10.2L24.5 7.8" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaAdminHubIcon: React.FC<SagaIconProps> = ({
  className = 'w-7 h-7',
  size,
  ariaLabel,
  tone = 'light',
}) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M6.5 10.5C6.5 8.8 7.8 7.5 9.5 7.5H15.8L18.5 10.8H28C29.6 10.8 31 12.1 31 13.8V26.2C31 27.9 29.6 29.2 28 29.2H9.5C7.8 29.2 6.5 27.9 6.5 26.2V10.5Z" fill="#FB923C" fillOpacity="0.9" />
      <rect x="6.5" y="13.5" width="24" height="14.5" rx="3.2" fill="#FDE047" />
      <circle cx="24.5" cy="21" r="3" fill="#60A5FA" />
      <path d="M5 9.5C5 7.8 6.3 6.5 8 6.5H14.5L17.2 9.8H26.5C28.2 9.8 29.5 11.1 29.5 12.8V25C29.5 26.7 28.2 28 26.5 28H8C6.3 28 5 26.7 5 25V9.5Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M5.4 13.5H29.1" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M10 19H18.5M10 23H15.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <circle cx="23.5" cy="20.5" r="2.6" stroke={ink} strokeWidth="2" />
    </svg>
  );
};

export const SagaHomeroomIcon: React.FC<SagaIconProps> = ({
  className = 'w-7 h-7',
  size,
  ariaLabel,
  tone = 'light',
}) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M18.5 7.5L5.5 14.2L18.5 20.5L31.5 14.2L18.5 7.5Z" fill="#60A5FA" />
      <path d="M11.5 17.2V24.8C11.5 27.2 14.8 29.2 18.8 29.2C22.8 29.2 26 27.2 26 24.8V17.2L18.8 20.5L11.5 17.2Z" fill="#C4B5FD" />
      <circle cx="29.5" cy="24.2" r="2.2" fill="#FDE047" />
      <path d="M17.5 6.5L4.5 13L17.5 19.2L30.5 13L17.5 6.5Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M10.2 16.2V24C10.2 26.4 13.5 28.4 17.5 28.4C21.5 28.4 24.8 26.4 24.8 24V16.2" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28.8 14V22.8" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <circle cx="28.8" cy="24" r="1.8" stroke={ink} strokeWidth="1.9" />
    </svg>
  );
};

export const SagaCreateExamIcon: React.FC<SagaIconProps> = ({
  className = 'w-7 h-7',
  size,
  ariaLabel,
  tone = 'light',
}) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="7" y="6.5" width="18" height="24" rx="3.5" fill="#FEF3C7" />
      <path d="M19.5 26L28.5 16.8L31.5 19.8L22.5 29L18 30.2L19.5 26Z" fill="#FB923C" />
      <rect x="9.5" y="10.5" width="10.5" height="2.4" rx="1.2" fill="#60A5FA" />
      <rect x="5.5" y="5" width="18" height="24.5" rx="3.5" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M9.5 11.2H19M9.5 15.8H16.5M9.5 20.4H14.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M18.8 25.5L27.5 16.8C28.4 15.9 29.8 15.9 30.7 16.8C31.6 17.7 31.6 19.1 30.7 20L22 28.7L17.5 30L18.8 25.5Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaGradingIcon: React.FC<SagaIconProps> = ({
  className = 'w-7 h-7',
  size,
  ariaLabel,
  tone = 'light',
}) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="8" y="7.8" width="20" height="23.5" rx="3.5" fill="#FEF3C7" />
      <rect x="14" y="4.8" width="8.5" height="4.5" rx="1.8" fill="#FB923C" />
      <circle cx="25.5" cy="25" r="6" fill="#4ADE80" />
      <rect x="6.5" y="6.5" width="20" height="24" rx="3.5" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="12.2" y="4" width="8.6" height="4.5" rx="1.8" stroke={ink} strokeWidth="2" />
      <path d="M11 14H19M11 18.8H16" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <circle cx="24.5" cy="24.2" r="5.8" stroke={ink} strokeWidth="2" />
      <path d="M22 24.3L23.8 26L27.2 22.4" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaStudentsIcon: React.FC<SagaIconProps> = ({
  className = 'w-7 h-7',
  size,
  ariaLabel,
  tone = 'light',
}) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <circle cx="24" cy="13.5" r="4" fill="#FDE047" />
      <path d="M19.5 28.8C19.5 24.5 22 22 25.5 22C29 22 31.2 24.5 31.2 28.8H19.5Z" fill="#60A5FA" fillOpacity="0.85" />
      <circle cx="14.5" cy="12.5" r="4.8" fill="#FDA4AF" />
      <path d="M6.2 29C6.2 23.6 10 19.8 14.5 19.8C19 19.8 22.8 23.6 22.8 29H6.2Z" fill="#4ADE80" />
      <circle cx="23.2" cy="12.8" r="3.6" stroke={ink} strokeWidth="2" />
      <path d="M20.2 21.5C21.5 20.8 23 20.5 24.6 20.5C28 20.5 30.5 23.2 30.5 27.8H23" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="13.5" cy="12" r="4.5" stroke={ink} strokeWidth="2" />
      <path d="M5.2 28C5.2 22.8 8.9 19 13.5 19C18.1 19 21.8 22.8 21.8 28H5.2Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaMoreAppsIcon: React.FC<SagaIconProps> = ({
  className = 'w-7 h-7',
  size,
  ariaLabel,
  tone = 'light',
}) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="7" y="7" width="10" height="10" rx="3" fill="#4ADE80" />
      <rect x="20.5" y="7" width="10" height="10" rx="3" fill="#FDE047" />
      <rect x="7" y="20.5" width="10" height="10" rx="3" fill="#60A5FA" />
      <rect x="20.5" y="20.5" width="10" height="10" rx="3" fill="#FDA4AF" />
      <rect x="6" y="6" width="10" height="10" rx="3" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="19.5" y="6" width="10" height="10" rx="3" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="6" y="19.5" width="10" height="10" rx="3" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="19.5" y="19.5" width="10" height="10" rx="3" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

/**
 * 3. IKON LAYANAN SEKUNDER & MODUL GURU (DOODLE BERWARNA)
 */
export const SagaOralExamIcon: React.FC<SagaIconProps> = ({ className = 'w-7 h-7', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="6.5" y="8.5" width="11.5" height="20.5" rx="2.8" fill="#FEF3C7" />
      <rect x="18" y="8.5" width="11.5" height="20.5" rx="2.8" fill="#60A5FA" fillOpacity="0.65" />
      <circle cx="24" cy="17.5" r="3" fill="#FDE047" />
      <rect x="5.5" y="7.5" width="12" height="20.5" rx="2.5" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="17.5" y="7.5" width="12" height="20.5" rx="2.5" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="22.8" cy="17" r="2.4" stroke={ink} strokeWidth="2" />
      <path d="M26.5 13.5C27.8 14.8 27.8 19.2 26.5 20.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M8.8 12.8H14M8.8 17H13" stroke={ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const SagaExamCardIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="6" y="8.5" width="25" height="20" rx="4" fill="#FEF3C7" />
      <rect x="9.5" y="12.5" width="6.5" height="7" rx="1.4" fill="#60A5FA" />
      <rect x="18" y="13" width="10" height="2.4" rx="1.2" fill="#4ADE80" />
      <rect x="4.5" y="7.5" width="25.5" height="20" rx="4" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="8.5" y="11.5" width="6.2" height="6.8" rx="1.2" stroke={ink} strokeWidth="1.9" />
      <path d="M17.5 13.2H26.5M17.5 17H23.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M9 22.8H11M13.5 22.8H17M19.5 22.8H21M23.5 22.8H26.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const SagaCalendarAgendaIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="6.5" y="8" width="24.5" height="22" rx="4.5" fill="#FEF3C7" />
      <path d="M6.5 12C6.5 9.8 8.3 8 10.5 8H27C29.2 8 31 9.8 31 12V14H6.5V12Z" fill="#60A5FA" />
      <circle cx="18.8" cy="21.5" r="4.2" fill="#FDE047" />
      <rect x="5" y="6.8" width="25" height="22" rx="4.5" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M5.5 13.2H29.5M11.5 4.5V8.5M23.5 4.5V8.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <circle cx="17.8" cy="21" r="4" stroke={ink} strokeWidth="2" />
    </svg>
  );
};

export const SagaClassroomIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M6 15.5L18.5 7.5L31 15.5H6Z" fill="#FB923C" />
      <rect x="8.5" y="15.5" width="20" height="14" rx="2" fill="#FEF3C7" />
      <rect x="15.5" y="20.5" width="6" height="9" rx="1.2" fill="#60A5FA" />
      <path d="M5 14.5L17.8 6.5L30.5 14.5H5Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="7.5" y="14.5" width="20.5" height="14.5" rx="2" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="14.8" y="20" width="6" height="9" rx="1" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaBookMaterialIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M6.5 9C6.5 7.6 7.6 6.5 9 6.5H18.5V29H9C7.6 29 6.5 27.9 6.5 26.5V9Z" fill="#4ADE80" fillOpacity="0.65" />
      <path d="M18.5 6.5H28C29.4 6.5 30.5 7.6 30.5 9V26.5C30.5 27.9 29.4 29 28 29H18.5V6.5Z" fill="#FEF3C7" />
      <path d="M22.5 6.5V16.5L24.5 15L26.5 16.5V6.5" fill="#FB923C" />
      <path d="M5.5 8.5C5.5 7.1 6.6 6 8 6H17.5V28H8C6.6 28 5.5 26.9 5.5 25.5V8.5Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M17.5 6H27C28.4 6 29.5 7.1 29.5 8.5V25.5C29.5 26.9 28.4 28 27 28H17.5V6Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M21.8 6V16L23.8 14.5L25.8 16V6" stroke={ink} strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaMapPinIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  const darkMode = tone === 'dark';
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <ellipse cx="18.5" cy="28.5" rx="10" ry="3" fill={darkMode ? '#6EE7B7' : '#4ADE80'} fillOpacity={darkMode ? 0.55 : 0.7} />
      <path d="M18.8 5.8C13.6 5.8 9.5 9.9 9.5 15.1C9.5 22 18.8 29 18.8 29C18.8 29 28.1 22 28.1 15.1C28.1 9.9 24 5.8 18.8 5.8Z" fill={darkMode ? '#FDE047' : '#FDA4AF'} />
      <path d="M17.5 5C12.3 5 8.2 9.1 8.2 14.3C8.2 21.2 17.5 28.2 17.5 28.2C17.5 28.2 26.8 21.2 26.8 14.3C26.8 9.1 22.7 5 17.5 5Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="17.5" cy="14.2" r="3.6" fill="#FFFFFF" stroke={darkMode ? '#1E293B' : ink} strokeWidth="2" />
    </svg>
  );
};

export const SagaRfidKioskIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="7.5" y="9" width="22" height="19.5" rx="4" fill="#60A5FA" fillOpacity="0.45" />
      <circle cx="15" cy="18.5" r="3" fill="#FDE047" />
      <rect x="6" y="7.8" width="22.5" height="19.5" rx="4" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="14.2" cy="17.5" r="2.5" stroke={ink} strokeWidth="2" />
      <path d="M19.5 14C21.2 15.7 21.2 19.3 19.5 21" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M23.2 11.5C25.8 14.8 25.8 20.2 23.2 23.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const SagaEmergencySosIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M18.8 5.8L8.2 10.2V18C8.2 24.4 12.6 29.8 18.8 31.5C25 29.8 29.4 24.4 29.4 18V10.2L18.8 5.8Z" fill="#FDA4AF" />
      <circle cx="18.8" cy="18.2" r="5" fill="#FDE047" />
      <path d="M17.5 4.8L7 9.2V17C7 23.4 11.4 28.8 17.5 30.5C23.6 28.8 28 23.4 28 17V9.2L17.5 4.8Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M17.5 11.8V19" stroke={ink} strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="17.5" cy="23.2" r="1.4" fill={ink} />
    </svg>
  );
};

export const SagaAspirationIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M7.5 9C7.5 7.1 9.1 5.5 11 5.5H27C28.9 5.5 30.5 7.1 30.5 9V21.5C30.5 23.4 28.9 25 27 25H15L9 30V25H11C9.1 25 7.5 23.4 7.5 21.5V9Z" fill="#60A5FA" fillOpacity="0.65" />
      <rect x="11.5" y="11" width="13.5" height="2.4" rx="1.2" fill="#FDE047" />
      <path d="M6 8.2C6 6.4 7.4 5 9.2 5H25.8C27.6 5 29 6.4 29 8.2V21C29 22.8 27.6 24.2 25.8 24.2H14L8 29.2V24.2H9.2C7.4 24.2 6 22.8 6 21V8.2Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M11 12H23.5M11 17H19" stroke={ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const SagaVoiceAudioIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M7 15H12.5L20 8.8V28.2L12.5 22H7C6 22 5.2 21.2 5.2 20.2V16.8C5.2 15.8 6 15 7 15Z" fill="#FB923C" />
      <path d="M6.2 14H11.8L19.2 7.8V27.2L11.8 21H6.2C5.2 21 4.4 20.2 4.4 19.2V15.8C4.4 14.8 5.2 14 6.2 14Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M23.5 13.5C25.2 15.3 25.2 20.2 23.5 22" stroke={ink} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M27.5 10C30.4 14 30.4 21.5 27.5 25.5" stroke={ink} strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
};

export const SagaChallengeTrophyIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M11.5 7.5H26V16.5C26 20.5 22.8 23.8 18.8 23.8C14.8 23.8 11.5 20.5 11.5 16.5V7.5Z" fill="#FDE047" />
      <rect x="12.5" y="28" width="12.5" height="3.2" rx="1.5" fill="#FB923C" />
      <path d="M10.5 6.5H24.5V15.5C24.5 19.4 21.4 22.5 17.5 22.5C13.6 22.5 10.5 19.4 10.5 15.5V6.5Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M10.5 9H6.5C5.9 9 5.5 9.4 5.5 10V13C5.5 15.5 7.5 17.5 10 17.5H10.5" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M24.5 9H28.5C29.1 9 29.5 9.4 29.5 10V13C29.5 15.5 27.5 17.5 25 17.5H24.5" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M17.5 22.5V27.5M11.8 28H23.2" stroke={ink} strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
};

export const SagaMedalRankIcon: React.FC<SagaIconProps & { rank?: number }> = ({
  rank = 1,
  className = 'w-6 h-6',
  size,
  ariaLabel,
  tone = 'light',
}) => {
  const ink = getInkStroke(tone);
  const medalFill = rank === 1 ? '#FDE047' : rank === 2 ? '#CBD5E1' : '#FB923C';
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M11.5 5.5H17L19 12.5H13.5L11.5 5.5Z" fill="#60A5FA" />
      <path d="M25.5 5.5H20L18 12.5H23.5L25.5 5.5Z" fill="#FDA4AF" />
      <circle cx="18.8" cy="22.2" r="8.8" fill={medalFill} />
      <path d="M10.5 5H16L18 12M24.5 5H19L17 12" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.5" cy="21.5" r="8.5" stroke={ink} strokeWidth="2" />
      <text
        x="17.5"
        y="25"
        textAnchor="middle"
        fill={tone === 'dark' ? '#FFFFFF' : '#1E293B'}
        fontSize="10"
        fontWeight="800"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {rank <= 3 ? rank : '#'}
      </text>
    </svg>
  );
};

export const SagaNotulenIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="8" y="6" width="21" height="25" rx="4" fill="#FEF3C7" />
      <circle cx="13" cy="13" r="1.8" fill="#4ADE80" />
      <circle cx="13" cy="18.5" r="1.8" fill="#60A5FA" />
      <circle cx="13" cy="24" r="1.8" fill="#FB923C" />
      <rect x="6.5" y="4.8" width="21.5" height="25.5" rx="4" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 12.5H24M16 18H24M16 23.5H21.2" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <circle cx="11.8" cy="12.5" r="1.4" fill={ink} />
      <circle cx="11.8" cy="18" r="1.4" fill={ink} />
      <circle cx="11.8" cy="23.5" r="1.4" fill={ink} />
    </svg>
  );
};

export const SagaBimtekIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="6.5" y="8" width="24" height="18" rx="3.5" fill="#FEF3C7" />
      <circle cx="24.5" cy="20.5" r="4.6" fill="#FDE047" />
      <path d="M22.5 24.5V30.5L24.5 29L26.5 30.5V24.5" fill="#FB923C" />
      <rect x="5" y="6.8" width="24.5" height="18" rx="3.5" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M9.5 12H19.5M9.5 16.5H16" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <circle cx="23.8" cy="19.5" r="4.4" stroke={ink} strokeWidth="2" />
      <path d="M21.8 23.5V29.8L23.8 28.4L25.8 29.8V23.5" stroke={ink} strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaCounselingIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M18.8 5.8L8.2 10.2V18C8.2 24.4 12.6 29.8 18.8 31.5C25 29.8 29.4 24.4 29.4 18V10.2L18.8 5.8Z" fill="#4ADE80" fillOpacity="0.45" />
      <path d="M18.5 24.5C18.5 24.5 12.8 20.6 12.8 16.6C12.8 14.8 14.2 13.4 16 13.4C17.1 13.4 18 14 18.5 14.9C19 14 19.9 13.4 21 13.4C22.8 13.4 24.2 14.8 24.2 16.6C24.2 20.6 18.5 24.5 18.5 24.5Z" fill="#FDA4AF" />
      <path d="M17.5 4.8L7 9.2V17C7 23.4 11.4 28.8 17.5 30.5C23.6 28.8 28 23.4 28 17V9.2L17.5 4.8Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M17.5 23.5C17.5 23.5 12 19.8 12 16C12 14.3 13.3 13 15 13C16 13 16.9 13.6 17.5 14.5C18.1 13.6 19 13 20 13C21.7 13 23 14.3 23 16C23 19.8 17.5 23.5 17.5 23.5Z" stroke={ink} strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaGamePidIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="6" y="10.5" width="25.5" height="16.5" rx="7" fill="#C4B5FD" />
      <circle cx="23.2" cy="16" r="1.8" fill="#FDE047" />
      <circle cx="26.5" cy="19.5" r="1.8" fill="#4ADE80" />
      <rect x="4.5" y="9.5" width="25.5" height="16.5" rx="7" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 14.2V21M8.8 17.6H15.2" stroke={ink} strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="22.5" cy="15.5" r="1.6" stroke={ink} strokeWidth="1.8" />
      <circle cx="25.5" cy="18.8" r="1.6" stroke={ink} strokeWidth="1.8" />
    </svg>
  );
};

export const SagaSarprasIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M19 6L30 11.8V25L19 30.8L8 25V11.8L19 6Z" fill="#FEF3C7" />
      <path d="M19 17.5L30 11.8V25L19 30.8V17.5Z" fill="#FB923C" fillOpacity="0.6" />
      <path d="M17.5 5L28.5 10.8V24.2L17.5 30L6.5 24.2V10.8L17.5 5Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M6.8 11L17.5 16.8L28.2 11M17.5 16.8V30" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaBellIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  const darkMode = tone === 'dark';
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M11 16.5C11 12 14.5 8.5 19 8.5C23.5 8.5 27 12 27 16.5V22.5L29.5 25.5H8.5L11 22.5V16.5Z" fill={darkMode ? '#FDE047' : '#FDE047'} fillOpacity={darkMode ? 0.9 : 1} />
      <path d="M10 15.5C10 11 13.5 7.5 18 7.5C22.5 7.5 26 11 26 15.5V21.5L28.5 24.5H7.5L10 21.5V15.5Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M18 4.8V7.2M14.5 26.8C15.2 28.4 16.5 29.3 18 29.3C19.5 29.3 20.8 28.4 21.5 26.8" stroke={ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const SagaDeviceShieldIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="10.5" y="5.5" width="16.5" height="26.5" rx="3.5" fill="#60A5FA" fillOpacity="0.45" />
      <rect x="15" y="15.5" width="7.5" height="6.5" rx="1.6" fill="#FDE047" />
      <rect x="9.5" y="4.5" width="16.5" height="26.5" rx="3.5" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="14.2" y="14.8" width="7" height="6.2" rx="1.4" stroke={ink} strokeWidth="1.9" />
      <path d="M15.8 14.8V13.2C15.8 12.1 16.6 11.2 17.7 11.2C18.8 11.2 19.6 12.1 19.6 13.2V14.8" stroke={ink} strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="17.7" cy="26.5" r="1.3" fill={ink} />
    </svg>
  );
};

export const SagaAppDownloadIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  const darkMode = tone === 'dark';
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="7.5" y="21.5" width="22.5" height="8" rx="3" fill={darkMode ? '#6EE7B7' : '#4ADE80'} fillOpacity={darkMode ? 0.45 : 0.75} />
      <circle cx="19" cy="13.5" r="6" fill={darkMode ? '#FDE047' : '#60A5FA'} fillOpacity={darkMode ? 0.35 : 0.45} />
      <path d="M6.8 22.8V26.8C6.8 28 7.8 29 9 29H27C28.2 29 29.2 28 29.2 26.8V22.8" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 6V21.5M12.5 16.5L18 22L23.5 16.5" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaRoleSwitchIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <circle cx="18.8" cy="18.5" r="11" fill="#FEF3C7" fillOpacity={tone === 'dark' ? 0.25 : 1} />
      <path d="M8.5 13.5H26.5L22 9" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M27.5 22.5H9.5L14 27" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaPrinterIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  const darkMode = tone === 'dark';
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="6.5" y="13" width="24" height="12" rx="3.2" fill={darkMode ? '#93C5FD' : '#60A5FA'} fillOpacity={darkMode ? 0.45 : 0.75} />
      <rect x="11" y="20" width="15" height="10" rx="1.8" fill={darkMode ? '#FDE047' : '#FEF3C7'} />
      <rect x="10.5" y="5.5" width="15" height="6.5" rx="1.6" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="5.5" y="12" width="25" height="12" rx="3.2" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <rect x="10.2" y="19.5" width="15.6" height="9.8" rx="1.6" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaKeyPinIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <circle cx="13.5" cy="18.5" r="6.5" fill="#FDE047" />
      <circle cx="12.5" cy="18" r="6" stroke={ink} strokeWidth="2" />
      <circle cx="12.5" cy="18" r="2" fill={ink} />
      <path d="M18.8 18H30V22.5M25.5 18V21.5" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaLogoutDoorIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="7" y="6.8" width="13" height="23" rx="2.8" fill={tone === 'dark' ? '#FDA4AF' : '#FDA4AF'} fillOpacity={tone === 'dark' ? 0.35 : 0.7} />
      <path d="M16.5 6H9C7.4 6 6.2 7.2 6.2 8.8V27.2C6.2 28.8 7.4 30 9 30H16.5" stroke={ink} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M14.5 18H29.5M24.5 13L29.5 18L24.5 23" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaCheckBadgeIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <circle cx="19" cy="18.8" r="12" fill="#4ADE80" fillOpacity={tone === 'dark' ? 0.85 : 0.9} />
      <circle cx="17.8" cy="17.8" r="11.5" stroke={ink} strokeWidth="2" />
      <path d="M12.5 18L16.2 21.8L23.5 14" stroke={tone === 'dark' ? '#FFFFFF' : ink} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaClockStatusIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <circle cx="19" cy="18.8" r="12" fill="#FDE047" fillOpacity={tone === 'dark' ? 0.35 : 0.95} />
      <circle cx="17.8" cy="17.8" r="11.5" stroke={ink} strokeWidth="2" />
      <path d="M17.8 11.8V18L22.2 20.5" stroke={ink} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaHolidayIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="6.5" y="8" width="24.5" height="22" rx="4.5" fill="#C4B5FD" fillOpacity="0.65" />
      <path d="M6.5 12C6.5 9.8 8.3 8 10.5 8H27C29.2 8 31 9.8 31 12V14H6.5V12Z" fill="#FDA4AF" />
      <circle cx="18" cy="21.5" r="4.5" fill="#FDE047" />
      <rect x="5" y="6.8" width="25" height="22" rx="4.5" stroke={ink} strokeWidth="2" />
      <path d="M5.5 13.2H29.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <circle cx="17.5" cy="21" r="4.2" stroke={ink} strokeWidth="2" />
      <path d="M15.5 21H19.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export const SagaEditPencilIcon: React.FC<SagaIconProps> = ({ className = 'w-4 h-4', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M9 23.5L24.5 8C25.7 6.8 27.6 6.8 28.8 8C30 9.2 30 11.1 28.8 12.3L13.3 27.8L7.2 29.5L9 23.5Z" fill="#FDE047" />
      <path d="M8.5 22.8L23.5 7.8C24.7 6.6 26.6 6.6 27.8 7.8C29 9 29 10.9 27.8 12.1L12.8 27.1L6.8 28.8L8.5 22.8Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaAttachmentClipIcon: React.FC<SagaIconProps> = ({ className = 'w-4 h-4', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <circle cx="18" cy="18" r="12" fill="#FEF3C7" fillOpacity={tone === 'dark' ? 0.25 : 1} />
      <path d="M24 13.2L14.5 22.7C13.2 24 11 24 9.7 22.7C8.4 21.4 8.4 19.2 9.7 17.9L20.6 7C22.8 4.8 26.4 4.8 28.6 7C30.8 9.2 30.8 12.8 28.6 15L17.7 25.9C14.7 28.9 9.8 28.9 6.8 25.9" stroke={ink} strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
};

export const SagaInfoCircleIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <circle cx="19" cy="18.8" r="12" fill="#60A5FA" fillOpacity={tone === 'dark' ? 0.45 : 0.75} />
      <circle cx="17.8" cy="17.8" r="11.5" stroke={ink} strokeWidth="2" />
      <circle cx="17.8" cy="12" r="1.5" fill={ink} />
      <path d="M17.8 16V23.8" stroke={ink} strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
};

/**
 * 3B. IKON DOODLE TAMBAHAN FASE 2B (EKSPRESI MOOD, REFRESH, KEYBOARD, AI, MALAM, COOKIE)
 */
export const SagaMoodFaceIcon: React.FC<
  SagaIconProps & { mood: 'VERY_HAPPY' | 'HAPPY' | 'NEUTRAL' | 'TIRED' | 'STRESSED' }
> = ({ mood, className = 'w-8 h-8', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  const faceColor =
    mood === 'VERY_HAPPY'
      ? '#4ADE80'
      : mood === 'HAPPY'
      ? '#60A5FA'
      : mood === 'NEUTRAL'
      ? '#FDE047'
      : mood === 'TIRED'
      ? '#FB923C'
      : '#FDA4AF';

  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <circle cx="19" cy="19" r="12.5" fill={faceColor} />
      <circle cx="17.8" cy="17.8" r="12" stroke={ink} strokeWidth="2" />
      {mood === 'VERY_HAPPY' && (
        <>
          <path d="M12.5 14.8C13.2 13.6 14.5 13.6 15.2 14.8M20.4 14.8C21.1 13.6 22.4 13.6 23.1 14.8" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          <path d="M12.2 20.2C13.8 23.4 21.8 23.4 23.4 20.2Z" fill="#FEF3C7" stroke={ink} strokeWidth="1.9" strokeLinejoin="round" />
        </>
      )}
      {mood === 'HAPPY' && (
        <>
          <circle cx="13.8" cy="15" r="1.4" fill={ink} />
          <circle cx="21.8" cy="15" r="1.4" fill={ink} />
          <path d="M13 20.2C14.6 22.6 21 22.6 22.6 20.2" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {mood === 'NEUTRAL' && (
        <>
          <circle cx="13.8" cy="15" r="1.4" fill={ink} />
          <circle cx="21.8" cy="15" r="1.4" fill={ink} />
          <path d="M13.5 21.5H22.2" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {mood === 'TIRED' && (
        <>
          <path d="M12.2 15.5H15.2M20.4 15.5H23.4" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          <path d="M13.5 22.8C15.2 20.8 20.4 20.8 22.1 22.8" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {mood === 'STRESSED' && (
        <>
          <path d="M12.2 13.8L15.4 15.8L12.2 17.5M23.4 13.8L20.2 15.8L23.4 17.5" stroke={ink} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12.8 22.8C14.4 20.8 16.1 22.8 17.8 20.8C19.5 22.8 21.2 20.8 22.8 22.8" stroke={ink} strokeWidth="1.9" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
};

export const SagaRefreshSyncIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <circle cx="18.5" cy="18.5" r="10.5" fill="#60A5FA" fillOpacity={tone === 'dark' ? 0.35 : 0.55} />
      <path d="M27.5 14.5C25.9 10.6 22.1 8 17.6 8C11.8 8 7.2 12.6 7.2 18.4" stroke={ink} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M8.5 21.5C10.1 25.4 13.9 28 18.4 28C24.2 28 28.8 23.4 28.8 17.6" stroke={ink} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M28.2 9.5V15H22.8M7.8 26.5V21H13.2" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaKeyboardIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect x="6" y="10.5" width="25" height="16.5" rx="3.5" fill="#FEF3C7" fillOpacity={tone === 'dark' ? 0.3 : 1} />
      <rect x="4.8" y="9.5" width="25.4" height="16.5" rx="3.5" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M9.5 14.2H11.5M14.5 14.2H16.5M19.5 14.2H21.5M24.5 14.2H26.5M12 21.2H23" stroke={ink} strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
};

export const SagaSparkAiIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M18.8 5.5L21.5 14L30 16.7L21.5 19.4L18.8 27.9L16.1 19.4L7.6 16.7L16.1 14L18.8 5.5Z" fill="#FDE047" />
      <path d="M17.5 4.8L20.1 13L28.3 15.6L20.1 18.2L17.5 26.4L14.9 18.2L6.7 15.6L14.9 13L17.5 4.8Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="28" cy="27" r="2.2" fill="#4ADE80" stroke={ink} strokeWidth="1.8" />
    </svg>
  );
};

export const SagaNightMoonIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M23.8 24.5C17.8 24.5 13 19.7 13 13.7C13 10.6 14.3 7.8 16.4 5.9C10.5 6.8 6 11.9 6 18C6 24.7 11.5 30.2 18.2 30.2C23.5 30.2 28 26.8 29.7 22C28 23.6 26 24.5 23.8 24.5Z" fill="#C4B5FD" />
      <path d="M22.8 23.5C17 23.5 12.2 18.7 12.2 12.9C12.2 9.8 13.5 7 15.6 5.1C9.7 6 5.2 11.1 5.2 17.2C5.2 23.9 10.7 29.4 17.4 29.4C22.7 29.4 27.2 26 28.9 21.2C27.2 22.8 25.1 23.5 22.8 23.5Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="26.5" cy="10" r="2" fill="#FDE047" stroke={ink} strokeWidth="1.6" />
    </svg>
  );
};

export const SagaOfflineBoltIcon: React.FC<SagaIconProps> = ({ className = 'w-5 h-5', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M20.5 5.5L9.5 19.5H18L15.5 30.5L26.5 16.5H18L20.5 5.5Z" fill="#FDE047" />
      <path d="M19.5 4.8L8.5 18.8H17L14.5 29.8L25.5 15.8H17L19.5 4.8Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaCookieShieldIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <circle cx="19" cy="18.8" r="12" fill="#FEF3C7" />
      <circle cx="15" cy="14" r="1.8" fill="#FB923C" />
      <circle cx="22.5" cy="16" r="1.6" fill="#FB923C" />
      <circle cx="16.8" cy="22.5" r="2" fill="#FB923C" />
      <path d="M17.8 5.8C24.4 5.8 29.8 11.2 29.8 17.8C29.8 24.4 24.4 29.8 17.8 29.8C11.2 29.8 5.8 24.4 5.8 17.8C5.8 11.2 11.2 5.8 17.8 5.8Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="14.2" cy="13.5" r="1.5" fill={ink} />
      <circle cx="21.5" cy="15.5" r="1.4" fill={ink} />
      <circle cx="16" cy="22" r="1.6" fill={ink} />
    </svg>
  );
};

export const SagaSeedlingCareIcon: React.FC<SagaIconProps> = ({ className = 'w-6 h-6', size, ariaLabel, tone = 'light' }) => {
  const ink = getInkStroke(tone);
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path d="M18 16C18 10.5 22.8 7 28.5 7.5C28.8 13.2 24.2 17.8 18 16Z" fill="#4ADE80" />
      <path d="M18 18.5C18 13.5 13.6 10.5 8.5 11C8.2 16 12.2 20 18 18.5Z" fill="#FDE047" />
      <path d="M17.5 15.5C17.5 10 22.2 6.5 27.8 7C28 12.6 23.5 17 17.5 15.5Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M17.5 18C17.5 13 13.2 10 8.2 10.5C8 15.5 12 19.5 17.5 18Z" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M17.5 15.5V29.5M12 29.5H23" stroke={ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

/**
 * 4. NAVIGASI BAWAH (NONAKTIF: #475569 + ISIAN LEMBUT | AKTIF: #0D5C46/#0F172A + ISIAN PENUH)
 */
export const SagaNavHomeIcon: React.FC<SagaNavIconProps> = ({
  active = false,
  className = 'w-6 h-6',
  size,
  ariaLabel,
}) => {
  const ink = active ? '#0F172A' : '#475569';
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path
        d="M7 16.5L19 7L31 16.5V28.5C31 29.6 30 30.5 28.8 30.5H9.2C8 30.5 7 29.6 7 28.5V16.5Z"
        fill={active ? '#4ADE80' : '#DCFCE7'}
        fillOpacity={active ? 1 : 0.7}
      />
      <rect
        x="14.5"
        y="19.5"
        width="7"
        height="10.5"
        rx="1.8"
        fill={active ? '#FDE047' : '#FEF3C7'}
      />
      <path
        d="M5.5 15.8L17.8 6L30.2 15.8V27.8C30.2 29 29.2 30 28 30H7.8C6.6 30 5.5 29 5.5 27.8V15.8Z"
        stroke={ink}
        strokeWidth={active ? '2.1' : '1.9'}
        strokeLinejoin="round"
      />
      <path
        d="M14.2 30V20.5C14.2 19.6 14.9 18.8 15.8 18.8H19.8C20.7 18.8 21.5 19.6 21.5 20.5V30"
        stroke={ink}
        strokeWidth={active ? '2.1' : '1.9'}
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const SagaNavHistoryIcon: React.FC<SagaNavIconProps> = ({
  active = false,
  className = 'w-6 h-6',
  size,
  ariaLabel,
}) => {
  const ink = active ? '#0F172A' : '#475569';
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <rect
        x="7"
        y="7"
        width="23.5"
        height="23.5"
        rx="5"
        fill={active ? '#FEF3C7' : '#F8FAFC'}
      />
      <rect x="11" y="19" width="3.8" height="8" rx="1.2" fill={active ? '#60A5FA' : '#DBEAFE'} />
      <rect x="16.8" y="14.5" width="3.8" height="12.5" rx="1.2" fill={active ? '#4ADE80' : '#DCFCE7'} />
      <rect x="22.5" y="11" width="3.8" height="16" rx="1.2" fill={active ? '#FB923C' : '#FED7AA'} />
      <rect
        x="5.8"
        y="5.8"
        width="24"
        height="24"
        rx="4.8"
        stroke={ink}
        strokeWidth={active ? '2.1' : '1.9'}
        strokeLinejoin="round"
      />
      <path d="M12.2 26V18.8M18 26V14.2M23.8 26V10.8" stroke={ink} strokeWidth={active ? '2.1' : '1.9'} strokeLinecap="round" />
    </svg>
  );
};

export const SagaNavAdminIcon: React.FC<SagaNavIconProps> = ({
  active = false,
  className = 'w-6 h-6',
  size,
  ariaLabel,
}) => {
  const ink = active ? '#0F172A' : '#475569';
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <path
        d="M6.8 11C6.8 9.2 8.2 7.8 10 7.8H16L18.8 11H28C29.8 11 31.2 12.4 31.2 14.2V26.5C31.2 28.3 29.8 29.8 28 29.8H10C8.2 29.8 6.8 28.3 6.8 26.5V11Z"
        fill={active ? '#FDE047' : '#FEF3C7'}
        fillOpacity={active ? 1 : 0.75}
      />
      <path
        d="M5.5 10C5.5 8.2 6.9 6.8 8.7 6.8H14.8L17.5 10H27C28.8 10 30.2 11.4 30.2 13.2V25.5C30.2 27.3 28.8 28.8 27 28.8H8.7C6.9 28.8 5.5 27.3 5.5 25.5V10Z"
        stroke={ink}
        strokeWidth={active ? '2.1' : '1.9'}
        strokeLinejoin="round"
      />
      <path d="M10.5 17.5H24.5M10.5 22.5H19" stroke={ink} strokeWidth={active ? '2.1' : '1.9'} strokeLinecap="round" />
    </svg>
  );
};

export const SagaNavAccountIcon: React.FC<SagaNavIconProps> = ({
  active = false,
  className = 'w-6 h-6',
  size,
  ariaLabel,
}) => {
  const ink = active ? '#0F172A' : '#475569';
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <circle cx="19" cy="13" r="5.5" fill={active ? '#FDA4AF' : '#FFE4E6'} />
      <path
        d="M8.5 30C8.5 24 13.2 20 19 20C24.8 20 29.5 24 29.5 30H8.5Z"
        fill={active ? '#60A5FA' : '#DBEAFE'}
      />
      <circle cx="18" cy="12.2" r="5" stroke={ink} strokeWidth={active ? '2.1' : '1.9'} />
      <path
        d="M7.5 29.5C7.5 23.6 12.2 19.5 18 19.5C23.8 19.5 28.5 23.6 28.5 29.5"
        stroke={ink}
        strokeWidth={active ? '2.1' : '1.9'}
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * 5. ILUSTRASI MINI STATUS & EMPTY STATE (DOODLE BERWARNA)
 */
export type SagaAttendanceStatusVariant =
  | 'WAITING'
  | 'BEFORE_OPEN'
  | 'CHECKED_IN'
  | 'READY_OUT'
  | 'DONE'
  | 'HOLIDAY';

export const SagaAttendanceStatusIcon: React.FC<
  SagaIconProps & { variant: SagaAttendanceStatusVariant }
> = ({ variant, className = 'w-7 h-7', size, ariaLabel }) => {
  if (variant === 'CHECKED_IN' || variant === 'DONE') {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
        <circle cx="19" cy="18.8" r="12.5" fill="#6EE7B7" />
        <circle cx="17.8" cy="17.8" r="11.8" stroke="#FFFFFF" strokeWidth="2.1" />
        <path d="M12.5 18L16.2 21.8L23.5 14" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (variant === 'READY_OUT') {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
        <circle cx="19" cy="18.8" r="12.5" fill="#FDE047" />
        <circle cx="17.8" cy="17.8" r="11.8" stroke="#FFFFFF" strokeWidth="2.1" />
        <path d="M13 17.8H22.5M18.5 13.8L22.5 17.8L18.5 21.8" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (variant === 'HOLIDAY') {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
        <circle cx="19" cy="18.8" r="12.5" fill="#93C5FD" />
        <circle cx="17.8" cy="17.8" r="11.8" stroke="#FFFFFF" strokeWidth="2.1" />
        <path d="M12.5 17.8H23" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...getSvgAccessibilityProps(ariaLabel)}>
      <circle cx="19" cy="18.8" r="12.5" fill="#FDE047" fillOpacity="0.92" />
      <circle cx="17.8" cy="17.8" r="11.8" stroke="#FFFFFF" strokeWidth="2.1" />
      <path d="M17.8 12V18L22 20.5" stroke="#0F172A" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const SagaEmptyScheduleIllustration: React.FC<SagaIconProps> = ({
  className = 'w-14 h-14',
  size,
  ariaLabel,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...getSvgAccessibilityProps(ariaLabel)}
  >
    <rect x="8" y="12" width="42" height="36" rx="9" fill="#FEF3C7" />
    <path d="M8 20C8 15.6 11.6 12 16 12H42C46.4 12 50 15.6 50 20V22H8V20Z" fill="#60A5FA" />
    <rect x="6" y="10.5" width="42" height="36" rx="9" stroke="#1E293B" strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M6.5 21H47.5M16.5 6.5V13.5M37.5 6.5V13.5" stroke="#1E293B" strokeWidth="2.3" strokeLinecap="round" />
    <path d="M14 29H28M14 36H23" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="40" cy="36.5" r="8" fill="#4ADE80" stroke="#1E293B" strokeWidth="2.2" />
    <path d="M37 36.5L39.2 38.8L43.5 34.2" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SagaEmptyListIllustration: React.FC<SagaIconProps> = ({
  className = 'w-14 h-14',
  size,
  ariaLabel,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 56 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...getSvgAccessibilityProps(ariaLabel)}
  >
    <rect x="12" y="10" width="34" height="38" rx="8" fill="#FEF3C7" />
    <rect x="17" y="17" width="22" height="4" rx="2" fill="#60A5FA" />
    <rect x="10" y="8" width="34" height="38" rx="8" stroke="#1E293B" strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M17 18.5H37M17 26H31M17 33.5H26" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="40" cy="40" r="8.5" fill="#FDE047" stroke="#1E293B" strokeWidth="2.2" />
    <path d="M36.8 40L39.2 42.4L43.5 37.8" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
