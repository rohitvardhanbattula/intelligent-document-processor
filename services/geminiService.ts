
import { GoogleGenAI, Type } from "@google/genai";
import { DocumentFile, TrainingRules, Document, UsageMetadata, LineItem, ExtractionRule } from '../types';
import { loadSettings } from "./settingsService";
import { extractLocally } from "./localExtractionService";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

// Pricing Constants for Gemini 1.5 Flash (approximate)
const PRICE_INPUT_PER_1M = 0.075;
const PRICE_OUTPUT_PER_1M = 0.30;

// --- UTILS ---
const cleanJsonString = (text: string): string => {
    // Remove markdown code blocks if present
    let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    // Sometimes models add preamble text, try to find the first { and last }
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        clean = clean.substring(firstBrace, lastBrace + 1);
    }
    return clean;
};

// --- RULE ENGINE ---
const evaluateRules = (document: Document, mappedData: any, lineItems: LineItem[], rules: ExtractionRule[]): ExtractionRule[] => {
    if (!rules || rules.length === 0) return [];

    return rules.filter(rule => {
        if (!rule.active) return false;
        
        // Handle "Always" or "All"
        if (rule.condition.operator === 'always') return true;

        let subjectValues: string[] = [];

        // 1. Check Filename
        if (rule.condition.field === 'FILENAME') {
            subjectValues = [document.file.name.toLowerCase()];
        } 
        // 2. Check Header Fields (Mapped Data)
        else if (mappedData && mappedData[rule.condition.field] !== undefined) {
            subjectValues = [String(mappedData[rule.condition.field]).toLowerCase()];
        } 
        // 3. Check Line Items (Iterate through all items to find a match)
        else if (lineItems && lineItems.length > 0) {
            subjectValues = lineItems
                .map(item => item[rule.condition.field])
                .filter(val => val !== undefined && val !== null)
                .map(val => String(val).toLowerCase());
        }

        if (subjectValues.length === 0) return false; // Field not found

        const conditionValue = rule.condition.value.toLowerCase();

        // Evaluate Condition (OR logic: if ANY value matches, the rule applies)
        return subjectValues.some(subjectVal => {
            switch (rule.condition.operator) {
                case 'equals':
                    return subjectVal === conditionValue;
                case 'contains':
                    return subjectVal.includes(conditionValue);
                case 'starts_with':
                    return subjectVal.startsWith(conditionValue);
                default:
                    return false;
            }
        });
    });
};

const buildSchema = (rules: TrainingRules) => {
    const mappedProperties: any = {};
    const confidenceProperties: any = {};
    
    rules.schema.forEach(field => {
        mappedProperties[field.name] = {
        type: field.type === 'number' ? Type.NUMBER : Type.STRING,
        description: field.description
        };
        confidenceProperties[field.name] = {
        type: Type.NUMBER,
        description: `Confidence score (0.0-1.0) for ${field.name}`
        };
    });

    return {
        type: Type.OBJECT,
        properties: {
        mappedData: {
            type: Type.OBJECT,
            description: "The Header fields of the Purchase Order / Invoice",
            properties: mappedProperties,
            required: rules.schema.map(f => f.name),
        },
        lineItems: {
            type: Type.ARRAY,
            description: "List of all line items in the Purchase Order grid",
            items: {
                type: Type.OBJECT,
                properties: {
                    LineItem: { type: Type.STRING, description: "Line number (e.g., 1, 10, 20)" },
                    VendorItemNumber: { type: Type.STRING, description: "Vendor Part Number / Material Number" },
                    ItemDescription: { type: Type.STRING, description: "Description of the item" },
                    QuantityOrdered: { type: Type.NUMBER, description: "Quantity" },
                    UnitOfMeasure: { type: Type.STRING, description: "UOM (e.g. EACH, PC)" },
                    CostEach: { type: Type.NUMBER, description: "Unit Price" },
                    CostExtended: { type: Type.NUMBER, description: "Total Line Amount" },
                    DateRequired: { type: Type.STRING, description: "Delivery Date" },
                    CustomerReference: { type: Type.STRING, description: "Customer Ref / Equp Matr" },
                    SOReference: { type: Type.STRING, description: "Sales Order Reference / SO Line" }
                }
            }
        },
        unmappedData: {
            type: Type.ARRAY,
            description: "Any other important key-value pairs not found in mappedData or lineItems",
            items: {
                type: Type.OBJECT,
                properties: {
                    key: { type: Type.STRING },
                    value: { type: Type.STRING }
                }
            }
        },
        termsAndConditions: { type: Type.STRING },
        confidence: { type: Type.OBJECT, properties: confidenceProperties }
        }
    };
};

