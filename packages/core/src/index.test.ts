import { describe, expect, it } from 'vitest';
import { chunkId } from './model.js';

describe('chunkId', () => {
  it('is stable and readable', () => {
    expect(chunkId('src/UserService.cs', ['UserService', 'Merge'], 'abc123')).toBe(
      'src/UserService.cs::UserService.Merge::abc123',
    );
  });

  it('handles chunks with no enclosing symbol', () => {
    expect(chunkId('pnpm-lock.yaml', [], 'abc123')).toBe('pnpm-lock.yaml::::abc123');
  });
});
