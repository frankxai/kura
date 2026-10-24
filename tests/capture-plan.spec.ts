import { test, expect } from '@playwright/test';
import { sanitizeMediaFilename } from '../src/core/capture-plan';

test.describe('sanitizeMediaFilename', () => {
  test('strips OS-reserved chars, collapses spaces and dots', () => {
    expect(sanitizeMediaFilename('hello <world>.png')).toBe('hello_world.png');
    expect(sanitizeMediaFilename('  lots   of   spaces  .jpg  ')).toBe('_lots_of_spaces_.jpg_');
    expect(sanitizeMediaFilename('file:with/invalid\\\\chars?*|".txt')).toBe('filewithinvalidchars.txt');
    expect(sanitizeMediaFilename('...dots.and.spaces...  ')).toBe('...dots.and.spaces..._');
    expect(sanitizeMediaFilename('a'.repeat(150))).toBe('a'.repeat(100)); // test slicing to 100 chars
  });
});
