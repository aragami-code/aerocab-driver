import { mix, readableText, deriveBrand } from '../lib/brand';

describe('brand derivation (table de parité)', () => {
  it('mix interpole vers blanc/noir', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#C0102E', '#FFFFFF', 0)).toBe('#C0102E');
    expect(mix('#C0102E', '#000000', 1)).toBe('#000000');
  });

  it('readableText : clair → texte foncé, foncé → texte clair', () => {
    expect(readableText('#FFFFFF')).toBe('#1E1E1E');
    expect(readableText('#FDE047')).toBe('#1E1E1E'); // jaune clair
    expect(readableText('#000000')).toBe('#FFFFFF');
    expect(readableText('#1E3A8A')).toBe('#FFFFFF'); // bleu foncé
  });

  it('deriveBrand produit la palette complète', () => {
    const b = deriveBrand('#1E3A8A', '#38BDF8');
    expect(b.primary).toBe('#1E3A8A');
    expect(b.primaryLight).toBe(mix('#1E3A8A', '#FFFFFF', 0.25));
    expect(b.primaryDark).toBe(mix('#1E3A8A', '#000000', 0.25));
    expect(b.onPrimary).toBe('#FFFFFF');
    expect(b.accent).toBe('#38BDF8');
    expect(b.accentLight).toBe(mix('#38BDF8', '#FFFFFF', 0.25));
    expect(b.onAccent).toBe('#1E1E1E');
  });
});
