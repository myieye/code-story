import { describe, expect, it } from 'vitest';
import {
  AUTO_READ_MIN_VISIBLE,
  type ChunkDwell,
  clearsGate,
  dwellThresholdMs,
  stepDwell,
  totalDwell,
  visibleFraction,
} from './read-tracking-logic.js';

const tick = (over: Partial<Parameters<typeof stepDwell>[1]> = {}) => ({
  eligible: true,
  fitsViewport: true,
  visibleFraction: 1,
  dt: 100,
  velocitySpike: false,
  ...over,
});

describe('dwellThresholdMs', () => {
  it('clamps 300ms/line between 1500 and 8000', () => {
    expect(dwellThresholdMs(1)).toBe(1500); // 300 → floored
    expect(dwellThresholdMs(5)).toBe(1500); // 1500 exactly
    expect(dwellThresholdMs(10)).toBe(3000); // in range
    expect(dwellThresholdMs(100)).toBe(8000); // 30000 → capped
    expect(dwellThresholdMs(0)).toBe(1500);
  });
});

describe('visibleFraction', () => {
  it('is 1 when fully inside, partial when clipped, 0 when off-screen', () => {
    expect(visibleFraction(100, 200, 0, 500)).toBe(1);
    expect(visibleFraction(0, 200, 100, 500)).toBeCloseTo(0.5); // top half above viewport
    expect(visibleFraction(600, 700, 0, 500)).toBe(0);
    expect(visibleFraction(100, 100, 0, 500)).toBe(0); // zero-height row
  });
});

describe('stepDwell gate', () => {
  it('accrues only while eligible, fits, and ≥60% visible', () => {
    let s: ChunkDwell | undefined;
    s = stepDwell(s, tick({ visibleFraction: AUTO_READ_MIN_VISIBLE - 0.01 }));
    expect(totalDwell(s)).toBe(0); // under the visibility floor
    s = stepDwell(s, tick({ eligible: false }));
    expect(totalDwell(s)).toBe(0); // stub / collapsed
    s = stepDwell(s, tick({ visibleFraction: 0.6, dt: 100 }));
    expect(totalDwell(s)).toBe(100);
  });

  it('never accrues for a chunk taller than the viewport', () => {
    let s: ChunkDwell | undefined;
    for (let i = 0; i < 100; i++) s = stepDwell(s, tick({ fitsViewport: false, dt: 500 }));
    expect(totalDwell(s)).toBe(0);
  });

  it('clears the gate after enough accumulated dwell', () => {
    let s: ChunkDwell | undefined;
    const lines = 10; // threshold 3000ms
    for (let i = 0; i < 29; i++) s = stepDwell(s, tick({ dt: 100 }));
    expect(clearsGate(s, lines)).toBe(false); // 2900ms
    s = stepDwell(s, tick({ dt: 100 }));
    expect(clearsGate(s, lines)).toBe(true); // 3000ms
  });
});

describe('velocity reset', () => {
  it('voids the current run but keeps banked time from a prior visit', () => {
    let s: ChunkDwell | undefined;
    // Visit 1: accrue 800ms, then leave (commit to banked).
    for (let i = 0; i < 8; i++) s = stepDwell(s, tick({ dt: 100 }));
    s = stepDwell(s, tick({ visibleFraction: 0 })); // leave → commit
    expect(s!.banked).toBe(800);
    // Visit 2: accrue 500ms, then a fling voids only the in-progress run.
    for (let i = 0; i < 5; i++) s = stepDwell(s, tick({ dt: 100 }));
    expect(totalDwell(s)).toBe(1300);
    s = stepDwell(s, tick({ velocitySpike: true }));
    expect(s!.current).toBe(0);
    expect(totalDwell(s)).toBe(800); // banked survives the fling
  });
});

describe('accumulation across visits and height changes', () => {
  it('sums dwell across separate visits', () => {
    let s: ChunkDwell | undefined;
    for (let i = 0; i < 6; i++) s = stepDwell(s, tick({ dt: 100 })); // 600ms
    s = stepDwell(s, tick({ visibleFraction: 0 })); // leave
    for (let i = 0; i < 6; i++) s = stepDwell(s, tick({ dt: 100 })); // +600ms
    expect(totalDwell(s)).toBe(1200);
  });

  it('a re-measure (height change) does not reset accumulation', () => {
    let s: ChunkDwell | undefined;
    for (let i = 0; i < 10; i++) s = stepDwell(s, tick({ dt: 100 })); // 1000ms banked-in-progress
    // Narration lands: the row grows but still fits and stays ≥60% visible — accrual continues.
    for (let i = 0; i < 10; i++) s = stepDwell(s, tick({ dt: 100, visibleFraction: 0.9 }));
    expect(totalDwell(s)).toBe(2000);
    // It briefly grows past the viewport (commits the run) then fits again — banked is intact.
    s = stepDwell(s, tick({ fitsViewport: false }));
    expect(s!.banked).toBe(2000);
    s = stepDwell(s, tick({ dt: 100 }));
    expect(totalDwell(s)).toBe(2100);
  });
});
