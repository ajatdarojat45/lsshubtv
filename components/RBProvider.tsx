'use client';

import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import {
  DEFAULT_ACTIVATION_CODE,
  DEFAULT_CHANNEL_ID,
  DEFAULT_CONTINENT,
  DEFAULT_COUNTRY,
  DEFAULT_DEVICE_ID,
  DEFAULT_SITE_TYPE,
  DEFAULT_STREAM_ID,
} from '@/lib/config';
import type { AppConfig } from '@/lib/types';

interface ConfigContextValue {
  cfg: AppConfig;
  setCfg: Dispatch<SetStateAction<AppConfig>>;
}

const ConfigCtx = createContext<ConfigContextValue | null>(null);

export function RBProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<AppConfig>({
    sportType: 0,
    language: 0,
    streamId: DEFAULT_STREAM_ID,
    channelId: DEFAULT_CHANNEL_ID,
    siteType: DEFAULT_SITE_TYPE,
    continent: DEFAULT_CONTINENT,
    country: DEFAULT_COUNTRY,
    deviceId: DEFAULT_DEVICE_ID,
    activationCode: DEFAULT_ACTIVATION_CODE,
  });

  return <ConfigCtx.Provider value={{ cfg, setCfg }}>{children}</ConfigCtx.Provider>;
}

export function useRB(): ConfigContextValue {
  const ctx = useContext(ConfigCtx);
  if (!ctx) throw new Error('useRB must be used within RBProvider');
  return ctx;
}

