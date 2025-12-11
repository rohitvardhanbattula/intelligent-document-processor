
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import { pipeline, env } from '@xenova/transformers';
import { Document, TrainingRules, SchemaField, UsageMetadata, LineItem } from '../types';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

// Configure Transformers.js
// @ts-ignore
env.allowLocalModels = false; 
// @ts-ignore
env.useBrowserCache = true;   

let extractionPipeline: any = null;
const MODEL_NAME = 'Xenova/LaMini-Flan-T5-248M'; 

// --- IMAGE PRE-PROCESSING ---
const preprocessImage = (base64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = `data:image/png;base64,${base64}`;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64); return; }

            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                const val = gray > 160 ? 255 : data[i]; 
                data[i] = val;
                data[i + 1] = val;
                data[i + 2] = val;
            }
            
            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL('image/png').split(',')[1]);
        };
        img.onerror = (e) => reject(e);
    });
};

// --- PDF CONVERTER ---
const convertPdfToImage = async (base64Pdf: string): Promise<string> => {
    try {
        const binaryString = atob(base64Pdf);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1); 
        const scale = 2.0; 
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) throw new Error("Canvas context missing");

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        return canvas.toDataURL('image/png').split(',')[1];
    } catch (e) {
        console.error("PDF Conversion Failed", e);
        throw new Error("Failed to render PDF for OCR.");
    }
}

// --- TESSERACT OCR ---
const performOCR = async (base64Image: string, mimeType: string = 'image/png') => {
    console.log(`Starting Local OCR on ${mimeType}...`);
    try {
        const worker = await Tesseract.createWorker('eng', 1, {
            logger: m => console.log(`OCR Progress: ${m.status} (${(m.progress * 100).toFixed(0)}%)`)
        });
        
        await worker.setParameters({
            tessedit_pageseg_mode: '6', // Assume uniform block of text
            preserve_interword_spaces: '1',
        });

        const { data } = await worker.recognize(`data:${mimeType};base64,${base64Image}`);
        await worker.terminate();
        return data; 
    } catch (err) {
        console.error("Tesseract Error:", err);
        throw err;
    }
};

const reconstructSpatialText = (data: Tesseract.Page): string => {
    let spatialText = "";
    let totalWidth = 0;
    let charCount = 0;
    data.words.forEach(w => {
        totalWidth += (w.bbox.x1 - w.bbox.x0);
        charCount += w.text.length;
    });
    const avgCharWidth = (charCount > 0) ? (totalWidth / charCount) : 10;

    data.lines.forEach(line => {
        let currentLineStr = "";
        let currentX = line.bbox.x0; 

        line.words.forEach(word => {
            const gap = word.bbox.x0 - currentX;
            const spacesToInsert = Math.max(1, Math.floor(gap / avgCharWidth));
            
            if (gap > (avgCharWidth * 2)) {
                currentLineStr += " ".repeat(spacesToInsert);
            } else if (currentLineStr.length > 0) {
                 currentLineStr += " "; 
            }

            currentLineStr += word.text;
            currentX = word.bbox.x1;
        });
        
        spatialText += currentLineStr + "\n";
    });

    return spatialText;
};

// --- HELPER: Split Part Number from Description ---
const splitPartNo = (rawDesc: string) => {
    const firstSpace = rawDesc.indexOf(' ');
    if (firstSpace === -1) return { partNo: '', desc: rawDesc };

    const firstWord = rawDesc.substring(0, firstSpace);
    const isPartNo = (/\d/.test(firstWord) || firstWord.includes('-') || /^[A-Z0-9]+$/.test(firstWord)) 
                     && firstWord.length > 2 
                     && !['THE', 'ITEM', 'DESC', 'BILL', 'SHIP'].includes(firstWord.toUpperCase());

    if (isPartNo) {
        return { partNo: firstWord, desc: rawDesc.substring(firstSpace).trim() };
    }
    return { partNo: '', desc: rawDesc };
};

