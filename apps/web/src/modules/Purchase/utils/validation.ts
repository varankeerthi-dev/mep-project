import { z } from 'zod';

// Validation patterns
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
// Indian PAN: 5 letters + 4 digits + 1 letter (e.g., ABCUP1234A)
// 4th char = assessee type: A=AOP, B=BOI, C=Company, F=Firm, G=Govt, H=HUF, J=Juridical, L=Local Authority, P=Individual, T=Trust
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const PAN_ENTITY_TYPES = ['A', 'B', 'C', 'F', 'G', 'H', 'J', 'L', 'P', 'T'] as const;
const PAN_ENTITY_LABELS: Record<string, string> = {
  A: 'AOP', B: 'BOI', C: 'Company', F: 'Firm', G: 'Government',
  H: 'HUF', J: 'Juridical Person', L: 'Local Authority', P: 'Individual', T: 'Trust',
};
const PIN_PATTERN = /^[0-9]{6}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const NO_NUMBERS_PATTERN = /^[^0-9]*$/; // No numbers allowed

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PHONE_PATTERN = /^[+\d\s()-]{6,15}$/;
const BANK_ACCOUNT_PATTERN = /^\d{9,18}$/;

// Field validation schemas
export const vendorValidationSchema = z.object({
  company_name: z.string()
    .min(1, 'Company name is required')
    .max(200, 'Company name is too long')
    .regex(NO_NUMBERS_PATTERN, 'Company name cannot contain numbers'),

  contact_person: z.string()
    .max(100, 'Contact person name is too long')
    .regex(NO_NUMBERS_PATTERN, 'Contact person cannot contain numbers')
    .optional()
    .or(z.literal('')),

  email: z.string()
    .regex(EMAIL_PATTERN, 'Invalid email format')
    .optional()
    .or(z.literal('')),

  phone: z.string()
    .regex(PHONE_PATTERN, 'Invalid phone number (6-15 digits, +, spaces, hyphens allowed)')
    .optional()
    .or(z.literal('')),

  gstin: z.string()
    .regex(GSTIN_PATTERN, 'Invalid GSTIN format (e.g., 27AABCU9603R1ZM)')
    .optional()
    .or(z.literal('')),

  pan: z.string()
    .length(10, 'PAN must be exactly 10 characters')
    .regex(PAN_PATTERN, 'Invalid PAN format. Expected: AAAAA9999A (e.g., ABCUP1234A)')
    .refine(
      (val) => PAN_ENTITY_TYPES.includes(val[3] as typeof PAN_ENTITY_TYPES[number]),
      (val) => ({ message: `4th character must be a valid entity type: ${PAN_ENTITY_LABELS[val?.[3]] || val?.[3] || '?'}. Valid: P=Individual, C=Company, F=Firm, H=HUF, G=Govt, T=Trust` })
    )
    .optional()
    .or(z.literal('')),

  address: z.string()
    .max(500, 'Address is too long')
    .optional()
    .or(z.literal('')),

  state: z.string().optional().or(z.literal('')),

  pincode: z.string()
    .regex(PIN_PATTERN, 'PIN code must be 6 digits')
    .optional()
    .or(z.literal('')),

  default_currency: z.string().min(1, 'Currency is required'),
  payment_terms: z.string().min(1, 'Payment terms is required'),

  credit_limit: z.number()
    .min(0, 'Credit limit cannot be negative')
    .optional()
    .default(0),

  opening_balance: z.number()
    .min(0, 'Opening balance cannot be negative')
    .optional()
    .default(0),

  bank_account_no: z.string()
    .regex(BANK_ACCOUNT_PATTERN, 'Account number must be 9-18 digits')
    .optional()
    .or(z.literal('')),

  bank_ifsc: z.string()
    .regex(IFSC_PATTERN, 'Invalid IFSC format (e.g., SBIN0001234)')
    .optional()
    .or(z.literal('')),

  bank_name: z.string().max(100, 'Bank name is too long').optional().or(z.literal('')),
  bank_branch: z.string().max(100, 'Branch name is too long').optional().or(z.literal('')),
  account_holder_name: z.string().max(100, 'Account holder name is too long').optional().or(z.literal('')),

  re_enter_account_number: z.string().optional().or(z.literal('')),

  remarks: z.string().max(1000, 'Remarks is too long').optional().or(z.literal('')),
  status: z.string().min(1, 'Status is required'),
  msme_register_type: z.string().optional().or(z.literal('')),
  msme_number: z.string().max(50, 'MSME number is too long').optional().or(z.literal('')),
  gst_treatment: z.string().optional().or(z.literal('')),

  // Document uploads (Supabase Storage URLs — UI TBD)
  pan_card_url: z.string().url('Invalid PAN card URL').optional().or(z.literal('')),
  cheque_leaf_url: z.string().url('Invalid cheque leaf URL').optional().or(z.literal('')),
  gstin_certificate_url: z.string().url('Invalid GST certificate URL').optional().or(z.literal('')),
  msme_certificate_url: z.string().url('Invalid MSME certificate URL').optional().or(z.literal('')),
}).refine(
  (data) => {
    if (data.bank_account_no && data.re_enter_account_number) {
      return data.bank_account_no === data.re_enter_account_number;
    }
    return true;
  },
  { message: 'Account numbers do not match', path: ['re_enter_account_number'] }
);

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