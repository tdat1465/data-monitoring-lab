'use client';

import { useMemo } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export function CloudCoverChart({ rawWeatherHistory = [],filteredFlights = [], selectedAirport }: any) {
  
    console.log("Dữ liệu Thời tiết thô (rawWeatherHistory):", rawWeatherHistory);
    const chartData = useMemo(() => {
        const counts: Record<string, number> = {};

        const flightStats: Record<string, { total: number, delayed: number }> = {
            'CLR': { total: 0, delayed: 0 },
            'FEW': { total: 0, delayed: 0 },
            'SCT': { total: 0, delayed: 0 },
            'BKN': { total: 0, delayed: 0 },
            'OVC': { total: 0, delayed: 0 },
            'KHÁC': { total: 0, delayed: 0 },
        };

        const reverseAirportMap: Record<string, string> = {
            'NB': 'VVNB',
            'DN': 'VVDN',
            'TSN': 'VVTS',
        };

        const weatherLookup: Record<string, string> = {};

        const filteredWeather = rawWeatherHistory.filter((row: any) => {
            if (!selectedAirport) return true;
            return row.icao_code === reverseAirportMap[selectedAirport];
        });

        filteredWeather.forEach((row: any) => {
            let cover = 'KHÁC';
            const rawStr = String(row.raw_metar || row.cloud_cover || '');
            const matches = rawStr.match(/(FEW|SCT|BKN|OVC|CLR|SKC|CAVOK)/g);

            if (matches?.length) {
                const severity: Record<string, number> = { OVC: 5, BKN: 4, SCT: 3, FEW: 2, CLR: 1, SKC: 1, CAVOK: 1 };
                let maxSeverity = 0;
                let worst = 'CLR';

                matches.forEach((m) => {
                    if (severity[m] > maxSeverity) {
                        maxSeverity = severity[m];
                        worst = m;
                    }
                });

                cover = worst === 'SKC' || worst === 'CAVOK' ? 'CLR' : worst;
            }

            // Đếm số lượng bản tin thời tiết
            counts[cover] = (counts[cover] || 0) + 1;

            // Lưu vào từ điển để chuyến bay đối chiếu
            if (row.icao_code && row.report_time_vn) {
                // Format hour in Vietnam timezone (UTC+7)
                const hour = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    hourCycle: 'h23',
                    hour: '2-digit',
                }).format(new Date(row.report_time_vn));
                const day = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                }).format(new Date(row.report_time_vn));
                weatherLookup[`${row.icao_code}_${day}_${hour}`] = cover;
            }
        });

        // 2. Quét các chuyến bay và đối chiếu với từ điển Thời tiết
        filteredFlights.forEach((f: any) => {
            if (!f.scheduled_dt || !f.source_airport) return;
            if (selectedAirport && f.source_airport !== selectedAirport) return;

            const icao = reverseAirportMap[f.source_airport] || f.source_airport;
            // Format hour in Vietnam timezone (UTC+7)
            const hour = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Ho_Chi_Minh',
                hourCycle: 'h23',
                hour: '2-digit',
            }).format(new Date(f.scheduled_dt));
            const day = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Ho_Chi_Minh',
            }).format(new Date(f.scheduled_dt));

            const flightCover = weatherLookup[`${icao}_${day}_${hour}`];
            
            // Nếu chuyến bay nằm trong giờ có ghi nhận thời tiết
            if (flightCover && flightStats[flightCover]) {
                flightStats[flightCover].total += 1;
                
                // ĐỔI DÒNG NÀY:
                if (Number(f.label_delay ?? 0) === 1) {
                    flightStats[flightCover].delayed += 1;
                }
            }
        });

        const mapName: Record<string, string> = {
            CLR: 'Trời quang',
            FEW: 'Ít mây',
            SCT: 'Mây rải rác',
            BKN: 'Nhiều mây',
            OVC: 'Mây mù che kín',
            KHÁC: 'Không xác định',
        };

        return Object.entries(counts).map(([key, value]) => {
            const stats = flightStats[key];
            const delayRate = stats.total > 0 ? ((stats.delayed / stats.total) * 100).toFixed(1) : '0.0';

            return {
                name: mapName[key] || key,
                value, // Số bản tin thời tiết để vẽ Pie Chart
                totalFlights: stats.total,
                delayedFlights: stats.delayed,
                delayRate: delayRate
            };
        });

    }, [rawWeatherHistory, filteredFlights, selectedAirport]);

  // Bộ màu sắc: Quang mây (Xanh) -> Nhiều mây (Xám đậm)
    const COLORS: Record<string, string> = {
        'Trời quang': '#f2cc8f', // Xanh da trời đậm rực rỡ (Nắng gắt, trong trẻo)
        'Ít mây': '#eab69f',     // Xanh lơ nhạt ngả trắng (Vài gợn mây xốp)
        'Mây rải rác': '#e07a5f',// Xám tro trung tính (Mắt đầu âm u, nửa mây nửa nắng)
        'Nhiều mây': '#3d405b',  // Xám chì đậm (Trời xỉn màu, mây kéo đầy)
        'Mây mù che kín': '#81b29a', // Xám đen thẫm (Trời tối sầm, sương mù dày đặc)
        'Không xác định': '#fbbf24'    // Vàng cam nổi bật (Báo hiệu dữ liệu có vấn đề cần check)
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-3 border border-gray-100 rounded-xl shadow-xl text-sm min-w-[200px]">
                    <p className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-2">{data.name}</p>
                    <div className="space-y-1">
                        <p className="text-gray-500 flex justify-between">
                            Số bản tin (METAR): <span className="font-semibold text-gray-800">{data.value} giờ</span>
                        </p>
                        <p className="text-gray-500 flex justify-between">
                            Số chuyến bay: <span className="font-semibold text-gray-800">{data.totalFlights}</span>
                        </p>
                        <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center">
                            <span className="text-gray-600 font-medium">Tỉ lệ trễ:</span>
                            <span className={`font-bold ${Number(data.delayRate) > 20 ? 'text-red-500' : 'text-amber-500'}`}>
                                {data.delayRate}%
                            </span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
            <h2 className="mb-6 text-xl font-bold text-gray-800">Tỉ lệ Trễ chuyến theo Mây</h2>
            <div className="w-full h-[430px]">
                <ResponsiveContainer width="100%" height={430}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={90} 
                        outerRadius={130}
                        paddingAngle={3} 
                        dataKey="value"
                        label={({ name, payload }) => `${payload.delayRate}%`}
                    >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#000'} />
                    ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}