// --- ADVANCED LINE ITEM PARSER (Regex) ---
const parseDetailedLineItems = (text: string): LineItem[] => {
    const items: LineItem[] = [];
    const lines = text.split('\n');
    let lineCounter = 1;

    const richRegex = /^(.*?)\s+([$\d,]+\.\d{2})\s+([\d\.]+%?)\s+([$\d,]+\.\d{2})\s+(\d+)\s+([$\d,]+\.\d{2})$/;
    const standardRegex = /^(.*?)\s+([$\d,]+\.\d{2})?\s+(\d+)\s+([a-zA-Z]{1,4})?\s*([$\d,]+\.\d{2})$/;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length < 10) continue;
        if (/page\s+\d/i.test(trimmed)) continue;
        if (/subtotal|tax|vat|total amount|amount due/i.test(trimmed)) continue;

        let match = trimmed.match(richRegex);
        
        if (match) {
             const [_, rawDesc, priceStr, discount, adjPrice, qtyStr, amountStr] = match;
             const { partNo, desc } = splitPartNo(rawDesc.trim());
             
             items.push({
                 LineItem: String(lineCounter++),
                 VendorItemNumber: partNo || '',
                 ItemDescription: desc,
                 QuantityOrdered: parseInt(qtyStr),
                 UnitOfMeasure: 'EACH',
                 CostEach: parseFloat(priceStr.replace(/,/g, '')),
                 CostExtended: parseFloat(amountStr.replace(/,/g, '')),
                 // Extras
                 Discount: discount
             });
             continue;
        }

        match = trimmed.match(standardRegex);
        if (match) {
            const [_, rawDesc, priceStr, qtyStr, uom, amountStr] = match;
            
            if (rawDesc.trim().length > 3) {
                const { partNo, desc } = splitPartNo(rawDesc.trim());
                
                items.push({
                    LineItem: String(lineCounter++),
                    VendorItemNumber: partNo || '',
                    ItemDescription: desc,
                    QuantityOrdered: parseInt(qtyStr),
                    UnitOfMeasure: uom || 'EACH',
                    CostEach: priceStr ? parseFloat(priceStr.replace(/,/g, '')) : 0,
                    CostExtended: amountStr ? parseFloat(amountStr.replace(/,/g, '')) : 0
                });
            }
        }
    }
    
    return items;
};

// --- LLM HEADER EXTRACTOR ---
const transformersLlmExtractHeaders = async (spatialText: string, rules: TrainingRules): Promise<any> => {
    if (!extractionPipeline) {
        console.log(`Loading ${MODEL_NAME}...`);
        extractionPipeline = await pipeline('text2text-generation', MODEL_NAME);
    }

    const truncatedText = spatialText.substring(0, 1000); 
    const fields = rules.schema.map(f => f.name).join(', ');

    const prompt = `Extract these details from the invoice: ${fields}.
    
    Text:
    ${truncatedText}
    
    Return strict JSON format like {"po_number": "...", "date": "..."}.`;

    console.log("Running In-Browser LLM for Headers...");
    const output = await extractionPipeline(prompt, {
        max_new_tokens: 150,
        temperature: 0.1,
        do_sample: false
    });

    const generatedText = output[0]?.generated_text || "{}";
    const jsonStart = generatedText.indexOf('{');
    const jsonEnd = generatedText.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
            return JSON.parse(generatedText.substring(jsonStart, jsonEnd + 1));
        } catch(e) { console.warn("LLM JSON Parse Error", e); }
    }
    return null; 
};


