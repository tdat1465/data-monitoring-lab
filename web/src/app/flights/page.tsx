'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plane } from 'lucide-react';
import { FlightTable } from '@/components/flights/FlightTable';
import type { Flight, FlightsApiResponse } from '@/types/flight';

function FlightsContent() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetch(`/api/flights?date=${date}`)
      .then((r) => r.json())
      .then((data: FlightsApiResponse) => {
        setFlights(data.data ?? []);
        setError(null);
      })
      .catch(() => setError('Không thể tải dữ liệu chuyến bay.'))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Plane className="w-8 h-8 text-blue-600" />
          Danh sách chuyến bay
        </h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <FlightTable initialFlights={flights} />
      )}
    </div>
  );
}

export default function FlightsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
      }
    >
      <FlightsContent />
    </Suspense>
  );
}
