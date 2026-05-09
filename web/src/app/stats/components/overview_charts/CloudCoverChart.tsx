'use client';

import { useMemo } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export function CloudCoverChart({ rawWeatherHistory = [] }: any) {
  
    const chartData = useMemo(() => {
        const counts: Record<string, number> = {};

        rawWeatherHistory.forEach((row: any) => {
        let cover = 'KHÁC';
        
        // Lấy dữ liệu từ raw_metar (ưu tiên 1) hoặc cloud_cover (ưu tiên 2)
        const rawStr = String(row.raw_metar || row.cloud_cover || '');

        // Thêm chữ 'g' ở cuối Regex để quét TẤT CẢ các mã mây xuất hiện trong chuỗi
        const matches = rawStr.match(/(FEW|SCT|BKN|OVC|CLR|SKC|CAVOK)/g);
        
        if (matches && matches.length > 0) {
            // Trọng số độ dày của mây (Số càng to mây càng đặc)
            const severity: Record<string, number> = {
            'OVC': 5,   // Mây che kín
            'BKN': 4,   // Nhiều mây
            'SCT': 3,   // Mây rải rác
            'FEW': 2,   // Ít mây
            'CLR': 1,   // Quang
            'SKC': 1,   // Quang
            'CAVOK': 1  // Quang và tầm nhìn tốt
            };

            let maxSeverity = 0;
            let worstCondition = 'CLR';

            // Lặp qua tất cả các mã mây tìm được để lấy cái mây dày nhất
            matches.forEach(m => {
            if (severity[m] > maxSeverity) {
                maxSeverity = severity[m];
                worstCondition = m;
            }
            });

            cover = worstCondition;
            // Gom các mã trời quang về chung một mối
            if (cover === 'SKC' || cover === 'CAVOK') cover = 'CLR';
        }

        counts[cover] = (counts[cover] || 0) + 1;
        });

        const mapName: Record<string, string> = {
        'CLR': 'Trời quang (CLR/CAVOK)',
        'FEW': 'Ít mây (FEW)',
        'SCT': 'Mây rải rác (SCT)',
        'BKN': 'Nhiều mây (BKN)',
        'OVC': 'Mây mù che kín (OVC)',
        'KHÁC': 'Không xác định'
        };

        // Chuyển object thành mảng để vẽ, sắp xếp từ nhiều đến ít
        return Object.keys(counts).map(key => ({
        name: mapName[key] || 'Không xác định',
        value: counts[key],
        })).sort((a, b) => b.value - a.value);
    }, [rawWeatherHistory]);

  // Bộ màu sắc: Quang mây (Xanh) -> Nhiều mây (Xám đậm)
    const COLORS: Record<string, string> = {
        'Trời quang (CLR/CAVOK)': '#00a7f5', // Xanh da trời đậm rực rỡ (Nắng gắt, trong trẻo)
        'Ít mây (FEW)': '#64b0d9',     // Xanh lơ nhạt ngả trắng (Vài gợn mây xốp)
        'Mây rải rác (SCT)': '#aab8d0',// Xám tro trung tính (Mắt đầu âm u, nửa mây nửa nắng)
        'Nhiều mây (BKN)': '#4b5563',  // Xám chì đậm (Trời xỉn màu, mây kéo đầy)
        'Mây mù che kín (OVC)': '#111827', // Xám đen thẫm (Trời tối sầm, sương mù dày đặc)
        'Không xác định': '#fbbf24'    // Vàng cam nổi bật (Báo hiệu dữ liệu có vấn đề cần check)
    };

    return (
        <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
        <h2 className="mb-6 text-xl font-bold text-gray-800">Phân bố Trạng thái Bầu trời</h2>
        <div className="w-full h-[430px]">
            <ResponsiveContainer width="100%" height={430}>
            <PieChart>
                <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={90} // Đây là chìa khóa tạo ra dạng Donut (Nhẫn)
                outerRadius={130}
                paddingAngle={3} // Tạo khe hở giữa các múi cho đẹp
                dataKey="value"
                label={({ name, percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                >
                {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#000'} />
                ))}
                </Pie>
                <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [`${value} bản tin`, 'Số lượng']}
                />
                <Legend verticalAlign="bottom" height={36} />
            </PieChart>
            </ResponsiveContainer>
        </div>
        </div>
    );
}