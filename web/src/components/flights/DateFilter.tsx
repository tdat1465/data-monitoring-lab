'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

export function DateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return searchParams.get('date') ?? new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    const currentParam = searchParams.get('date');
    if (currentParam !== selectedDate) {
      const params = new URLSearchParams(searchParams.toString());
      if (selectedDate === new Date().toISOString().split('T')[0]) {
        params.delete('date');
      } else {
        params.set('date', selectedDate);
      }
      router.push(`/?${params.toString()}`);
    }
  }, [selectedDate, searchParams, router]);

  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-500" />
      <input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {!isToday && (
        <button
          onClick={() => setSelectedDate(today)}
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
        >
          Hôm nay
        </button>
      )}
    </div>
  );
}
