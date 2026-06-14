import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/services/rayfinClient', () => ({
  isLocalBackend: () => true,
  getRayfinClient: vi.fn(),
}));

import {
  addAddress,
  addAddressByCoordinates,
  clearAddresses,
  getAddresses,
  optimizeRoute,
} from '@/services/tsp';

describe('tsp service (in-memory mode)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearAddresses();
  });

  it('saves addresses and outputs optimized route', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: '35.681236', lon: '139.767125' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: '35.689592', lon: '139.700413' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 'Ok',
          waypoints: [{ waypoint_index: 0 }, { waypoint_index: 1 }],
          trips: [
            {
              distance: 8000,
              duration: 1200,
              geometry: {
                coordinates: [
                  [139.767125, 35.681236],
                  [139.700413, 35.689592],
                  [139.767125, 35.681236],
                ],
              },
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await addAddress('Tokyo Station');
    await addAddress('Shibuya Station');

    const addresses = await getAddresses();
    expect(addresses).toHaveLength(2);

    const result = await optimizeRoute();
    expect(result.route.totalDistanceMeters).toBe(8000);
    expect(result.orderedAddresses.map((address) => address.rawAddress)).toEqual([
      'Tokyo Station',
      'Shibuya Station',
    ]);
    const routeRequest = fetchMock.mock.calls[2]?.[0];
    expect(typeof routeRequest).toBe('string');
    expect(routeRequest).toContain('roundtrip=true');
  });

  it('adds an address from clicked map coordinates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        display_name: 'Shinjuku, Tokyo, Japan',
      }),
    }));

    const added = await addAddressByCoordinates(35.6895, 139.6917);
    expect(added.rawAddress).toBe('Shinjuku, Tokyo, Japan');
    expect(added.latitude).toBe(35.6895);
    expect(added.longitude).toBe(139.6917);
  });
});
