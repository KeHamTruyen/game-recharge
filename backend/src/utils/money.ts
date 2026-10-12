import { z } from 'zod';

// Largest whole VND amount supported by the existing Decimal(12, 2) columns.
export const vndAmountSchema = z.number()
  .int('Số tiền VND phải là số nguyên.')
  .min(1, 'Số tiền phải từ 1đ.')
  .max(9_999_999_999, 'Số tiền không được vượt quá 9.999.999.999đ.');
