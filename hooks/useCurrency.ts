/**
 * Hook devise pour l'app chauffeur.
 * Utilise le countryCode du profil chauffeur (stocké en backend).
 * Fallback : 'CM' (XAF) si non renseigné.
 */
import { useState, useEffect, useRef } from 'react';
import { getCurrencyForCountry, formatConverted, DEFAULT_CURRENCY, type CurrencyInfo } from '../lib/currency';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

type CurrencyState = {
  info: CurrencyInfo;
  rate: number;
  countryCode: string;
  ready: boolean;
  format: (amountXaf: number) => string;
  convert: (amountXaf: number) => number;
};

async function fetchRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  try {
    const res = await fetch(`${API_BASE_URL}/payments/exchange-rate?from=${from}&to=${to}`);
    const data = await res.json();
    return typeof data.rate === 'number' && data.rate > 0 ? data.rate : 1;
  } catch {
    return 1;
  }
}

export function useCurrency(driverCountryCode?: string): CurrencyState {
  const countryCode = (driverCountryCode ?? 'CM').toUpperCase();
  const [state, setState] = useState<Omit<CurrencyState, 'format' | 'convert'>>({
    info: DEFAULT_CURRENCY,
    rate: 1,
    countryCode,
    ready: false,
  });
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      const info = getCurrencyForCountry(countryCode);
      const rate = (info.code === 'XAF' || info.code === 'XOF')
        ? 1
        : await fetchRate('XAF', info.code);
      setState({ info, rate, countryCode, ready: true });
    })();
  }, [countryCode]);

  return {
    ...state,
    format: (amountXaf: number) => formatConverted(amountXaf, state.rate, state.info),
    convert: (amountXaf: number) => {
      const converted = amountXaf * state.rate;
      return state.info.decimals === 0
        ? Math.round(converted)
        : parseFloat(converted.toFixed(state.info.decimals));
    },
  };
}
