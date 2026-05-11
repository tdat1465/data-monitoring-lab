'use client';

type DateRange = {
  start: string;
  end: string;
};

type Props = {
  inputDateRange: DateRange;
  setInputDateRange: (value: DateRange) => void;

  resolution: 'raw' | '30m' | '1h' | '1d';
  setResolution: (value: 'raw' | '30m' | '1h' | '1d') => void;

  onApply: () => void;
  onClear: () => void;

  onToday?: () => void;
  selectedAirport?: string | null;
  onAirportChange?: (airport: string | null) => void;
};

export function DateFilterBar({
  inputDateRange,
  setInputDateRange,
  resolution,
  setResolution,
  onApply,
  onClear,
  onToday,
  selectedAirport,
  onAirportChange,
}: Props) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:border-gray-300 space-y-4">
      {/* ROW 1: Date inputs + buttons */}
      <div className="flex flex-wrap items-center gap-4">
        {/* FROM DATE */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">
            Từ ngày:
          </label>

          <input
            type="date"
            value={inputDateRange.start}
            className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) =>
              setInputDateRange({
                ...inputDateRange,
                start: e.target.value,
              })
            }
          />
        </div>

        {/* TO DATE */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">
            Đến ngày:
          </label>

          <input
            type="date"
            value={inputDateRange.end}
            className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) =>
              setInputDateRange({
                ...inputDateRange,
                end: e.target.value,
              })
            }
          />
        </div>

        {/* APPLY */}
        <button
          onClick={onApply}
          className="px-4 py-1.5 text-sm font-medium text-white bg-[#004adc] rounded-lg hover:bg-[#00308f] transition-colors shadow-sm"
        >
          Lọc
        </button>

        {/* TODAY BUTTON */}
        {onToday && (
          <button
            onClick={onToday}
            className="px-4 py-1.5 text-sm font-medium text-white bg-[#dc9200] rounded-lg hover:bg-[#8f5f00] transition-colors shadow-sm"
          >
            Hôm nay
          </button>
        )}

        {/* CLEAR */}
        {(inputDateRange.start || inputDateRange.end) && (
          <button
            onClick={onClear}
            className="text-sm text-red-600 hover:underline ml-auto"
          >
            Xóa lọc
          </button>
        )}
      </div>

      {/* ROW 2: Airport + Resolution */}
      <div className="flex flex-wrap items-center gap-4">
        {/* AIRPORT */}
        {onAirportChange && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Sân bay:</label>
            <select
              value={selectedAirport ?? ''}
              onChange={(e) => onAirportChange(e.target.value || null)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tất cả sân bay</option>
              <option value="NB">Nội Bài (NB)</option>
              <option value="DN">Đà Nẵng (DN)</option>
              <option value="TSN">Tân Sơn Nhất (TSN)</option>
            </select>
          </div>
        )}

        <div className="h-8 w-px bg-gray-200 hidden md:block"></div>

        {/* RESOLUTION */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">
            Hiển thị:
          </span>

          <div className="flex bg-gray-100 p-1 rounded-lg">
            {[
              { label: 'Gốc', value: 'raw' },
              { label: '1 Giờ', value: '1h' },
              { label: '1 Ngày', value: '1d' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setResolution(opt.value as any)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  resolution === opt.value
                    ? 'bg-white shadow-sm text-[#432c00]'
                    : 'text-gray-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}