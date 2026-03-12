// ── App Mode ──
export type AppMode = 'school' | 'studio';

// ── Garment Types ──
export const GARMENT_TYPES = [
  'T-Shirt', 'Hoodie', 'Sweatshirt', 'Pants', 'Jeans', 'Jacket',
  'Dress', 'Skirt', 'Shorts', 'Cap', 'Tank Top', 'Polo', 'Blazer',
  'Coat', 'Cargo Pants', 'Joggers', 'Windbreaker', 'Vest',
  'Button-Down Shirt', 'Jumpsuit',
] as const;

export type GarmentType = typeof GARMENT_TYPES[number];

// ── Part Labels for Mix & Match ──
export const PART_LABELS = [
  'collar', 'neckline', 'sleeves', 'cuffs', 'body', 'pocket',
  'waistband', 'hem', 'zipper', 'hood', 'drawstring', 'lining',
  'stitching', 'print/graphic', 'fabric/texture', 'silhouette',
  'back panel', 'closure', 'ribbing', 'logo placement',
] as const;

export type PartLabel = typeof PART_LABELS[number];

// ── Reference Image with Part Annotations ──
export interface ReferenceImage {
  id: string;
  dataUrl: string;          // base64 data URL
  filename: string;
  parts: PartLabel[];       // which parts to take from this image
  notes?: string;           // user notes like "take the collar from this"
}

// ── Design Wizard Steps ──
export type DesignStep = 'upload' | 'parts' | 'questions' | 'generate' | 'review';

// ── AI Question & Answer Flow ──
export interface DesignQuestion {
  id: string;
  question: string;
  type: 'select' | 'multi-select' | 'text' | 'range';
  options?: string[];
  category: 'fit' | 'fabric' | 'construction' | 'color' | 'branding' | 'details';
}

export interface DesignAnswer {
  questionId: string;
  answer: string | string[];
}

// ── Mockup Request / Result ──
export interface MockupRequest {
  referenceImages: ReferenceImage[];
  garmentType: string;
  answers: DesignAnswer[];      // from Q&A flow
  instructions?: string;
  quality: 'draft' | 'standard' | 'high';
}

export interface MockupResult {
  id: string;
  mockupImage: string;
  description: string;
  garmentType: string;
  createdAt: string;
  specs?: DesignSpecs;         // generated alongside mockup
}

// ── Edit / Remix ──
export interface EditRequest {
  mockupImage: string;
  editInstructions: string;    // "make collar wider", "change to v-neck"
  garmentType: string;
}

// ── Design Specs (generated with mockup) ──
export interface DesignSpecs {
  fit: string;
  fabric: string;
  weight?: string;
  colors: string[];
  keyFeatures: string[];
}

// ── Factory-Ready Tech Pack ──
export interface TechPackData {
  // Header
  garmentType: string;
  styleName: string;
  styleNumber: string;
  season?: string;
  date: string;

  // Graded Measurements (size → POM → value)
  sizes: string[];                      // e.g. ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  baseSize: string;                     // e.g. 'M'
  measurements: GradedMeasurement[];

  // Construction
  constructionDetails: ConstructionDetail[];

  // Materials / BOM
  materials: BOMEntry[];

  // Colorway
  colorway: ColorSpec[];

  // Labels & Branding
  labels: LabelSpec[];
  artworkPlacements: ArtworkPlacement[];

  // Care & Compliance
  careInstructions: string[];
  fiberContent: string;
  countryOfOrigin?: string;

  // Packaging
  packaging: PackagingSpec;

  // Notes
  constructionNotes: string[];
  additionalNotes?: string;

  // Image
  mockupImage: string;
}

export interface GradedMeasurement {
  pom: string;                          // Point of Measure name
  description: string;
  tolerance: string;                    // e.g. '+/- 0.5"'
  values: Record<string, string>;       // size → value, e.g. { S: '18"', M: '20"', L: '22"' }
  gradingRule?: string;                 // e.g. '+1.5" per size'
}

export interface ConstructionDetail {
  area: string;                         // e.g. 'collar', 'side seam', 'hem'
  stitchType: string;                   // e.g. 'single-needle lockstitch', '5-thread overlock'
  spiOrGauge?: string;                  // stitches per inch
  seamAllowance?: string;              // e.g. '3/8"'
  notes: string;
}

export interface BOMEntry {
  component: string;                    // e.g. 'Shell Fabric', 'Zipper', 'Main Label'
  description: string;
  material: string;
  colorCode?: string;                   // Pantone or supplier code
  supplier?: string;
  quantity?: string;
  placement: string;
}

export interface ColorSpec {
  name: string;
  pantone: string;                      // e.g. '19-4052 TCX'
  hex: string;
  component: string;                    // what this color applies to
}

export interface LabelSpec {
  type: string;                         // 'brand', 'size', 'care/content', 'hangtag'
  method: string;                       // 'woven', 'printed', 'heat-applied'
  dimensions: string;
  placement: string;                    // e.g. 'center back neck, 1" below collar seam'
}

export interface ArtworkPlacement {
  name: string;
  method: string;                       // 'screen print', 'embroidery', 'DTG', 'sublimation'
  position: string;                     // 'center chest, 3" below HPS'
  dimensions: string;
  colorCodes: string[];
}

export interface PackagingSpec {
  foldMethod: string;
  polyBag: string;
  hangtag: string;
  tissueWrap: boolean;
  unitsPerCarton?: number;
}

// ── Try-On ──
export interface TryOnRequest {
  mockupImage: string;
  userPhoto: string;
  measurements?: UserMeasurements;
}

export interface UserMeasurements {
  height?: string;
  chest?: string;
  waist?: string;
  hips?: string;
  shoulders?: string;
  size?: string;
}
