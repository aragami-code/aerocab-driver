const BASE = 'https://api.mymemory.translated.net/get';

export async function translateText(text: string, userLang: string): Promise<string> {
  const from = userLang === 'fr' ? 'en' : 'fr';
  const to   = userLang === 'fr' ? 'fr' : 'en';
  const url  = `${BASE}?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;

  const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const json = await res.json();

  const translated: string = json?.responseData?.translatedText;
  if (!translated || json?.responseStatus !== 200) throw new Error('Translation failed');
  return translated;
}
