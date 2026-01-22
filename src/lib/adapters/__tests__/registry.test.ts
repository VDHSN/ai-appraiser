import { describe, it, expect } from 'vitest';
import { getAdapter, listPlatforms } from '../registry';
import { LiveAuctioneersAdapter } from '../liveauctioneers';

describe('getAdapter', () => {
  it('returns LiveAuctioneersAdapter for liveauctioneers', () => {
    const adapter = getAdapter('liveauctioneers');
    expect(adapter).toBeInstanceOf(LiveAuctioneersAdapter);
    expect(adapter.platform).toBe('liveauctioneers');
  });

  it('is case-insensitive', () => {
    const adapter1 = getAdapter('LiveAuctioneers');
    const adapter2 = getAdapter('LIVEAUCTIONEERS');
    expect(adapter1.platform).toBe('liveauctioneers');
    expect(adapter2.platform).toBe('liveauctioneers');
  });

  it('throws for unknown platform', () => {
    expect(() => getAdapter('unknown')).toThrow('Unknown platform: unknown');
  });

  it('includes available platforms in error message', () => {
    expect(() => getAdapter('ebay')).toThrow('Available: liveauctioneers');
  });
});

describe('listPlatforms', () => {
  it('returns array of available platforms', () => {
    const platforms = listPlatforms();
    expect(platforms).toContain('liveauctioneers');
    expect(Array.isArray(platforms)).toBe(true);
  });
});
