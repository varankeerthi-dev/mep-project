import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useOrganisationSettings } from '@/hooks/useOrganisationSettings';
import {
  DEFAULT_DATE_FORMAT,
  isDateFormatKey,
  formatDateByKey,
  setDateFormat,
  type DateFormatKey,
} from '@/lib/dateFormat';

interface DateFormatContextValue {
  formatKey: DateFormatKey;
  formatDate: (value: Date | string | null | undefined) => string;
}

const DateFormatContext = createContext<DateFormatContextValue>({
  formatKey: DEFAULT_DATE_FORMAT,
  formatDate: (value) => formatDateByKey(value, DEFAULT_DATE_FORMAT),
});

/**
 * Reads the organisation-level `settings.date_format` (Settings → General →
 * Date format), exposes a reactive `formatDate`, and keeps the module store in
 * `@/lib/dateFormat` in sync so non-React helpers pick up the change too.
 */
export function DateFormatProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useOrganisationSettings();

  const formatKey: DateFormatKey = isDateFormatKey(settings?.date_format)
    ? (settings.date_format as DateFormatKey)
    : DEFAULT_DATE_FORMAT;

  useEffect(() => {
    setDateFormat(formatKey);
  }, [formatKey]);

  const value = useMemo<DateFormatContextValue>(
    () => ({
      formatKey,
      formatDate: (date) => formatDateByKey(date, formatKey),
    }),
    [formatKey]
  );

  return <DateFormatContext.Provider value={value}>{children}</DateFormatContext.Provider>;
}

export function useAppDateFormat(): DateFormatContextValue {
  return useContext(DateFormatContext);
}
