/**
 * SMART ABSENSI GURU — SHARED HTML, PRINT ASSET & BRANDING UTILITIES
 * Centralizes XSS escaping, XML entity decoding, blob-safe asset URL resolution,
 * strict SMP/SMA letterhead & stamp segregation, and clean NPP formatting.
 */

import type { EducationLevel } from '../types/exam-schedule.types';
import type { UserProfile } from '../types/database.types';

export interface LevelSchoolBranding {
  level: EducationLevel;
  institutionName: string;
  shortName: string;
  address: string;
  logoPath: string;
  kopImagePath: string | null;
  stampPath: string | null;
  accentColor: string;
  hasOfficialStamp: boolean;
}

const PLACEHOLDER_NPP_VALUES = new Set([
  '-',
  '—',
  '--',
  'null',
  'undefined',
  'n/a',
  'na',
  'penguji ujian lisan',
  'npp. -',
  'npp. penguji ujian lisan',
]);

/**
 * Escapes untrusted dynamic strings before HTML/SVG template interpolation to prevent XSS.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapes text for XML nodes in OOXML spreadsheets.
 */
export function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Decodes XML character entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, numeric refs)
 * when parsing raw OOXML strings (`sharedStrings.xml`, `inlineStr`).
 */
export function decodeXmlEntities(value: string): string {
  if (!value) return '';
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_m, dec: string) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Normalizes and validates NPP/NIP values, returning `null` for empty or placeholder values.
 */
export function sanitizeNpp(rawNpp?: string | null): string | null {
  if (rawNpp === null || rawNpp === undefined) return null;
  let cleaned = String(rawNpp).trim();
  if (!cleaned) return null;

  cleaned = cleaned.replace(/^(?:NPP|NIP)\.?\s*[:-]?\s*/i, '').trim();
  if (!cleaned || PLACEHOLDER_NPP_VALUES.has(cleaned.toLowerCase())) {
    return null;
  }
  return cleaned;
}

/**
 * Looks up an official's real NPP/NIP from an explicit override or loaded teacher directory.
 */
export function resolveSignatoryNpp(
  teachers: UserProfile[] | undefined,
  signatoryName?: string | null,
  explicitNpp?: string | null
): string | null {
  const direct = sanitizeNpp(explicitNpp);
  if (direct) return direct;
  if (!teachers || teachers.length === 0 || !signatoryName) return null;

  const normalizedTarget = signatoryName.trim().toLowerCase();
  if (!normalizedTarget) return null;

  const matched = teachers.find((t) => {
    const tName = (t.full_name || '').trim().toLowerCase();
    return tName === normalizedTarget || (tName.length > 4 && (normalizedTarget.includes(tName) || tName.includes(normalizedTarget)));
  });

  return sanitizeNpp(matched?.nip);
}

/**
 * Builds an HTML line for NPP, or returns an empty string cleanly if no valid NPP exists.
 */
export function formatNppHtmlLine(
  npp?: string | null,
  options?: { className?: string; style?: string; prefix?: string }
): string {
  const clean = sanitizeNpp(npp);
  if (!clean) return '';
  const prefix = options?.prefix ?? 'NPP. ';
  const classAttr = options?.className ? ` class="${escapeHtml(options.className)}"` : '';
  const styleAttr = options?.style ? ` style="${escapeHtml(options.style)}"` : '';
  return `<div${classAttr}${styleAttr}>${escapeHtml(prefix)}${escapeHtml(clean)}</div>`;
}

/**
 * Strictly separates SMP Terpadu Al-Ittihadiyah vs SMA Terpadu As Salaam branding and stamps.
 * Never leaks SMA wet-ink stamp onto SMP documents when no SMP stamp asset exists.
 */
export function getLevelSchoolBranding(
  level: EducationLevel,
  overrideName?: string | null,
  overrideAddress?: string | null
): LevelSchoolBranding {
  const isSma = level === 'SMA';
  const cleanOverrideName = overrideName?.trim() || '';
  const cleanOverrideAddr = overrideAddress?.trim() || '';

  if (isSma) {
    const useOverrideName = cleanOverrideName && /sma|salaam|smatas/i.test(cleanOverrideName);
    return {
      level: 'SMA',
      institutionName: useOverrideName ? cleanOverrideName.toUpperCase() : 'SMA TERPADU AS SALAAM',
      shortName: 'SMA Terpadu As Salaam',
      address: cleanOverrideAddr || 'Bogor - Jawa Barat',
      logoPath: '/logo-sma-terpadu-as-salaam.png',
      kopImagePath: null,
      stampPath: '/stempel-ttd-kepsek-as-salaam.png',
      accentColor: '#065f46',
      hasOfficialStamp: true,
    };
  }

  const useOverrideName = cleanOverrideName && /smp|ittihadiyah/i.test(cleanOverrideName);
  return {
    level: 'SMP',
    institutionName: useOverrideName ? cleanOverrideName.toUpperCase() : 'SMP TERPADU AL-ITTIHADIYAH',
    shortName: 'SMP Terpadu Al-Ittihadiyah',
    address: cleanOverrideAddr || 'Ciampea - Bogor',
    logoPath: '/logo-smp-terpadu-al-ittihadiyah.png',
    kopImagePath: '/kop-surat-al-ittihadiyah.jpg',
    // No SMP stamp image exists in /public; leave wet-signature space clean without broken images.
    stampPath: null,
    accentColor: '#047857',
    hasOfficialStamp: false,
  };
}

