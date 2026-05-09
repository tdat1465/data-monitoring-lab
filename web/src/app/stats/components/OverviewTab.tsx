import type { Flight } from '@/types/flight';

export function OverviewTab({ flights }: { flights: Flight[] }) {
  return (
    <div className="p-8 bg-blue-50 border border-blue-200 rounded-xl text-center">
      <h2 className="text-2xl font-bold text-blue-700">Tổng quan dữ liệu</h2>
      <p className="mt-2 text-gray-600">
        (Giao diện demo) Hệ thống đang tiếp nhận {flights.length} chuyến bay.
      </p>
      {/* Sau này bạn sẽ copy các Card tóm tắt và biểu đồ vào đây */}
    </div>
  );
}