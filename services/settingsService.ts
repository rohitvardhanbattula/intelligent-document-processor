
import { SystemSettings } from "../types";
import { DEFAULT_SAP_PATHS } from "../constants";

const STORAGE_KEY = 'idp_system_settings';

// Simple obfuscation to avoid storing cleartext password in LocalStorage.
// Note: This is NOT secure encryption. In a production environment, use a backend proxy or proper OAuth flows.
const obfuscate = (str: string): string => {
    return btoa(str.split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ 123)).join(''));
};

const deobfuscate = (str: string): string => {
    try {
        return atob(str).split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ 123)).join('');
    } catch (e) {
        return '';
    }
};

export const loadSettings = (): SystemSettings => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Deobfuscate password if present
            if (parsed.sapPassword) {
                parsed.sapPassword = deobfuscate(parsed.sapPassword);
            }
            return {
                sapBaseUrl: parsed.sapBaseUrl || '',
                customerServicePath: parsed.customerServicePath || DEFAULT_SAP_PATHS.CUSTOMER_SERVICE,
                orderServicePath: parsed.orderServicePath || DEFAULT_SAP_PATHS.ORDER_SERVICE,
                sapUsername: parsed.sapUsername || '',
                sapPassword: parsed.sapPassword || '',
                extractionEngine: parsed.extractionEngine || 'gemini-cloud',
                bypassProxy: parsed.bypassProxy || false
            };
        }
    } catch (e) {
        console.error("Failed to load settings", e);
    }
    
    // Default values
    return {
        sapBaseUrl: '',
        customerServicePath: DEFAULT_SAP_PATHS.CUSTOMER_SERVICE,
        orderServicePath: DEFAULT_SAP_PATHS.ORDER_SERVICE,
        sapUsername: '',
        sapPassword: '',
        extractionEngine: 'gemini-cloud',
        bypassProxy: false
    };
};

export const saveSettings = (settings: SystemSettings) => {
    try {
        const toStore = { ...settings };
        // Obfuscate password before saving
        if (toStore.sapPassword) {
            toStore.sapPassword = obfuscate(toStore.sapPassword);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (e) {
        console.error("Failed to save settings", e);
        throw e;
    }
};

export const getBasicAuthHeader = (settings: SystemSettings): string | null => {
    if (settings.sapUsername && settings.sapPassword) {
        return 'Basic ' + btoa(settings.sapUsername + ':' + settings.sapPassword);
    }
    return null;
};