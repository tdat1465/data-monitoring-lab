import type { Flight } from '@/types/flight';

export function FlightTab({ flights }: { flights: Flight[] }) {
  return (
    <div className="p-8 bg-green-50 border border-green-200 rounded-xl text-center">
      <h2 className="text-2xl font-bold text-green-700">Chi tiết Chuyến bay</h2>
      <p className="mt-2 text-gray-600">
        Bảng phân bố độ trễ và số liệu chi tiết từng sân bay sẽ nằm ở tab này.
      </p>
      {/* Sau này bạn sẽ copy phần Table vào đây */}
    </div>
  );
}