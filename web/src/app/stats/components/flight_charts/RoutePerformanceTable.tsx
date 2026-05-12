'use client';

import React, { useMemo } from 'react';

export function RoutePerformanceTable({ data }: { data: Array<{ route: string; delayRate: number; flights: number }> }) {
  const tableData = useMemo(() => data, [data]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-gray-800">Các tuyến bay có tỷ lệ trễ cao nhất</h2>
      <div className="overflow-auto max-h-100">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold text-gray-700">Tuyến bay</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-right">Tỷ lệ trễ</th>
              <th className="px-4 py-3 font-semibold text-gray-700 text-right">Tổng số chuyến bay của hãng</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-700">{row.route}</td>
                <td className="px-4 py-3 text-right text-gray-700">{row.delayRate.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right text-gray-700">{row.flights}</td>
              </tr>
            ))}
          </tbody>
        </table>  
      </div>
      <p className="mt-4 text-[11px] text-gray-400 italic">
        Lưu ý: Bảng này hiển thị cả các tuyến bay đi và đến, giúp bạn nhanh chóng nhận diện những tuyến cần chú ý để cải thiện chất lượng dịch vụ.
      </p>
    </div>
  );
}
