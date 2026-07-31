import React from 'react';
import { isFeatureEnabled } from '../../config/feature-flags.config';
import type { FeatureFlags } from '../../config/feature-flags.config';

export interface FeatureGateProps {
  flag: keyof FeatureFlags;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  flag,
  children,
  fallback = null,
}) => {
  const enabled = isFeatureEnabled(flag);
  if (!enabled) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};
