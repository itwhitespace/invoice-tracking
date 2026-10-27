import { PaymentTermItem } from "./types";

// Total Fee must equal the sum of every installment — Hold and Cancelled
// included — before a project can be saved. A project with no installments
// yet is exempt. Compared in satang so floating-point noise doesn't count.
const toSatang = (n: number) => Math.round((Number(n) || 0) * 100);

export const sumPaymentTerms = (terms: PaymentTermItem[] = []): number =>
  terms.reduce((sum, pt) => sum + (Number(pt.amount) || 0), 0);

// Installments minus Total Fee: negative = short, positive = over.
export const paymentTermsDiff = (totalFee: number, terms: PaymentTermItem[] = []): number =>
  terms.length === 0 ? 0 : (toSatang(sumPaymentTerms(terms)) - toSatang(totalFee)) / 100;

export const paymentTermsMatchFee = (totalFee: number, terms: PaymentTermItem[] = []): boolean =>
  paymentTermsDiff(totalFee, terms) === 0;
