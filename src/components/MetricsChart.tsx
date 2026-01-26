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
  type ScriptableContext // Fontos a típushoz
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
    const lastDay = isCurrentMonth ? today.getDate() : new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
    
    const labels: string[] = [];
    const values: (number | null)[] = [];
    
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
      const entry = monthEntries.find(e => e.date === dateStr);
      
      labels.push(String(day));
      
      if (entry) {
        let value = getMetricValue(entry, selectedMetric);
        if (selectedMetric === 'sleepMinutes') {
          value = value / 60;
        }
        values.push(value);
      } else {
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
      if (isCurrentYear && month > currentMonthIndex) {
        break;
      }
      
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthEntries = entries.filter(e => e.date.startsWith(monthStr));
      
      if (monthEntries.length === 0) {
        continue;
      }
      
      let aggregatedValue = 0;
      
      if (selectedMetric === 'score') {
        const total = monthEntries.reduce((sum, e) => sum + getMetricValue(e, selectedMetric), 0);
        aggregatedValue = total / monthEntries.length;
      } else if (selectedMetric === 'sleepMinutes') {
        const totalMinutes = monthEntries.reduce((sum, e) => sum + getMetricValue(e, selectedMetric), 0);
        aggregatedValue = totalMinutes / monthEntries.length / 60;
      } else if (selectedMetric === 'exercise' || selectedMetric === 'paradigm' || 
                 selectedMetric === 'cleanEating' || selectedMetric === 'satisfaction' ||
                 selectedMetric === 'dopamineContent') {
        aggregatedValue = monthEntries.reduce((sum, e) => sum + getMetricValue(e, selectedMetric), 0);
      } else {
        aggregatedValue = monthEntries.reduce((sum, e) => sum + getMetricValue(e, selectedMetric), 0);
      }
      
      const monthName = new Date(year, month).toLocaleDateString('hu-HU', { month: 'short' });
      labels.push(monthName);
      values.push(aggregatedValue);
    }
    
    return { labels, values };
  }, [entries, currentMonth.year, selectedMetric]);

  const chartData = viewType === 'monthly' ? monthlyData : yearlyData;

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
        // IGNITE Brand Gradient
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(255, 112, 51, 0.4)');
          gradient.addColorStop(1, 'rgba(255, 112, 51, 0.0)');
          return gradient;
        },
        borderWidth: 4,
        fill: true,
        tension: 0.4,
        pointRadius: chartData.values.length > 0 ? 5 : 0,
        pointBackgroundColor: '#121212', // Fekete belső
        pointBorderColor: '#ff7033',    // Narancs keret
        pointBorderWidth: 3,
        pointHoverRadius: 8,
        pointHoverBackgroundColor: '#ff7033',
        pointHoverBorderColor: '#fff',
        spanGaps: false,
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
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        displayColors: false,
        titleFont: {
          family: "'Montserrat', sans-serif",
          size: 13,
          weight: 'bold' as const,
        },
        bodyFont: {
          family: "'Montserrat', sans-serif",
          size: 14,
          weight: 'bold' as const,
        },
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
          color: '#9BA1A6',
          font: {
            family: "'Montserrat', sans-serif",
            size: 11,
            weight: 'bold' as const,
          },
          padding: 8,
          maxRotation: 0,
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)', // Nagyon halvány rács
          drawBorder: false,
        },
        ticks: {
          color: '#9BA1A6',
          font: {
            family: "'Montserrat', sans-serif",
            size: 11,
            weight: 'bold' as const,
          },
          padding: 12,
        },
        beginAtZero: true,
        border: {
            display: false
        }
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
          // @ts-ignore - ChartJS típuskompatibilitás miatt
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
