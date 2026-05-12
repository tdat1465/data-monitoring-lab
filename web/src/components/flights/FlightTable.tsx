'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { Flight } from '@/types/flight';
import { formatTime } from '@/lib/utils/formatTime';
import { formatFlightRoute } from '@/lib/utils/formatRoute';
import { StatusBadge, DelayBadge } from '@/components/ui/Badge';

interface FlightTableProps {
  initialFlights: Flight[];
}

// Grouped flight with both arrival and departure info
export interface GroupedFlight {
  flight_key: string;
  flight_number: string;
  source_airport: string;

  // Departure info (chiều đi)
  departure_route: string;
  departure_time: string;
  departure_status: string;
  departure_delay: number | null;

  // Arrival info (chiều đến)
  arrival_route: string;
  arrival_time: string;
  arrival_status: string;
  arrival_delay: number | null;
}

// Helper to group flights by flight_number + source_airport
function groupFlightsByFlightNumber(flights: Flight[]): GroupedFlight[] {
  const map = new Map<string, GroupedFlight>();

  for (const f of flights) {
    const key = `${f.flight_number}-${f.source_airport}`;

    if (!map.has(key)) {
      map.set(key, {
        flight_key: f.flight_key,
        flight_number: f.flight_number,
        source_airport: f.source_airport,
        departure_route: '',
        departure_time: '',
        departure_status: 'unknown',
        departure_delay: null,
        arrival_route: '',
        arrival_time: '',
        arrival_status: 'unknown',
        arrival_delay: null,
      });
    }

    const grouped = map.get(key)!;

    if (f.direction === 'Departure') {
      grouped.departure_route = formatFlightRoute(f.source_airport, f.route_airport_std, f.direction);
      grouped.departure_time = formatTime(f.scheduled_dt);
      grouped.departure_status = f.status_group;
      grouped.departure_delay = f.predict_delay_minutes;
    } else {
      grouped.arrival_route = formatFlightRoute(f.source_airport, f.route_airport_std, f.direction);
      grouped.arrival_time = formatTime(f.scheduled_dt);
      grouped.arrival_status = f.status_group;
      grouped.arrival_delay = f.predict_delay_minutes;
    }
  }

  return Array.from(map.values());
}

export function FlightTable({ initialFlights }: FlightTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'flight_number', desc: false }]);
  const [filters, setFilters] = useState({
    source: '',
    direction: '',
    status: '',
    search: '',
  });

  // Group flights
  const groupedFlights = useMemo(
    () => groupFlightsByFlightNumber(initialFlights),
    [initialFlights]
  );

  const columns = useMemo<ColumnDef<GroupedFlight>[]>(
    () => [
      {
        accessorKey: 'flight_number',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 font-semibold hover:text-blue-600"
            onClick={() => column.toggleSorting()}
          >
            Mã CB
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono font-bold text-blue-600">
            {row.original.flight_number}
          </span>
        ),
      },
      // Departure columns
      {
        accessorKey: 'departure_route',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-blue-600"
            onClick={() => column.toggleSorting()}
          >
            Tuyến đi
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-medium text-gray-800">
            {row.original.departure_route || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'departure_time',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-blue-600"
            onClick={() => column.toggleSorting()}
          >
            Giờ đi
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.departure_time || '—'}</span>
        ),
      },
      {
        accessorKey: 'departure_delay',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-blue-600"
            onClick={() => column.toggleSorting()}
          >
            Dự báo đi
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <DelayBadge minutes={row.original.departure_delay} />
        ),
      },
      // Arrival columns
      {
        accessorKey: 'arrival_route',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-blue-600"
            onClick={() => column.toggleSorting()}
          >
            Tuyến đến
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-medium text-gray-800">
            {row.original.arrival_route || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'arrival_time',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-blue-600"
            onClick={() => column.toggleSorting()}
          >
            Giờ đến
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.arrival_time || '—'}</span>
        ),
      },
      {
        accessorKey: 'arrival_delay',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-blue-600"
            onClick={() => column.toggleSorting()}
          >
            Dự báo đến
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <DelayBadge minutes={row.original.arrival_delay} />
        ),
      },
    ],
    []
  );

  // Filter: apply only source/search for grouped flights
  const filtered = useMemo(() => {
    return groupedFlights.filter((f) => {
      if (filters.source && f.source_airport !== filters.source) return false;
      if (
        filters.search &&
        !f.flight_number.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;

      // Filter by status: check both departure and arrival
      if (filters.status) {
        const matchStatus =
          f.departure_status === filters.status ||
          f.arrival_status === filters.status;
        if (!matchStatus) return false;
      }

      return true;
    });
  }, [groupedFlights, filters]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            placeholder="Tìm mã chuyến bay..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
          value={filters.source}
        >
          <option value="">Tất cả sân bay</option>
          <option value="NB">Nội Bài</option>
          <option value="DN">Đà Nẵng</option>
          <option value="TSN">Tân Sơn Nhất</option>
        </select>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          value={filters.status}
        >
          <option value="">Trạng thái</option>
          <option value="on_time">Đúng giờ</option>
          <option value="delayed">Trễ</option>
          <option value="unknown">Chưa rõ</option>
          <option value="enroute">Đang bay</option>
          <option value="landed">Đã hạ cánh</option>
          <option value="departed">Đã cất cánh</option>
          <option value="cancelled">Hủy</option>
          <option value="other">Khác</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-gray-600"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} suppressHydrationWarning className="px-4 py-8 text-center text-gray-400">
                  Không có chuyến bay nào phù hợp
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-gray-800">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-gray-500">
          Hiển thị{' '}
          <span suppressHydrationWarning>{table.getRowModel().rows.length}</span> /{' '}
          <span suppressHydrationWarning>{filtered.length}</span> chuyến bay
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            suppressHydrationWarning
            className="p-2 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600" suppressHydrationWarning>
            Trang{' '}
            <span suppressHydrationWarning>
              {table.getState().pagination.pageIndex + 1}
            </span>{' '}
            / <span suppressHydrationWarning>{table.getPageCount()}</span>
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            suppressHydrationWarning
            className="p-2 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
