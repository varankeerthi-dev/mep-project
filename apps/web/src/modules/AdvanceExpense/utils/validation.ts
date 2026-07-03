import type { AeFormData, FloatFormData } from '../types';

export function validateAeForm(data: AeFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.employee_id) errors.employee_id = 'Employee is required';
  if (!data.project_id) errors.project_id = 'Project is required';
  if (!data.category_id) errors.category_id = 'Category is required';
  if (!data.amount || data.amount <= 0) errors.amount = 'Amount must be greater than 0';
  if (!data.narration?.trim()) errors.narration = 'Narration is required';
  return errors;
}

export function validateFloatForm(data: FloatFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.holder_id) errors.holder_id = 'Holder is required';
  if (!data.project_id) errors.project_id = 'Project is required';
  if (!data.float_amount || data.float_amount <= 0) errors.float_amount = 'Float amount must be greater than 0';
  return errors;
}
