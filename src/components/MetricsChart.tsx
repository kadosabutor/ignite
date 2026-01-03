import { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { HabitEntry } from '../types';
import styles from './MetricsChart.module.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type MetricType = 
  | 'score'
  | 'businessMinutes'
  | 'sleepMinutes'
  | 'exercise'
  | 'paradigm'
  | 'cleanEating'
  | 'satisfaction'
  | 'dopamineContent';

type ViewType = 'monthly' | 'yearly';

interface MetricsChartProps {
  entries: HabitEntry[];
  currentMonth: { year: number; month: number };
}

const METRIC_LABELS: Record<MetricType, string> = {
  score: 'Összes pont',
  businessMinutes: 'Biz perc',
  sleepMinutes: 'Alvás',
  exercise: 'Edzés',
  paradigm: 'Paradigma',
  cleanEating: 'Tiszta étkezés',
  satisfaction: 'Kielégülés',
  dopamineContent: 'Dopamindús tartalom',
};

export function MetricsChart({ entries, currentMonth }: MetricsChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('score');
  const [viewType, setViewType] = useState<ViewType>('monthly');

  // Get metric value from entry
  const getMetricValue = (entry: HabitEntry, metric: MetricType): number => {
    switch (metric) {
      case 'score':
        return entry.score;
      case 'businessMinutes':
        return entry.businessMinutes || 0;
      case 'sleepMinutes':
        return entry.sleepMinutes || 0;
      case 'exercise':
        return entry.exercise ? 1 : 0;
      case 'paradigm':
        return entry.paradigm ? 1 : 0;
      case 'cleanEating':
        return entry.cleanEating ? 1 : 0;
      case 'satisfaction':
        return entry.satisfaction ? 1 : 0;
      case 'dopamineContent':
        return entry.dopamineContent ? 1 : 0;
      default:
        return 0;
    }
  };

  // Prepare data for monthly view
  const monthlyData = useMemo(() => {
    const monthStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`;
    const monthEntries = entries.filter(e => e.date.startsWith(monthStr));
    
    const today = new Date();
    const isCurrentMonth = currentMonth.year === today.getFullYear() && currentMonth.month === today.getMonth();
    // Show all days up to today (or end of month if past month)
    const lastDay = isCurrentMonth ? today.getDate() : new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
    
    const labels: string[] = [];
    const values: (number | null)[] = [];
    
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
      const entry = monthEntries.find(e => e.date === dateStr);
      
      labels.push(String(day));
      
      if (entry) {
        let value = getMetricValue(entry, selectedMetric);
        
        // Convert sleep minutes to hours in monthly view
        if (selectedMetric === 'sleepMinutes') {
          value = value / 60;
        }
        
        values.push(value);
      } else {
        // Use null for days without entries - they'll be visible on X-axis but no point on line
        values.push(null);
      }
    }
    
    return { labels, values };
  }, [entries, currentMonth, selectedMetric]);

  // Prepare data for yearly view
  const yearlyData = useMemo(() => {
    const year = currentMonth.year;
    const today = new Date();
    const isCurrentYear = year === today.getFullYear();
    const currentMonthIndex = today.getMonth();
    
    const labels: string[] = [];
    const values: number[] = [];
    
    for (let month = 0; month < 12; month++) {
      // Skip future months in current year
      if (isCurrentYear && month > currentMonthIndex) {
        break;
      }
      
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthEntries = entries.filter(e => e.date.startsWith(monthStr));
      
      // Only include months that have entries
      if (monthEntries.length === 0) {
        continue;
      }
      
      // Aggregate based on metric type
      let aggregatedValue = 0;
      
      if (selectedMetric === 'score') {
        // Average daily points for the month
        const total = monthEntries.reduce((sum, e) => sum + getMetricValue(e, selectedMetric), 0);
        aggregatedValue = total / monthEntries.length;
      } else if (selectedMetric === 'sleepMinutes') {
        // Average sleep minutes converted to hours
        const totalMinutes = monthEntries.reduce((sum, e) => sum + getMetricValue(e, selectedMetric), 0);
        aggregatedValue = totalMinutes / monthEntries.length / 60; // Convert to hours
      } else if (selectedMetric === 'exercise' || selectedMetric === 'paradigm' || 
                 selectedMetric === 'cleanEating' || selectedMetric === 'satisfaction' ||
                 selectedMetric === 'dopamineContent') {
        // Count occurrences (boolean metrics) - how many days in the month
        aggregatedValue = monthEntries.reduce((sum, e) => sum + getMetricValue(e, selectedMetric), 0);
      } else {
        // Sum for other numeric metrics (businessMinutes)
        aggregatedValue = monthEntries.reduce((sum, e) => sum + getMetricValue(e, selectedMetric), 0);
      }
      
      const monthName = new Date(year, month).toLocaleDateString('hu-HU', { month: 'short' });
      labels.push(monthName);
      values.push(aggregatedValue);
    }
    
    return { labels, values };
  }, [entries, currentMonth.year, selectedMetric]);

  const chartData = viewType === 'monthly' ? monthlyData : yearlyData;

  // Format tooltip value based on metric and view
  const formatTooltipValue = (value: number): string => {
    if (selectedMetric === 'sleepMinutes') {
      return `${value.toFixed(1)} óra`;
    } else if (selectedMetric === 'score' && viewType === 'yearly') {
      return `${value.toFixed(1)} pont`;
    }
    return value.toFixed(1);
  };

  const data = {
    labels: chartData.labels,
    datasets: [
      {
        label: METRIC_LABELS[selectedMetric],
        data: chartData.values,
        borderColor: '#ff7033',
        backgroundColor: 'rgba(255, 112, 51, 0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: chartData.values.length > 0 ? 5 : 0,
        pointHoverRadius: 8,
        pointBackgroundColor: '#ff7033',
        pointBorderColor: '#121212',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: '#e65a1f',
        pointHoverBorderColor: '#ff7033',
        pointHoverBorderWidth: 3,
        spanGaps: false, // Don't draw line through null values
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'var(--color-surface)',
        titleColor: '#ff7033',
        bodyColor: '#ff7033',
        borderColor: '#ff7033',
        borderWidth: 1,
        padding: 14,
        displayColors: false,
        titleFont: {
          size: 12,
          weight: '600',
        },
        bodyFont: {
          size: 14,
          weight: '700',
        },
        cornerRadius: 8,
        callbacks: {
          title: (context: any) => {
            if (viewType === 'monthly') {
              return `${context[0].label}. nap`;
            } else {
              return context[0].label;
            }
          },
          label: (context: any) => {
            const value = context.parsed.y;
            if (value === null || value === undefined) {
              return '';
            }
            return `${METRIC_LABELS[selectedMetric]}: ${formatTooltipValue(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#ff7033',
          font: {
            size: 11,
            weight: '600',
          },
          padding: 8,
        },
      },
      y: {
        grid: {
          color: '#9BA1A6',
          drawBorder: false,
        },
        ticks: {
          color: '#ff7033',
          font: {
            size: 11,
            weight: '600',
          },
          padding: 12,
        },
        beginAtZero: true,
      },
    },
  };

  const hasData = chartData.labels.length > 0 && chartData.values.some(v => v !== null && v !== undefined && v > 0);

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <select
          className={styles.select}
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
        >
          {Object.entries(METRIC_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        
        <div className={styles.viewToggle}>
          <button
            className={`${styles.toggleButton} ${viewType === 'monthly' ? styles.active : ''}`}
            onClick={() => setViewType('monthly')}
          >
            Havi
          </button>
          <button
            className={`${styles.toggleButton} ${viewType === 'yearly' ? styles.active : ''}`}
            onClick={() => setViewType('yearly')}
          >
            Éves
          </button>
        </div>
      </div>
      
      <div className={styles.chartContainer}>
        {hasData ? (
          <Line data={data} options={options} />
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📊</span>
            <p className={styles.emptyText}>Nincs adat a megjelenítéshez</p>
            <p className={styles.emptyHint}>
              {viewType === 'monthly' 
                ? 'Rögzíts adatokat a havi nézethez' 
                : 'Rögzíts adatokat az éves nézethez'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

