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

export function FlightTable({ initialFlights }: FlightTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'scheduled_dt', desc: false }]);
  const [filters, setFilters] = useState({
    source: '',
    direction: '',
    status: '',
    search: '',
  });

  const columns = useMemo<ColumnDef<Flight>[]>(
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
      {
        accessorKey: 'route',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-blue-600"
            onClick={() => column.toggleSorting()}
          >
            Tuyến bay
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => {
          const f = row.original;
          const route = formatFlightRoute(f.source_airport, f.route_airport_std, f.direction);
          return (
            <span className="font-medium text-gray-800">{route}</span>
          );
        },
        sortingFn: (rowA, rowB) => {
          const a = formatFlightRoute(
            rowA.original.source_airport,
            rowA.original.route_airport_std,
            rowA.original.direction
          );
          const b = formatFlightRoute(
            rowB.original.source_airport,
            rowB.original.route_airport_std,
            rowB.original.direction
          );
          return a.localeCompare(b);
        },
      },
      {
        accessorKey: 'scheduled_dt',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-blue-600"
            onClick={() => column.toggleSorting()}
          >
            Giờ khởi hành
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => formatTime(row.original.scheduled_dt),
      },
      {
        accessorKey: 'status_group',
        header: 'Trạng thái',
        cell: ({ row }) => <StatusBadge status={row.original.status_group} />,
      },
      {
        accessorKey: 'predict_delay_minutes',
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-blue-600"
            onClick={() => column.toggleSorting()}
          >
            Dự báo
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <DelayBadge minutes={row.original.predict_delay_minutes} />
        ),
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    return initialFlights.filter((f) => {
      if (filters.source && f.source_airport !== filters.source) return false;
      if (filters.direction && f.direction !== filters.direction) return false;
      if (filters.status && f.status_group !== filters.status) return false;
      if (
        filters.search &&
        !f.flight_number.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [initialFlights, filters]);

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
          onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
          value={filters.direction}
        >
          <option value="">Chiều</option>
          <option value="Arrival">Đến</option>
          <option value="Departure">Đi</option>
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
