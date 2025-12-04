import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'ZMW'): string {
  return new Intl.NumberFormat('en-ZM', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Safe date formatter that handles all date types gracefully
 */
export function formatDateSafe(value: any): string {
  if (!value) return "N/A";
  
  let date: Date | null = null;
  
  // Handle Date object
  if (value instanceof Date) {
    date = value;
  }
  // Handle Firestore Timestamp
  else if (value?.toDate && typeof value.toDate === 'function') {
    date = value.toDate();
  }
  // Handle timestamp numbers
  else if (typeof value === 'number') {
    date = new Date(value);
  }
  // Handle date strings
  else if (typeof value === 'string') {
    date = new Date(value);
  }
  
  if (!date || isNaN(date.getTime())) {
    return "N/A";
  }
  
  return date.toLocaleDateString("en-US", { 
    year: "numeric", 
    month: "short", 
    day: "numeric" 
  });
}

export function formatDate(date: string | Date | null | undefined | any): string {
  return formatDateSafe(date);
}

export function formatDateTime(date: string | Date | null | undefined | any): string {
  if (!date) return 'N/A';
  
  try {
    // Handle Firestore Timestamp
    if (date?.toDate && typeof date.toDate === 'function') {
      date = date.toDate();
    }
    
    // Handle timestamp numbers
    if (typeof date === 'number') {
      date = new Date(date);
    }
    
    // Handle date strings
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    // Ensure it's a Date object
    if (!(date instanceof Date)) {
      return 'N/A';
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch (error) {
    console.warn('Error formatting date/time:', error, date);
    return 'N/A';
  }
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

