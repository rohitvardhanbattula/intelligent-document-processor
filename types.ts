
export enum UserRole {
  EndUser = 'End User',
  Analyst = 'Analyst / Trainer',
  Admin = 'Admin (Both)',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export enum DocumentStatus {
  Uploaded = 'Uploaded',
  Parsing = 'Parsing',
  Mapping = 'Mapping',
  Review = 'Review',
  Posting = 'Posting',
  Done = 'Done',
}

export interface DocumentFile {
  name: string;
  type: string;
  size: number;
  base64: string;
  fileHash: string;
}

export interface UsageMetadata {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  modelName: string;
  estimatedCost: number;
}

export interface LineItem {
  LineItem?: string;
  VendorItemNumber?: string;
  ItemDescription?: string;
  QuantityOrdered?: number;
  UnitOfMeasure?: string;
  CostEach?: number;
  CostExtended?: number;
  DateRequired?: string;
  CustomerReference?: string;
  SOReference?: string;
  [key: string]: any;
}

export interface ExtractionRule {
  id: string;
  name: string;
  active: boolean;
  condition: {
    field: string; // e.g., 'customer_name', 'FILENAME', 'ALL'
    operator: 'equals' | 'contains' | 'starts_with' | 'always';
    value: string;
  };
  instruction: string; // The specific hint for the AI
  targetField?: string; // Visual aid: which field does this affect?
}

export interface Document {
  id: string;
  file: DocumentFile;
  status: DocumentStatus;
  extractedData?: Record<string, any>;
  mappedData: Record<string, any>;
  unmappedData?: { key: string; value: string | number }[];
  lineItems?: LineItem[];
  termsAndConditions?: string;
  confidence?: Record<string, number>;
  tags?: string[];
  appliedRuleIds?: string[]; // Track which rules were applied
  usageMetadata?: UsageMetadata;
  createdBy: string;
  createdAt: string;
  lastModifiedAt?: string; // For draft saving confirmation
  sapCustomerMatch?: SapCustomer; // Automatically linked SAP Customer
  emailContext?: string; // Content of attached email or supplementary text
}

export interface SchemaField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'date';
  description: string;
}

export interface TrainingRules {
  schema: SchemaField[];
  naturalLanguageRules: string;
  conditionalRules?: ExtractionRule[];
}

export type ExtractionEngine = 'gemini-cloud' | 'tesseract-local' | 'chrome-device-llm';

export interface SystemSettings {
  sapBaseUrl: string;
  customerServicePath: string;
  orderServicePath: string;
  sapUsername: string;
  sapPassword?: string;
  extractionEngine: ExtractionEngine;
  bypassProxy: boolean;
}

export interface SapCustomer {
  BusinessPartner: string;
  CustomerName: string;
  CityName: string;
  Country: string;
  PostalCode?: string;
  StreetName?: string;
}
