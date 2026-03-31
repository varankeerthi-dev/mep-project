import { z } from 'zod';

// Validation patterns
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const PIN_PATTERN = /^[0-9]{6}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const NO_NUMBERS_PATTERN = /^[^0-9]*$/; // No numbers allowed

// Field validation schemas
export const vendorValidationSchema = z.object({
  company_name: z.string()
    .min(1, 'Company name is required')
    .regex(NO_NUMBERS_PATTERN, 'Company name cannot contain numbers'),
  
  gstin: z.string()
    .min(1, 'GSTIN is required')
    .regex(GSTIN_PATTERN, 'Invalid GSTIN format (e.g., 27AABCU9603R1ZM)'),
  
  pan: z.string()
    .regex(PAN_PATTERN, 'Invalid PAN format (e.g., ABCUP1234A)')
    .optional()
    .or(z.literal('')),
  
  email: z.string()
    .regex(EMAIL_PATTERN, 'Invalid email format')
    .optional()
    .or(z.literal('')),
  
  pincode: z.string()
    .regex(PIN_PATTERN, 'PIN code must be 6 digits')
    .optional()
    .or(z.literal('')),
});

export const poItemValidationSchema = z.object({
  item_name: z.string().min(1, 'Item name is required'),
  quantity: z.number()
    .min(0.001, 'Quantity must be greater than 0')
    .refine((val) => !isNaN(val), 'Quantity must be a number'),
  rate: z.number()
    .min(0, 'Rate cannot be negative')
    .refine((val) => !isNaN(val), 'Rate must be a number'),
  discount_percent: z.number()
    .min(0, 'Discount cannot be negative')
    .max(100, 'Discount cannot exceed 100%')
    .refine((val) => !isNaN(val), 'Discount must be a number'),
});

export const purchaseOrderValidationSchema = z.object({
  vendor_id: z.string().min(1, 'Please select a vendor'),
  po_date: z.string().min(1, 'PO date is required'),
  delivery_date: z.string().optional(),
  currency: z.string().min(1, 'Currency is required'),
  exchange_rate: z.number().min(0, 'Exchange rate cannot be negative'),
  terms: z.string().optional(),
});

// Validation helpers
export const validateGSTIN = (gstin: string): boolean => {
  return GSTIN_PATTERN.test(gstin);
};

export const validatePAN = (pan: string): boolean => {
  return PAN_PATTERN.test(pan);
};

export const validatePIN = (pin: string): boolean => {
  return PIN_PATTERN.test(pin);
};

export const validateEmail = (email: string): boolean => {
  return EMAIL_PATTERN.test(email);
};

export const validateNoNumbers = (text: string): boolean => {
  return NO_NUMBERS_PATTERN.test(text);
};

export const validateQuantity = (qty: number): boolean => {
  return !isNaN(qty) && qty > 0;
};

// Helper to format validation errors
export const formatZodErrors = (error: z.ZodError): Record<string, string> => {
  const errors: Record<string, string> = {};
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return errors;
};