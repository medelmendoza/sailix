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
