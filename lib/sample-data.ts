import { ExtractedProjectData } from "./types";

export const EMPTY_PROJECT_DATA: ExtractedProjectData = {
  companyName: "",
  projectName: "",
  totalFee: 0,
  timeFrames: [],
  totalDesignDuration: "",
  paymentTerms: [],
};

export const SAMPLE_PROJECT_DATA: ExtractedProjectData = {
  companyName: "Whitespace Partners",
  projectName: "Villa Horizon Luxury Residence & Clubhouse",
  totalFee: 1450000,
  timeFrames: [
    {
      phase: "Phase 1: Concept Design",
      description: "Site analysis, zoning review, preliminary space planning & mood boards",
      duration: "3 Weeks"
    },
    {
      phase: "Phase 2: Schematic Design & 3D",
      description: "Refined 3D visualization, perspective exterior/interior, key material selection",
      duration: "4 Weeks"
    },
    {
      phase: "Phase 3: Design Development",
      description: "Detailed MEP coordination, architectural layout & structural integration",
      duration: "4 Weeks"
    },
    {
      phase: "Phase 4: Tender & Working Drawings",
      description: "Full construction documentation, detailed BOQ specification & contractor bidding",
      duration: "5 Weeks"
    },
    {
      phase: "Phase 5: Site Supervision",
      description: "Periodic site inspection, quality control & contractor coordination",
      duration: "Throughout Construction"
    }
  ],
  totalDesignDuration: "16 Weeks",
  paymentTerms: [
    {
      milestone: "1st Installment: Sign Agreement / Deposit",
      paymentPercentage: 20,
      amount: 290000
    },
    {
      milestone: "2nd Installment: Concept Design Approval",
      paymentPercentage: 25,
      amount: 362500
    },
    {
      milestone: "3rd Installment: Schematic 3D Design Approval",
      paymentPercentage: 25,
      amount: 362500
    },
    {
      milestone: "4th Installment: Submission of Working Drawings",
      paymentPercentage: 20,
      amount: 290000
    },
    {
      milestone: "5th Installment: Final Handover & As-Built Verification",
      paymentPercentage: 10,
      amount: 145000
    }
  ]
};

export const SAMPLE_PROJECT_DATA_2: ExtractedProjectData = {
  companyName: "Whitespaceconnect",
  projectName: "The Urban Loft Cafe & Co-working Space",
  totalFee: 680000,
  timeFrames: [
    {
      phase: "Phase 1: Initial Survey & Layout",
      description: "As-built dimension survey and customer flow planning",
      duration: "2 Weeks"
    },
    {
      phase: "Phase 2: Interior 3D & Finishes",
      description: "Full interior 3D renderings and material palette",
      duration: "3 Weeks"
    },
    {
      phase: "Phase 3: Construction Drawings",
      description: "Joinery details, electrical & plumbing plans",
      duration: "3 Weeks"
    }
  ],
  totalDesignDuration: "8 Weeks",
  paymentTerms: [
    {
      milestone: "Deposit upon Signing",
      paymentPercentage: 30,
      amount: 204000
    },
    {
      milestone: "Approval of 3D Interior Visuals",
      paymentPercentage: 40,
      amount: 272000
    },
    {
      milestone: "Final Construction Drawing Package",
      paymentPercentage: 30,
      amount: 204000
    }
  ]
};
