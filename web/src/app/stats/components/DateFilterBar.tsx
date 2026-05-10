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
};

export function DateFilterBar({
  inputDateRange,
  setInputDateRange,
  resolution,
  setResolution,
  onApply,
  onClear,
}: Props) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
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
          className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          Lọc
        </button>

        <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>

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
                    ? 'bg-white shadow-sm text-blue-600'
                    : 'text-gray-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

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
    </div>
  );
}