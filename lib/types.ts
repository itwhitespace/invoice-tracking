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

export interface PaymentTermItem {
  id?: string;
  milestone: string;
  paymentPercentage: number;
  amount: number;
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
}

export interface AppSettings {
  geminiApiKey: string;
  preferredModel?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseBucket: string;
  useMockExtraction: boolean;
}
