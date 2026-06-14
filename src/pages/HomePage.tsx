import { useCallback, useEffect, useState } from 'react';

import { TspMap } from '@/components/TspMap';
import { useAuth } from '@/hooks/AuthContext';
import {
  addAddress,
  addAddressByCoordinates,
  clearAddresses,
  getAddresses,
  optimizeRoute,
  type AddressItem,
  type RoutePlanItem,
} from '@/services/tsp';

export function HomePage() {
  const { signOut, user } = useAuth();
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [addressInput, setAddressInput] = useState('');
  const [latestRoute, setLatestRoute] = useState<RoutePlanItem | null>(null);
  const [orderedAddresses, setOrderedAddresses] = useState<AddressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    const data = await getAddresses();
    setAddresses(data);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await fetchAddresses();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchAddresses]);

  const handleAddAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = addressInput.trim();
    if (!value) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addAddress(value);
      setAddressInput('');
      await fetchAddresses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save address.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleOptimizeRoute = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await optimizeRoute();
      const cycleOrder = result.orderedAddresses[0]
        ? [...result.orderedAddresses, result.orderedAddresses[0]]
        : [];
      setLatestRoute(result.route);
      setOrderedAddresses(cycleOrder);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to optimize route.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleMapClick = async (latitude: number, longitude: number) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addAddressByCoordinates(latitude, longitude);
      await fetchAddresses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save clicked location.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleClearAddresses = async () => {
    setBusy(true);
    setError(null);
    try {
      await clearAddresses();
      setLatestRoute(null);
      setOrderedAddresses([]);
      await fetchAddresses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to clear saved addresses.'
      );
    } finally {
      setBusy(false);
    }
  };

  const totalDistanceKm = latestRoute
    ? (latestRoute.totalDistanceMeters / 1000).toFixed(2)
    : null;
  const totalDurationMin = latestRoute
    ? Math.round(latestRoute.totalDurationSeconds / 60)
    : null;

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">
          Fabric TSP Planner
        </h1>
        <div className="flex items-center gap-4">
          {user?.email && (
            <span className="text-sm text-gray-600" title={user.email}>
              {user.email}
            </span>
          )}
          <button
            onClick={() => void signOut()}
            className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            住所を Fabric に保存
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            住所を追加するとジオコーディングされ、座標付きで保存されます。
          </p>

          <form
            onSubmit={(event) => void handleAddAddress(event)}
            className="mt-4 flex gap-3"
          >
            <input
              type="text"
              value={addressInput}
              onChange={(event) => setAddressInput(event.target.value)}
              placeholder="例: 東京都千代田区丸の内1-9-1"
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={busy || !addressInput.trim()}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-40"
            >
              追加
            </button>
          </form>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void handleOptimizeRoute()}
              disabled={busy || addresses.length < 2}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
            >
              巡回路を計算
            </button>
            <button
              onClick={() => void handleClearAddresses()}
              disabled={busy || addresses.length === 0}
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-40"
            >
              住所を全削除
            </button>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              保存済み住所 ({addresses.length})
            </h3>
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : addresses.length === 0 ? (
              <p className="text-sm text-gray-500">
               まず 2 件以上の住所を追加してください。
              </p>
            ) : (
              <ul className="space-y-2">
               {addresses.map((address, index) => (
                 <li
                   key={address.id}
                   className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                 >
                   <p className="text-sm font-medium text-gray-800">
                     {index + 1}. {address.rawAddress}
                   </p>
                   <p className="text-xs text-gray-500">
                     lat: {address.latitude.toFixed(6)}, lng:{' '}
                     {address.longitude.toFixed(6)}
                   </p>
                 </li>
               ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              マップと巡回路
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              地図クリックで住所を追加できます。青い点が保存済み住所、赤線が計算済みの巡回路です。
            </p>
            <div className="mt-4">
              <TspMap
               addresses={addresses}
               route={latestRoute}
               onMapClick={(latitude, longitude) =>
                 void handleMapClick(latitude, longitude)
               }
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800">巡回路の出力</h3>
            {!latestRoute ? (
              <p className="mt-2 text-sm text-gray-500">
               「巡回路を計算」を押すと、結果がここに表示されます。
              </p>
            ) : (
              <>
               <p className="mt-2 text-sm text-gray-700">
                 距離: <strong>{totalDistanceKm} km</strong> / 所要時間:{' '}
                 <strong>{totalDurationMin} 分</strong>
               </p>
               <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700">
                 {orderedAddresses.map((address) => (
                   <li key={address.id}>{address.rawAddress}</li>
                 ))}
               </ol>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
