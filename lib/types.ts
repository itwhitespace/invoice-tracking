export interface DesignFeeItem {
  id?: string;
  item: string;
  description: string;
  amount: number;
}

export interface TimeFrameItem {
  id?: string;
  phase: string;
  description: string;
  duration: string;
}

export type PaymentStatus = 'wait' | 'invoice' | 'paid';

export interface PaymentTermItem {
  id?: string;
  milestone: string;
  paymentPercentage: number;
  amount: number;
  // Which week (1-indexed, within the project's total design duration) this
  // milestone is planned to be collected in.
  paymentWeek?: number;
  // Date the invoice/collection is scheduled for. Setting this is what puts
  // the milestone into the Wait status; Admin advances it from there.
  invoiceDate?: string;
  paymentStatus?: PaymentStatus;
  // Set when Admin moves the milestone into Invoice / Paid respectively.
  invoiceIssuedDate?: string;
  paidDate?: string;
}

export interface ExtractedProjectData {
  companyName?: string;
  projectName: string;
  area: string;
  scopeOfWork: string;
  totalFee: number;
  designFeeItems?: DesignFeeItem[];
  specialDiscount?: number;
  timeFrames: TimeFrameItem[];
  totalDesignDuration?: string;
  paymentTerms: PaymentTermItem[];
}

export type Department = 'studio-1' | 'studio-2' | 'studio-3' | 'studio-4' | 'Signage' | 'Branding';

export interface SavedRecord {
  id: string;
  created_at: string;
  companyName?: string;
  projectName: string;
  area: string;
  scopeOfWork: string;
  totalFee: number;
  designFeeItems?: DesignFeeItem[];
  specialDiscount?: number;
  timeFrames: TimeFrameItem[];
  totalDesignDuration?: string;
  paymentTerms: PaymentTermItem[];
  pdfUrl?: string;
  pdfFileName?: string;
  status: 'pending' | 'draft' | 'verified' | 'approved';
  startDate?: string;
  department?: Department | '';
  approvedAt?: string;
  // Only meaningful once Approved: keeps the project visible on the Project
  // Roadmap but excludes its payment amounts from the monthly totals.
  onHold?: boolean;
}

export interface AppSettings {
  geminiApiKey: string;
  preferredModel?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseBucket: string;
  useMockExtraction: boolean;
}
