export interface ValidationResult {
  valid: boolean;
  message: string;
}

export function validateGSTIN(gstin: string): ValidationResult {
  if (!gstin) return { valid: true, message: '' };
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/;
  if (!gstinRegex.test(gstin)) {
    return { valid: false, message: 'Invalid GSTIN format. Expected: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric' };
  }
  return { valid: true, message: '' };
}

export function validatePAN(pan: string): ValidationResult {
  if (!pan) return { valid: true, message: '' };
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(pan)) {
    return { valid: false, message: 'Invalid PAN format. Expected: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)' };
  }
  return { valid: true, message: '' };
}

export function validateIFSC(ifsc: string): ValidationResult {
  if (!ifsc) return { valid: true, message: '' };
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(ifsc)) {
    return { valid: false, message: 'Invalid IFSC code. Expected: 4 letters + 0 + 6 alphanumeric characters (e.g., SBIN0001234)' };
  }
  return { valid: true, message: '' };
}

export function validatePhone(phone: string): ValidationResult {
  if (!phone) return { valid: true, message: '' };
  const phoneRegex = /^(\+91[\s-]?)?[6-9]\d{9}$/;
  const cleaned = phone.replace(/[\s-()]/g, '');
  if (!phoneRegex.test(cleaned) && !/^\d{10}$/.test(cleaned)) {
    return { valid: false, message: 'Invalid phone number. Expected: 10-digit Indian mobile number' };
  }
  return { valid: true, message: '' };
}

export function validateEmail(email: string): ValidationResult {
  if (!email) return { valid: true, message: '' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Invalid email address' };
  }
  return { valid: true, message: '' };
}

export function validatePincode(pincode: string): ValidationResult {
  if (!pincode) return { valid: true, message: '' };
  const pincodeRegex = /^[1-9][0-9]{5}$/;
  if (!pincodeRegex.test(pincode)) {
    return { valid: false, message: 'Invalid PIN code. Expected: 6-digit number starting with 1-9' };
  }
  return { valid: true, message: '' };
}

export function validateAadhar(aadhar: string): ValidationResult {
  if (!aadhar) return { valid: true, message: '' };
  const aadharRegex = /^[2-9]{1}[0-9]{11}$/;
  const cleaned = aadhar.replace(/[\s-]/g, '');
  if (!aadharRegex.test(cleaned)) {
    return { valid: false, message: 'Invalid Aadhar number. Expected: 12-digit number starting with 2-9' };
  }
  return { valid: true, message: '' };
}

export function validateBankAccount(account: string): ValidationResult {
  if (!account) return { valid: true, message: '' };
  if (!/^\d{9,18}$/.test(account)) {
    return { valid: false, message: 'Invalid bank account number. Expected: 9-18 digits' };
  }
  return { valid: true, message: '' };
}

export function validateSubcontractorForm(data: Record<string, string | boolean>): ValidationResult[] {
  const errors: ValidationResult[] = [];

  if (!data.company_name || (typeof data.company_name === 'string' && !data.company_name.trim())) {
    errors.push({ valid: false, message: 'Company name is required' });
  }

  if (data.gstin) {
    const gstinResult = validateGSTIN(data.gstin as string);
    if (!gstinResult.valid) errors.push(gstinResult);
  }

  if (data.pan_card) {
    const panResult = validatePAN(data.pan_card as string);
    if (!panResult.valid) errors.push(panResult);
  }

  if (data.bank_ifsc_code) {
    const ifscResult = validateIFSC(data.bank_ifsc_code as string);
    if (!ifscResult.valid) errors.push(ifscResult);
  }

  if (data.phone) {
    const phoneResult = validatePhone(data.phone as string);
    if (!phoneResult.valid) errors.push(phoneResult);
  }

  if (data.email) {
    const emailResult = validateEmail(data.email as string);
    if (!emailResult.valid) errors.push(emailResult);
  }

  if (data.pincode) {
    const pincodeResult = validatePincode(data.pincode as string);
    if (!pincodeResult.valid) errors.push(pincodeResult);
  }

  if (data.bank_account_number) {
    const accountResult = validateBankAccount(data.bank_account_number as string);
    if (!accountResult.valid) errors.push(accountResult);
  }

  return errors;
}

export function sanitizeInput(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

export function formatPhoneForDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}
