import { describe, it, expect } from 'vitest';
import { getElapsedTime } from './Utils';

describe('getElapsedTime', () => {
  it('should format seconds into HH:MM:SS', () => {
    expect(getElapsedTime(3661)).toBe('01:01:01');
    expect(getElapsedTime(60)).toBe('00:01:00');
    expect(getElapsedTime(0)).toBe('00:00:00');
    expect(getElapsedTime(86400)).toBe('24:00:00');
  });
});
