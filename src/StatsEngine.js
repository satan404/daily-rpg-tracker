import { parse, format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export class StatsEngine {
    // Save a daily summary explicitly
    static saveDailyRecord(tasks) {
        if (!tasks || tasks.length === 0) return;

        const today = new Date();
        const dateStr = format(today, 'yyyy-MM-dd');

        let stats = JSON.parse(localStorage.getItem('dailyRPGStats') || '{}');

        const completed = tasks.filter(t => t.completed && !t.failed).length;
        const total = tasks.length;

        stats[dateStr] = {
            completed,
            total,
            rate: Math.round((completed / total) * 100)
        };

        localStorage.setItem('dailyRPGStats', JSON.stringify(stats));
    }

    static getMonthlyStats() {
        const today = new Date();
        const start = startOfMonth(today);
        const end = endOfMonth(today);

        const daysInterval = eachDayOfInterval({ start, end });
        const stats = JSON.parse(localStorage.getItem('dailyRPGStats') || '{}');

        return daysInterval.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayData = stats[dateStr];
            return {
                date: dateStr,
                dayOfMonth: format(date, 'd'),
                rate: dayData ? dayData.rate : 0,
                hasData: !!dayData
            };
        });
    }
}