/**
 * Resolves relative `/asset.png` URLs so `<img>` elements load cleanly inside
 * `blob:` print tabs, Electron (`file://`), and Capacitor WebView.
 * Keeps relative filenames untouched in Node.js unit test environments.
 */
export function resolvePrintAssetUrl(assetPath: string): string {
  if (!assetPath) return '';
  if (/^(?:data:|blob:|https?:|file:|capacitor:|ionic:)/i.test(assetPath)) {
    return assetPath;
  }
  if (typeof window === 'undefined' || !window.location) {
    return assetPath;
  }

  const normalized = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  const { protocol, origin, href } = window.location;

  if (protocol === 'file:') {
    try {
      return new URL(normalized.replace(/^\/+/, './'), href).href;
    } catch {
      return assetPath;
    }
  }

  if (origin && origin !== 'null' && !origin.startsWith('blob:')) {
    return `${origin}${normalized}`;
  }

  return assetPath;
}

/**
 * Injects `<base href="...">` and resolves root-relative asset URLs inside an HTML document
 * before turning it into a `Blob` URL for a new browser print tab.
 */
export function prepareHtmlForBlobPrint(html: string): string {
  if (typeof window === 'undefined' || !window.location?.href) {
    return html;
  }

  let prepared = html.replace(
    /\bsrc=(["'])\/(?!\/)([^"']+)\1/gi,
    (_m, quote: string, rel: string) => `src=${quote}${resolvePrintAssetUrl(`/${rel}`)}${quote}`
  );

  if (!/<base\s+href=/i.test(prepared) && window.location.origin && window.location.origin !== 'null') {
    const baseHref = window.location.protocol === 'file:'
      ? window.location.href.replace(/[^/\\]+$/, '')
      : `${window.location.origin}/`;
    prepared = prepared.replace(/<head([^>]*)>/i, `<head$1><base href="${escapeHtml(baseHref)}">`);
  }

  return prepared;
}

/**
 * Triggers a safe browser Blob file download and defers `URL.revokeObjectURL` so
 * browsers and mobile WebViews finish reading the stream before cleanup.
 */
export function triggerBlobDownload(blob: Blob, filename: string, revokeDelayMs = 1500): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore cleanup failures
    }
  }, revokeDelayMs);
}

/**
 * Opens an HTML document via Blob URL in a print tab and safely schedules `URL.revokeObjectURL`
 * after the tab finishes loading / printing, or revokes immediately if pop-up was blocked.
 */
export function openHtmlBlobPrintWindow(
  html: string,
  options?: { autoPrint?: boolean; windowFeatures?: string; revokeDelayMs?: number }
): Window | null {
  if (typeof window === 'undefined') return null;
  const preparedHtml = prepareHtmlForBlobPrint(html);
  const blob = new Blob([preparedHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const printWindow = options?.windowFeatures
    ? window.open(url, '_blank', options.windowFeatures)
    : window.open(url, '_blank');

  if (!printWindow) {
    URL.revokeObjectURL(url);
    return null;
  }

  let revoked = false;
  const revokeSafely = () => {
    if (revoked) return;
    revoked = true;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  try {
    printWindow.addEventListener(
      'load',
      () => {
        if (options?.autoPrint !== false) {
          setTimeout(() => {
            try {
              printWindow.focus();
              printWindow.print();
            } catch {
              // ignore print dialog errors on closed windows
            }
          }, 300);
        }
        setTimeout(revokeSafely, 5000);
      },
      { once: true }
    );
    printWindow.addEventListener('afterprint', revokeSafely, { once: true });
  } catch {
    // ignore cross-context listener errors
  }

  // Fallback timer ensures Blob URL never leaks permanently
  setTimeout(revokeSafely, options?.revokeDelayMs ?? 60_000);
  return printWindow;
}
