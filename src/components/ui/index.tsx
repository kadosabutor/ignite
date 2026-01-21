import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, forwardRef, type CSSProperties } from 'react';
import styles from './ui.module.css';

// Segédfüggvény a haptikus visszajelzéshez (Progressive Enhancement)
const triggerHaptic = () => {
  // Csak akkor hívjuk meg, ha a böngésző támogatja (pl. Android Chrome)
  // iOS Safari jelenleg ignorálja, de nem okoz hibát
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(10); // 10ms finom rezgés
  }
};

// ============ BUTTON ============

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: ReactNode;
  haptic?: boolean; // Új prop: kikapcsolható rezgés
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  haptic = true,
  onClick,
  ...props
}: ButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (haptic && !props.disabled) triggerHaptic();
    if (onClick) onClick(e);
  };

  return (
    <button
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${fullWidth ? styles.fullWidth : ''} ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

// ============ CARD ============

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: 'default' | 'interactive' | 'glow';
  style?: CSSProperties; // JAVÍTÁS: style prop hozzáadása
}

export function Card({ children, className = '', onClick, variant = 'default', style }: CardProps) {
  const Component = onClick ? 'button' : 'div';
  
  let variantClass = '';
  if (variant === 'interactive') variantClass = styles.cardInteractive;
  if (variant === 'glow') variantClass = styles.cardGlow;

  const handleClick = () => {
    if (onClick) {
      // Csak akkor rezegjen, ha interaktív
      if (variant === 'interactive' || variant === 'glow') triggerHaptic();
      onClick();
    }
  };

  return (
    <Component
      className={`${styles.card} ${variantClass} ${className}`}
      onClick={onClick ? handleClick : undefined}
      style={style} // JAVÍTÁS: style átadása a DOM elemnek
    >
      {children}
    </Component>
  );
}

// ============ INPUT ============

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className={styles.inputWrapper}>
        {label && <label className={styles.label}>{label}</label>}
        <input
          ref={ref}
          className={`${styles.input} ${error ? styles.inputError : ''} ${className}`}
          {...props}
        />
        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============ TIME INPUT ============

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  onComplete?: () => void;
  firstInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function TimeInput({ value, onChange, label, onComplete, firstInputRef }: TimeInputProps) {
  const [hours, minutes] = value ? value.split(':') : ['', ''];

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    const newValue = `${val}:${minutes || '00'}`;
    onChange(newValue);
    
    // Auto-focus to minutes when 2 digits entered
    if (val.length === 2) {
      const nextInput = e.target.nextElementSibling?.nextElementSibling as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    const newValue = `${hours || '00'}:${val}`;
    onChange(newValue);
    
    // Call onComplete when 2 digits entered
    if (val.length === 2 && onComplete) {
      onComplete();
    }
  };

  return (
    <div className={styles.inputWrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.timeInputContainer}>
        <input
          ref={firstInputRef}
          type="text"
          inputMode="numeric"
          value={hours}
          onChange={handleHoursChange}
          onFocus={handleFocus}
          placeholder="00"
          maxLength={2}
          className={styles.timeInput}
        />
        <span className={styles.timeSeparator}>:</span>
        <input
          type="text"
          inputMode="numeric"
          value={minutes}
          onChange={handleMinutesChange}
          onFocus={handleFocus}
          placeholder="00"
          maxLength={2}
          className={styles.timeInput}
        />
      </div>
    </div>
  );
}

// ============ TOGGLE ============

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  positiveLabel: string;
  negativeLabel: string;
  positiveColor?: 'success' | 'primary' | 'error';
  negativeColor?: 'error' | 'muted' | 'success';
}

export function Toggle({
  value,
  onChange,
  positiveLabel,
  negativeLabel,
  positiveColor = 'success',
  negativeColor = 'error',
}: ToggleProps) {
  const handleChange = (newValue: boolean) => {
    triggerHaptic();
    onChange(newValue);
  };

  return (
    <div className={styles.toggleContainer}>
      <button
        type="button"
        className={`${styles.toggleButton} ${value ? styles[positiveColor] : styles.inactive}`}
        onClick={() => handleChange(true)}
      >
        {positiveLabel}
      </button>
      <button
        type="button"
        className={`${styles.toggleButton} ${!value ? styles[negativeColor] : styles.inactive}`}
        onClick={() => handleChange(false)}
      >
        {negativeLabel}
      </button>
    </div>
  );
}

// ============ STEPPER ============

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function Stepper({ value, onChange, min = 0, max = 99 }: StepperProps) {
  const handleStep = (newValue: number) => {
    triggerHaptic();
    onChange(newValue);
  };

  return (
    <div className={styles.stepperContainer}>
      <button
        type="button"
        className={styles.stepperButton}
        onClick={() => handleStep(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        −
      </button>
      <span className={styles.stepperValue}>{value}</span>
      <button
        type="button"
        className={`${styles.stepperButton} ${styles.stepperButtonPrimary}`}
        onClick={() => handleStep(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}

// ============ PROGRESS RING ============

interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: ReactNode;
}

export function ProgressRing({
  value,
  max,
  size = 120,
  strokeWidth = 8,
  color = 'var(--color-primary)',
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(value / max, 1);
  const offset = circumference - progress * circumference;

  return (
    <div className={styles.progressRing} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className={styles.progressRingBg}
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={styles.progressRingFg}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{ stroke: color }}
        />
      </svg>
      <div className={styles.progressRingContent}>{children}</div>
    </div>
  );
}

// ============ SWITCH ============

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  const handleChange = (newVal: boolean) => {
    triggerHaptic();
    onChange(newVal);
  };

  return (
    <label className={styles.switchContainer}>
      {label && <span className={styles.switchLabel}>{label}</span>}
      <div className={`${styles.switch} ${checked ? styles.switchChecked : ''}`} onClick={() => handleChange(!checked)}>
        <div className={styles.switchThumb} />
      </div>
    </label>
  );
}

// ============ TAB BAR ============

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  const handleTabChange = (id: string) => {
    triggerHaptic();
    onChange(id);
  };

  return (
    <nav className={styles.tabBar}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabActive : ''}`}
          onClick={() => handleTabChange(tab.id)}
        >
          {tab.icon && <span className={styles.tabIcon}>{tab.icon}</span>}
          <span className={styles.tabLabel}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