// --- REGEX HEADER EXTRACTOR (Fallback) ---
const ALIAS_MAP: Record<string, string[]> = {
    'po_number': ['PO Number', 'Purchase Order', 'Order No', 'PO #', 'P.O.', 'Order Number', 'Reference No'],
    'customer_name': ['Customer', 'Bill To', 'Sold To', 'Client', 'Billed To'],
    'total_amount': ['Total', 'Grand Total', 'Total Amount', 'Amount Due', 'Balance', 'Total Incl'],
    'order_date': ['Date', 'Order Date', 'Invoice Date', 'Dated', 'Issue Date'],
    'delivery_address': ['Ship To', 'Delivery Address', 'Shipping Address', 'Destination', 'Consignee']
};

const regexExtractHeaders = (text: string, schema: SchemaField[]): Record<string, any> => {
    const mappedData: Record<string, any> = {};
    schema.forEach(field => {
        const potentialLabels = ALIAS_MAP[field.name] || [field.name, field.name.replace(/_/g, ' ')];
        for (const label of potentialLabels) {
            const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`${safeLabel}[:\\s\\-\\.]*([^\\n]+)`, 'i');
            const match = text.match(regex);
            if (match && match[1]) {
                let val = match[1].trim();
                if (field.type === 'number') {
                    const numberMatch = val.match(/[\d,]+\.?\d*/);
                    if (numberMatch) {
                        const cleanNum = parseFloat(numberMatch[0].replace(/,/g, ''));
                        if (!isNaN(cleanNum)) { mappedData[field.name] = cleanNum; break; }
                    }
                } else {
                    val = val.replace(/^[:\.\-]\s*/, '');
                    if (val.length > 0) { mappedData[field.name] = val; break; }
                }
            }
        }
    });
    return mappedData;
};

// --- MAIN EXPORT ---
export const extractLocally = async (
    document: Document,
    rules: TrainingRules,
    useLlm: boolean
): Promise<{ 
    mappedData: Record<string, any>; 
    lineItems: LineItem[];
    unmappedData: { key: string; value: string | number }[];
    termsAndConditions: string;
    confidence: Record<string, number>;
    usageMetadata: UsageMetadata;
}> => {

    let spatialText = "";
    let rawText = "";

    try {
        let base64ForOcr = document.file.base64;
        let mimeType = document.file.type;

        if (mimeType === 'application/pdf') {
             console.log("Converting PDF to Image...");
             base64ForOcr = await convertPdfToImage(document.file.base64);
             mimeType = 'image/png';
        }

        const processedImage = await preprocessImage(base64ForOcr);
        const ocrData = await performOCR(processedImage, mimeType);
        
        spatialText = reconstructSpatialText(ocrData);
        rawText = ocrData.text; 

    } catch (e) {
        console.error("OCR Pipeline Failed", e);
        return { 
            mappedData: {}, 
            lineItems: [],
            unmappedData: [{ key: "error", value: "OCR Failed: " + (e as Error).message }], 
            termsAndConditions: "OCR Failed", 
            confidence: {},
            usageMetadata: { inputTokens: 0, outputTokens: 0, totalTokens: 0, modelName: 'Error', estimatedCost: 0 }
        };
    }

    // 1. EXTRACT HEADERS (Try LLM -> Fallback Regex)
    let mappedData: Record<string, any> = {};
    if (useLlm) {
        try {
            const llmHeaders = await transformersLlmExtractHeaders(spatialText, rules);
            if (llmHeaders && Object.keys(llmHeaders).length > 0) {
                mappedData = llmHeaders;
            } else {
                mappedData = regexExtractHeaders(rawText, rules.schema);
            }
        } catch (e) {
            mappedData = regexExtractHeaders(rawText, rules.schema);
        }
    } else {
        mappedData = regexExtractHeaders(rawText, rules.schema);
    }

    // 2. EXTRACT LINE ITEMS
    const lineItems = parseDetailedLineItems(spatialText);

    return {
        mappedData,
        lineItems,
        unmappedData: [],
        termsAndConditions: "",
        confidence: {},
        usageMetadata: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            modelName: useLlm ? 'LaMini-Flan-T5 (Local)' : 'Tesseract (Local)',
            estimatedCost: 0
        }
    };
};