// --- GEMINI CLOUD IMPLEMENTATION ---
const extractWithGeminiCloud = async (document: Document, rules: TrainingRules) => {
  const modelName = 'gemini-2.5-flash';
  const responseSchema = buildSchema(rules);
  
  // 1. BASE EXTRACTION
  const baseSystemInstruction = `
    You are an intelligent document processing agent specializing in complex Purchase Orders and Sales Orders.
    
    GOAL: Extract data to create a Sales Order in SAP S/4HANA.
    
    1. HEADERS: Extract the specific fields requested in 'mappedData'.
    2. LINE ITEMS: Extract the table of items into 'lineItems'. Pay close attention to:
       - Vendor Item Number (e.g. 6510866, CRECP4N)
       - Descriptions
       - Quantities and Unit Costs
       - Extended Costs (ensure Quantity * Cost = Extended)
    3. EXTRAS: Put any other useful info in 'unmappedData'.
    
    GLOBAL RULES: "${rules.naturalLanguageRules}"

    ADDITIONAL CONTEXT (Important):
    ${document.emailContext ? `The user provided the following Email/Text Context along with the document. Use this to override standard extraction or clarify details (e.g. Ship To addresses, special instructions): \n"${document.emailContext}"` : "No additional email context provided."}
  `;

  let inputTokens = 0;
  let outputTokens = 0;

  console.log("Step 1: Performing Base Extraction...");
  const baseResponse = await ai.models.generateContent({
      model: modelName,
      contents: [
        { inlineData: { mimeType: document.file.type, data: document.file.base64 } },
        { text: "Analyze the image/PDF provided and return the JSON response." }
      ],
      config: {
        systemInstruction: baseSystemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const baseText = baseResponse.text;
    if (!baseText) throw new Error("No response text from AI.");
    let result = JSON.parse(cleanJsonString(baseText));

    inputTokens += baseResponse.usageMetadata?.promptTokenCount || 0;
    outputTokens += baseResponse.usageMetadata?.candidatesTokenCount || 0;

    // 2. CHECK CONDITIONAL RULES (Multi-Step Logic)
    // Pass lineItems to evaluation engine
    const matchingRules = evaluateRules(document, result.mappedData, result.lineItems || [], rules.conditionalRules || []);
    const appliedRuleIds: string[] = [];

    if (matchingRules.length > 0) {
        console.log(`Step 2: Rules Triggered: ${matchingRules.length}. Performing Refinement...`);
        
        const ruleInstructions = matchingRules.map(r => `- Condition Met: ${r.name}. Instruction: ${r.instruction}`).join('\n');
        appliedRuleIds.push(...matchingRules.map(r => r.id));

        const refinementInstruction = `
            You have already extracted data. However, specific rules apply to this document.
            
            APPLY THESE SPECIFIC RULES AND UPDATE THE JSON:
            ${ruleInstructions}
            
            CRITICAL INSTRUCTIONS:
            1. Return the COMPLETE JSON structure with the updates applied.
            2. DO NOT remove any Line Items. The extracted data has ${result.lineItems?.length || 0} line items. Your output MUST contain exactly this number of line items.
            3. Only modify the specific fields mentioned in the rules (e.g., Description, PO Number). Keep all other values identical.
        `;

        const refinementResponse = await ai.models.generateContent({
            model: modelName,
            contents: [
                { inlineData: { mimeType: document.file.type, data: document.file.base64 } },
                { text: `Current Extraction Data: ${JSON.stringify(result)}. \n\n ${refinementInstruction}` }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema, // Enforce same schema
            }
        });

        const refinedText = refinementResponse.text;
        if (refinedText) {
            result = JSON.parse(cleanJsonString(refinedText));
            inputTokens += refinementResponse.usageMetadata?.promptTokenCount || 0;
            outputTokens += refinementResponse.usageMetadata?.candidatesTokenCount || 0;
        }
    }

    // Calculate Usage & Cost
    const totalTokens = inputTokens + outputTokens;
    const cost = ((inputTokens / 1000000) * PRICE_INPUT_PER_1M) + 
                 ((outputTokens / 1000000) * PRICE_OUTPUT_PER_1M);

    const usageMetadata: UsageMetadata = {
        inputTokens,
        outputTokens,
        totalTokens,
        modelName: 'Gemini 2.5 Flash (Multi-step)',
        estimatedCost: cost
    };

    return {
      mappedData: result.mappedData || {},
      lineItems: result.lineItems || [],
      unmappedData: result.unmappedData || [],
      termsAndConditions: result.termsAndConditions || '',
      confidence: result.confidence || {},
      appliedRuleIds,
      usageMetadata
    };
}


// --- MAIN EXPORTED FUNCTION ---
export const extractAndMapData = async (
  document: Document,
  rules: TrainingRules
): Promise<{ 
  mappedData: Record<string, any>; 
  lineItems: LineItem[];
  unmappedData: { key: string; value: string | number }[];
  termsAndConditions: string;
  confidence: Record<string, number>;
  appliedRuleIds?: string[];
  usageMetadata?: UsageMetadata;
}> => {
  
  const settings = loadSettings();
  const engine = settings.extractionEngine || 'gemini-cloud';

  console.log(`Processing document using engine: ${engine}`);

  try {
      if (engine === 'gemini-cloud') {
          return await extractWithGeminiCloud(document, rules);
      } else if (engine === 'tesseract-local') {
          return await extractLocally(document, rules, false);
      } else if (engine === 'chrome-device-llm') {
          return await extractLocally(document, rules, true);
      }
      
      throw new Error("Unknown extraction engine");
  } catch (error) {
    console.error(`Error processing document with ${engine}:`, error);
    return {
        mappedData: {},
        lineItems: [],
        unmappedData: [{ key: "error", value: `Extraction failed using ${engine}` }],
        termsAndConditions: "Error processing document.",
        confidence: {},
        appliedRuleIds: [],
        usageMetadata: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            modelName: engine,
            estimatedCost: 0
        }
    };
  }
};

export const refineDataWithFeedback = async (
    document: Document,
    currentData: any,
    userFeedback: string,
    currentRules: TrainingRules
  ): Promise<{ 
    updatedMappedData: Record<string, any>; 
    updatedLineItems: LineItem[];
    updatedUnmappedData: { key: string; value: string | number }[];
    suggestedRule: string; 
  }> => {
  
    // OPTIMIZATION: Instruct model to only return changed fields to avoid timeout on large line items
    const systemInstruction = `
      You are an expert AI Document Trainer. 
      Update the extraction based on the user's feedback.
      
      IMPORTANT: 
      1. Only return the fields that need to be updated.
      2. If 'updatedLineItems' are not affected by the feedback, return an empty array [] to save processing time.
      3. Suggest a generalized rule that could automate this in the future.

      User Feedback: "${userFeedback}"
    `;
  
    // Reconstruct schema from rules to avoid empty properties
    const mappedProperties: any = {};
    currentRules.schema.forEach(field => {
      mappedProperties[field.name] = {
        type: field.type === 'number' ? Type.NUMBER : Type.STRING,
        description: field.description,
        nullable: true // Allow nulls for unchanged fields
      };
    });

    const refineSchema = {
      type: Type.OBJECT,
      properties: {
        updatedMappedData: { 
            type: Type.OBJECT, 
            properties: mappedProperties,
            nullable: true
        },
        updatedLineItems: { 
            type: Type.ARRAY, 
            nullable: true,
            items: { 
                type: Type.OBJECT, 
                properties: {
                    LineItem: { type: Type.STRING },
                    VendorItemNumber: { type: Type.STRING },
                    ItemDescription: { type: Type.STRING },
                    QuantityOrdered: { type: Type.NUMBER },
                    UnitOfMeasure: { type: Type.STRING },
                    CostEach: { type: Type.NUMBER },
                    CostExtended: { type: Type.NUMBER },
                    DateRequired: { type: Type.STRING },
                    CustomerReference: { type: Type.STRING },
                    SOReference: { type: Type.STRING }
                } 
            }
        },
        updatedUnmappedData: { 
            type: Type.ARRAY, 
            nullable: true,
            items: { type: Type.OBJECT, properties: { key: { type: Type.STRING }, value: { type: Type.STRING } } }
        },
        suggestedRule: { type: Type.STRING }
      }
    };
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { inlineData: { mimeType: document.file.type, data: document.file.base64 } },
            { text: `Current Data: ${JSON.stringify(currentData)}. \n\nUser Feedback: ${userFeedback}.` }
        ],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: refineSchema
        }
      });
  
      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      const result = JSON.parse(cleanJsonString(text));

      // SMART MERGE: Only overwrite if the AI returned data
      const finalMappedData = result.updatedMappedData 
        ? { ...currentData.mappedData, ...result.updatedMappedData } 
        : currentData.mappedData;

      // Only replace line items if the AI explicitly returned a non-empty array
      // If AI returns [] (as requested for optimization), we keep the old items
      const finalLineItems = (result.updatedLineItems && result.updatedLineItems.length > 0)
        ? result.updatedLineItems
        : currentData.lineItems;

      const finalUnmappedData = result.updatedUnmappedData || currentData.unmappedData || [];

      return {
          updatedMappedData: finalMappedData,
          updatedLineItems: finalLineItems,
          updatedUnmappedData: finalUnmappedData,
          suggestedRule: result.suggestedRule || "Review extraction logic."
      };
    } catch (e) {
      console.error("Refinement failed", e);
      throw e;
    }
  };
