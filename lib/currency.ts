/**
 * Mapping pays → devise
 * Base : XAF (devise interne de la plateforme)
 * Tous les prix sont stockés en XAF — ce fichier gère uniquement l'affichage.
 */

export type CurrencyInfo = {
  code: string;
  symbol: string;
  decimals: number; // nb de décimales à afficher
};

export const COUNTRY_CURRENCY: Record<string, CurrencyInfo> = {
  // Afrique Centrale (CEMAC) — même zone XAF
  CM: { code: 'XAF', symbol: 'FCFA', decimals: 0 },
  TD: { code: 'XAF', symbol: 'FCFA', decimals: 0 },
  CF: { code: 'XAF', symbol: 'FCFA', decimals: 0 },
  CG: { code: 'XAF', symbol: 'FCFA', decimals: 0 },
  GA: { code: 'XAF', symbol: 'FCFA', decimals: 0 },
  GQ: { code: 'XAF', symbol: 'FCFA', decimals: 0 },
  // Afrique de l'Ouest (UEMOA) — même zone XOF
  SN: { code: 'XOF', symbol: 'FCFA', decimals: 0 },
  CI: { code: 'XOF', symbol: 'FCFA', decimals: 0 },
  ML: { code: 'XOF', symbol: 'FCFA', decimals: 0 },
  BF: { code: 'XOF', symbol: 'FCFA', decimals: 0 },
  BJ: { code: 'XOF', symbol: 'FCFA', decimals: 0 },
  TG: { code: 'XOF', symbol: 'FCFA', decimals: 0 },
  NE: { code: 'XOF', symbol: 'FCFA', decimals: 0 },
  GW: { code: 'XOF', symbol: 'FCFA', decimals: 0 },
  // Europe
  FR: { code: 'EUR', symbol: '€', decimals: 2 },
  BE: { code: 'EUR', symbol: '€', decimals: 2 },
  DE: { code: 'EUR', symbol: '€', decimals: 2 },
  IT: { code: 'EUR', symbol: '€', decimals: 2 },
  ES: { code: 'EUR', symbol: '€', decimals: 2 },
  NL: { code: 'EUR', symbol: '€', decimals: 2 },
  PT: { code: 'EUR', symbol: '€', decimals: 2 },
  GB: { code: 'GBP', symbol: '£', decimals: 2 },
  CH: { code: 'CHF', symbol: 'CHF', decimals: 2 },
  // Amérique du Nord
  US: { code: 'USD', symbol: '$', decimals: 2 },
  CA: { code: 'CAD', symbol: 'CA$', decimals: 2 },
  // Afrique du Nord & Moyen-Orient
  MA: { code: 'MAD', symbol: 'MAD', decimals: 2 },
  DZ: { code: 'DZD', symbol: 'DZD', decimals: 0 },
  TN: { code: 'TND', symbol: 'TND', decimals: 3 },
  EG: { code: 'EGP', symbol: 'EGP', decimals: 2 },
  // Autres Afrique
  NG: { code: 'NGN', symbol: '₦', decimals: 0 },
  GH: { code: 'GHS', symbol: 'GH₵', decimals: 2 },
  KE: { code: 'KES', symbol: 'KSh', decimals: 0 },
  ZA: { code: 'ZAR', symbol: 'R', decimals: 2 },
  GN: { code: 'GNF', symbol: 'GNF', decimals: 0 },
  // Asie
  CN: { code: 'CNY', symbol: '¥', decimals: 2 },
};

export const DEFAULT_CURRENCY: CurrencyInfo = { code: 'XAF', symbol: 'FCFA', decimals: 0 };

export function getCurrencyForCountry(countryCode: string): CurrencyInfo {
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? DEFAULT_CURRENCY;
}

/**
 * Formate un montant en XAF converti dans la devise cible.
 * Si la devise est XAF ou XOF, pas de conversion (taux ≈ 1).
 */
export function formatConverted(
  amountXaf: number,
  rate: number,
  info: CurrencyInfo,
): string {
  const converted = amountXaf * rate;
  const rounded = info.decimals === 0
    ? Math.round(converted)
    : parseFloat(converted.toFixed(info.decimals));
  const formatted = rounded.toLocaleString('fr-FR', {
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  });
  return `${formatted} ${info.symbol}`;
}
