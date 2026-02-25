/**
 * Tests for the wing detection module
 */

import { classifyVertices, analyzeFootprint } from './wing-detection';
import { CornerType } from './types';
import { BAR_POLYGON, L_POLYGON, U_POLYGON, H_POLYGON } from '../../test/fixtures/polygons';

describe('classifyVertices', () => {
  test('rectangle: all vertices are CONVEX', () => {
    const vertices = classifyVertices(BAR_POLYGON);
    expect(vertices.length).toBe(4);
    expect(vertices.every(v => v.cornerType === CornerType.CONVEX)).toBe(true);
  });

  test('L-shape: 5 CONVEX, 1 CONCAVE', () => {
    const vertices = classifyVertices(L_POLYGON);
    expect(vertices.length).toBe(6);
    const concave = vertices.filter(v => v.cornerType === CornerType.CONCAVE);
    const convex = vertices.filter(v => v.cornerType === CornerType.CONVEX);
    expect(concave.length).toBe(1);
    expect(convex.length).toBe(5);
  });

  test('L-shape: concave vertex is at the inner corner (20,20)', () => {
    const vertices = classifyVertices(L_POLYGON);
    const concave = vertices.find(v => v.cornerType === CornerType.CONCAVE);
    expect(concave).toBeDefined();
    expect(concave!.x).toBeCloseTo(20, 1);
    expect(concave!.y).toBeCloseTo(20, 1);
  });

  test('U-shape: 6 CONVEX, 2 CONCAVE', () => {
    const vertices = classifyVertices(U_POLYGON);
    const concave = vertices.filter(v => v.cornerType === CornerType.CONCAVE);
    const convex = vertices.filter(v => v.cornerType === CornerType.CONVEX);
    expect(concave.length).toBe(2);
    expect(convex.length).toBe(6);
  });

  test('H-shape: 8 CONVEX, 4 CONCAVE', () => {
    const vertices = classifyVertices(H_POLYGON);
    const concave = vertices.filter(v => v.cornerType === CornerType.CONCAVE);
    const convex = vertices.filter(v => v.cornerType === CornerType.CONVEX);
    expect(concave.length).toBe(4);
    expect(convex.length).toBe(8);
  });
});

describe('analyzeFootprint', () => {
  describe('bar building (rectangle)', () => {
    let result: ReturnType<typeof analyzeFootprint>;
    beforeAll(() => { result = analyzeFootprint(BAR_POLYGON); });

    test('isSimpleBar is true', () => {
      expect(result.isSimpleBar).toBe(true);
    });

    test('shape is "bar"', () => {
      expect(result.shape).toBe('bar');
    });

    test('has exactly 1 wing', () => {
      expect(result.wings.length).toBe(1);
    });

    test('no intersections', () => {
      expect(result.intersections.length).toBe(0);
    });

    test('wing has correct length (60m)', () => {
      expect(result.wings[0].length).toBeCloseTo(60, 0);
    });

    test('net length equals full length for bar', () => {
      const netLen = result.netWingLengths.get(0);
      expect(netLen).toBeCloseTo(60, 0);
    });
  });

  describe('L-shaped building', () => {
    let result: ReturnType<typeof analyzeFootprint>;
    beforeAll(() => { result = analyzeFootprint(L_POLYGON); });

    test('isSimpleBar is false', () => {
      expect(result.isSimpleBar).toBe(false);
    });

    test('shape is "L"', () => {
      expect(result.shape).toBe('L');
    });

    test('has exactly 2 wings', () => {
      expect(result.wings.length).toBe(2);
    });

    test('has 1 inner intersection', () => {
      const inner = result.intersections.filter(i => i.type === 'inner');
      expect(inner.length).toBe(1);
    });

    test('inner intersection is at the concave vertex (20,20)', () => {
      const inner = result.intersections.find(i => i.type === 'inner');
      expect(inner).toBeDefined();
      expect(inner!.point.x).toBeCloseTo(20, 1);
      expect(inner!.point.y).toBeCloseTo(20, 1);
    });

    test('inner intersection has innerZone defined', () => {
      const inner = result.intersections.find(i => i.type === 'inner');
      expect(inner?.innerZone).toBeDefined();
      expect(inner?.innerZone?.area).toBeGreaterThan(0);
    });

    test('has host and guest roles', () => {
      const hosts = result.wingRoles.filter(r => r.role === 'host');
      const guests = result.wingRoles.filter(r => r.role === 'guest');
      expect(hosts.length).toBe(1);
      expect(guests.length).toBe(1);
    });

    test('host wing is the longer wing (Wing 0, horizontal, ~60m)', () => {
      const hostRole = result.wingRoles.find(r => r.role === 'host');
      expect(hostRole).toBeDefined();
      const hostWing = result.wings.find(w => w.id === hostRole!.wingId);
      expect(hostWing!.length).toBeGreaterThan(result.wings.find(w => w.id !== hostRole!.wingId)!.length);
    });

    test('guest wing has reduced net length', () => {
      const guestRole = result.wingRoles.find(r => r.role === 'guest');
      const guestWing = result.wings.find(w => w.id === guestRole!.wingId);
      const netLen = result.netWingLengths.get(guestRole!.wingId);
      expect(netLen).toBeLessThan(guestWing!.length);
    });

    test('net wing lengths sum to less than total polygon perimeter / 2', () => {
      let totalNet = 0;
      for (const [, len] of result.netWingLengths) {
        totalNet += len;
      }
      // L-polygon has ~80m of corridor frontage across both wings, net should be less
      expect(totalNet).toBeLessThan(200);
      expect(totalNet).toBeGreaterThan(50);
    });
  });

  describe('U-shaped building', () => {
    let result: ReturnType<typeof analyzeFootprint>;
    beforeAll(() => { result = analyzeFootprint(U_POLYGON); });

    test('is not a simple bar', () => {
      expect(result.isSimpleBar).toBe(false);
    });

    test('has at least 2 wings', () => {
      expect(result.wings.length).toBeGreaterThanOrEqual(2);
    });

    test('has at least 1 inner intersection', () => {
      const inner = result.intersections.filter(i => i.type === 'inner');
      expect(inner.length).toBeGreaterThanOrEqual(1);
    });

    test('has host and guest roles', () => {
      expect(result.wingRoles.filter(r => r.role === 'host').length).toBeGreaterThanOrEqual(1);
      expect(result.wingRoles.filter(r => r.role === 'guest').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('H-shaped building', () => {
    let result: ReturnType<typeof analyzeFootprint>;
    beforeAll(() => { result = analyzeFootprint(H_POLYGON); });

    test('has 4 concave vertices', () => {
      const vertices = classifyVertices(H_POLYGON);
      expect(vertices.filter(v => v.cornerType === CornerType.CONCAVE).length).toBe(4);
    });

    test('is not a simple bar', () => {
      expect(result.isSimpleBar).toBe(false);
    });

    test('has multiple wings', () => {
      expect(result.wings.length).toBeGreaterThanOrEqual(2);
    });
  });
});
