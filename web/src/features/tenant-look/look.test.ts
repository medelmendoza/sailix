import { afterEach, describe, expect, it } from 'vitest';
import { applyLook, cacheLook, cachedLook, mix, palette } from './look';

const look = {
  slug: 'aaa',
  name: 'Southfield Agencies',
  tagline: 'Sailing since 1990',
  logo_url: null,
  favicon_url: 'http://x/favicon.png',
  primary_color: '#355DAD',
  secondary_color: '#1F6B4A',
  version: 3,
};

describe('organization look', () => {
  afterEach(() => {
    localStorage.clear();
    applyLook(null);
  });

  it('mixes colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#355dad', '#000000', 0)).toBe('#355dad');
    expect(mix('#355dad', '#000000', 1)).toBe('#000000');
  });

  it('derives the portal colours from the primary, using the secondary as the accent', () => {
    const p = palette(look);
    expect(p['--color-brand-700']).toBe('#355DAD');
    expect(p['--color-accent-600']).toBe('#355DAD');
    expect(p['--color-accent-500']).toBe('#1F6B4A');
    expect(p['--color-brand-800']).not.toBe(p['--color-brand-700']); // darker shades come from the primary
    expect(p['--color-accent-100']).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('with no colours it changes nothing, and never trusts a value that is not a colour', () => {
    expect(palette({ primary_color: null, secondary_color: null })).toEqual({});
    expect(
      palette({ primary_color: 'url(javascript:alert(1))', secondary_color: 'red; background: x' }),
    ).toEqual({});
    expect(palette({ primary_color: null, secondary_color: '#1F6B4A' })).toEqual({
      '--color-accent-500': '#1F6B4A',
    });
  });

  it('takes accent, page and text colours and a font style, and ignores anything that is not safe', () => {
    const p = palette({
      ...look,
      accent_color: '#0B6E99',
      background_color: '#FFFFFF',
      text_color: '#0F172A',
      font_preset: 'serif',
    });
    expect(p['--color-accent-600']).toBe('#0B6E99'); // the accent wins over the primary for links and focus rings
    expect(p['--color-page']).toBe('#FFFFFF');
    expect(p['--color-ink']).toBe('#0F172A');
    expect(p['--font-sans']).toContain('serif');

    const bad = palette({
      accent_color: 'red',
      background_color: 'url(x)',
      text_color: '#12',
      font_preset: 'x; background: url(y)' as never, // not a known preset
    });
    expect(bad).toEqual({});
    expect(palette({ font_preset: 'default' })).toEqual({}); // the default font is the portal's own
  });

  it('puts the colours, title and icon on the page and takes them off again', () => {
    applyLook(look);
    expect(document.documentElement.style.getPropertyValue('--color-brand-700')).toBe('#355DAD');
    expect(document.title).toBe('Southfield Agencies · Sailix Portal');
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href).toBe(
      'http://x/favicon.png',
    );

    applyLook(null);
    expect(document.documentElement.style.getPropertyValue('--color-brand-700')).toBe('');
    expect(document.title).toBe('Sailix Portal');
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.getAttribute('href')).toBe(
      '/favicon.png',
    ); // the Sailix sail is back
  });

  it('an organization without a favicon of its own shows the Sailix sail in the tab', () => {
    applyLook({ ...look, favicon_url: null });
    expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.getAttribute('href')).toBe(
      '/favicon.png',
    );
  });

  it('remembers the last look per address only to avoid a flash', () => {
    expect(cachedLook('aaa')).toBeNull();
    cacheLook('aaa', look);
    expect(cachedLook('aaa')?.name).toBe('Southfield Agencies');
    expect(cachedLook('bbb')).toBeNull();
    cacheLook('aaa', null);
    expect(cachedLook('aaa')).toBeNull();
  });

  it('ignores a damaged cache entry', () => {
    localStorage.setItem(`sailix.look:${window.location.hostname}:aaa`, '{not json');
    expect(cachedLook('aaa')).toBeNull();
    localStorage.setItem(`sailix.look:${window.location.hostname}:aaa`, '{"name":5}');
    expect(cachedLook('aaa')).toBeNull();
  });
});
