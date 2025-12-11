
import { SapCustomer } from "../types";
import { loadSettings, getBasicAuthHeader } from "./settingsService";

// Helper to determine if we should treat this as a proxy error or a data not found error
const isTechnicalError = (status: number, contentType: string | null) => {
    // 404 HTML usually means the proxy target wasn't found (wrong path), not "Customer Not Found"
    if (status === 404 && contentType && contentType.includes("text/html")) return true;
    if (status === 500 || status === 502 || status === 503 || status === 504) return true;
    return false;
};

// --- LOGGING HELPER ---
// Since we can't see server logs in AI Studio, we log heavily here.
async function fetchWithRetry(
    initialUrl: string, 
    servicePath: string, 
    queryPart: string, 
    authHeader: string
): Promise<{ response: Response, finalUrl: string }> {
    
    // Construct the full URL the browser is hitting (e.g., https://your-app.com/sap/...)
    // If initialUrl is absolute (http...), new URL(initialUrl, origin) returns initialUrl.
    const fullBrowserUrl = new URL(initialUrl, window.location.origin).href;
    console.groupCollapsed(`🌐 API Request: ${initialUrl}`);
    console.log(`Full Browser URL: ${fullBrowserUrl}`);
    console.log(`Auth Header Present: ${!!authHeader}`);

    let response = await fetch(initialUrl, {
        method: 'GET',
        headers: { 'Authorization': authHeader || '', 'Accept': 'application/json' },
        credentials: 'omit', // Do not send cookies
        // referrerPolicy removed to allow browser default (sending Referer)
    });

    console.log(`Attempt 1 Status: ${response.status}`);

    // Bi-directional Retry Logic for 404s (Toggle _SRV)
    if (response.status === 404) {
        let altServicePath = '';
        let action = '';

        if (servicePath.endsWith('_SRV')) {
            altServicePath = servicePath.substring(0, servicePath.length - 4);
            action = "Removing '_SRV'";
        } else {
            altServicePath = `${servicePath}_SRV`;
            action = "Adding '_SRV'";
        }

        const altUrl = `${altServicePath}${queryPart}`;
        // Note: new URL(absoluteUrl, base) ignores base, so this works for both relative and absolute paths
        const fullAltUrl = new URL(altUrl, window.location.origin).href;
        
        console.warn(`404 detected. ${action} and retrying...`);
        console.log(`Retry URL: ${fullAltUrl}`);
        
        const retryResponse = await fetch(altUrl, {
            method: 'GET',
            headers: { 'Authorization': authHeader || '', 'Accept': 'application/json' },
            credentials: 'omit',
        });

        console.log(`Attempt 2 Status: ${retryResponse.status}`);

        if (retryResponse.status !== 404 || retryResponse.ok) {
            console.groupEnd();
            return { response: retryResponse, finalUrl: fullAltUrl };
        }
    }

    console.groupEnd();
    return { response, finalUrl: fullBrowserUrl };
}

export const checkERPDuplication = async (poNumber: string | undefined): Promise<{ exists: boolean; details?: string; debugUrl?: string }> => {
  if (!poNumber) return { exists: false };

  const settings = loadSettings();
  if (settings.sapBaseUrl && settings.sapUsername && settings.sapPassword) {
      try {
        const authHeader = getBasicAuthHeader(settings);
        let servicePath = settings.orderServicePath;

        // Clean up base URL
        const baseUrl = settings.sapBaseUrl ? settings.sapBaseUrl.replace(/\/$/, '') : '';

        if (settings.bypassProxy) {
            // --- BYPASS PROXY MODE ---
            // Ensure we are using the absolute URL
            if (!servicePath.startsWith('http')) {
                // Remove leading slash if baseUrl is used
                const cleanPath = servicePath.startsWith('/') ? servicePath : `/${servicePath}`;
                
                // Add /sap/opu... if missing
                if (!cleanPath.includes('/sap/opu/odata')) {
                     servicePath = `${baseUrl}/sap/opu/odata/sap${cleanPath.startsWith('/sap') ? cleanPath.substring(4) : cleanPath}`;
                } else {
                     servicePath = `${baseUrl}${cleanPath}`;
                }
            }
        } else {
            // --- PROXY MODE ---
            // Ensure relative path
            if (servicePath.startsWith('http')) {
                // If user pasted absolute URL but wants proxy, strip domain
                try {
                    const urlObj = new URL(servicePath);
                    servicePath = urlObj.pathname;
                } catch(e) {}
            }
            if (!servicePath.startsWith('/')) servicePath = `/${servicePath}`;
            if (!servicePath.startsWith('/sap')) servicePath = `/sap/opu/odata/sap${servicePath}`;
        }
        
        if (servicePath.endsWith('/')) servicePath = servicePath.slice(0, -1);

        const queryPart = `/A_SalesOrder?$format=json&$filter=PurchaseOrderByCustomer eq '${poNumber}'&$top=1`;
        const url = `${servicePath}${queryPart}`;
        
        const { response, finalUrl } = await fetchWithRetry(url, servicePath, queryPart, authHeader || '');

        if (response.ok) {
            const data = await response.json();
            const results = data.d ? (data.d.results || data.d) : (data.value || []);
            
            if (results.length > 0) {
                 const order = results[0];
                 return {
                     exists: true,
                     details: `Sales Order ${order.SalesOrder} already exists for PO ${poNumber}. Created: ${order.CreationDate}`,
                     debugUrl: finalUrl
                 };
            }
            return { exists: false, debugUrl: finalUrl }; 
        } else {
            return { exists: false, debugUrl: finalUrl, details: `Error: ${response.status} ${response.statusText}` };
        }
      } catch (e: any) {
          console.warn("ERP Proxy check failed.", e);
          const isNetworkError = e.message === 'Failed to fetch' || e.name === 'TypeError';
          const hint = isNetworkError && settings.bypassProxy ? " (Check CORS or HTTPS/HTTP mismatch)" : "";
          return { exists: false, details: `Network Error: ${e.message}${hint}` };
      }
  }

  // Mock Fallback
  await new Promise(resolve => setTimeout(resolve, 800));
  if (poNumber.endsWith('99') || poNumber.endsWith('00') || poNumber === '4500012345') {
    return {
      exists: true,
      details: `PO ${poNumber} was posted on ${new Date().toLocaleDateString()} by User SYSTEM (Mock).`
    };
  }
  return { exists: false };
};

export const searchCustomers = async (query: { name?: string; city?: string; country?: string }): Promise<{ results: SapCustomer[], debugUrl?: string, error?: string }> => {
  const settings = loadSettings();
  
  if (settings.sapBaseUrl && settings.sapUsername && settings.sapPassword && query.name) {
      try {
        const authHeader = getBasicAuthHeader(settings);
        let servicePath = settings.customerServicePath;
        const baseUrl = settings.sapBaseUrl ? settings.sapBaseUrl.replace(/\/$/, '') : '';
        
        if (settings.bypassProxy) {
            // --- BYPASS PROXY MODE ---
             if (!servicePath.startsWith('http')) {
                const cleanPath = servicePath.startsWith('/') ? servicePath : `/${servicePath}`;
                if (!cleanPath.includes('/sap/opu/odata')) {
                     servicePath = `${baseUrl}/sap/opu/odata/sap${cleanPath.startsWith('/sap') ? cleanPath.substring(4) : cleanPath}`;
                } else {
                     servicePath = `${baseUrl}${cleanPath}`;
                }
             }
        } else {
             // --- PROXY MODE ---
             if (servicePath.startsWith('http')) {
                try {
                    const urlObj = new URL(servicePath);
                    servicePath = urlObj.pathname;
                } catch (e) { }
            }
            if (!servicePath.startsWith('/')) servicePath = `/${servicePath}`;
            if (!servicePath.startsWith('/sap')) servicePath = `/sap/opu/odata/sap${servicePath}`;
        }

        if (servicePath.endsWith('/')) servicePath = servicePath.slice(0, -1);

        const encodedName = encodeURIComponent(query.name);
        const exactFilter = `$filter=BusinessPartnerFullName eq '${encodedName}'`;
        const queryPart = `/A_BusinessPartner?$format=json&${exactFilter}&$expand=to_BusinessPartnerAddress`;
        const url = `${servicePath}${queryPart}`;
        
        const { response, finalUrl } = await fetchWithRetry(url, servicePath, queryPart, authHeader || '');
        const contentType = response.headers.get("content-type");

        if (response.ok) {
            const data = await response.json();
            const results = data.d ? (Array.isArray(data.d) ? data.d : (data.d.results || [])) : (data.value || []);
            
            const mapped = results.map((bp: any) => {
                const addresses = bp.to_BusinessPartnerAddress?.results || (bp.to_BusinessPartnerAddress ? [bp.to_BusinessPartnerAddress] : []);
                const address = addresses.length > 0 ? addresses[0] : {};

                return {
                    BusinessPartner: bp.BusinessPartner,
                    CustomerName: bp.BusinessPartnerFullName || bp.BusinessPartnerName || '',
                    CityName: address.CityName || '',
                    Country: address.Country || '',
                    PostalCode: address.PostalCode || '',
                    StreetName: address.StreetName || ''
                };
            });
            return { results: mapped, debugUrl: finalUrl };

        } else if (isTechnicalError(response.status, contentType)) {
            return { results: [], debugUrl: finalUrl, error: `Proxy Error ${response.status}: Target unreachable or path incorrect.` };
        } else {
            return { results: [], debugUrl: finalUrl, error: `SAP API Error ${response.status}` };
        }
      } catch (error: any) {
          console.error("[Proxy Network Error]:", error);
          const isNetworkError = error.message === 'Failed to fetch' || error.name === 'TypeError';
          const hint = isNetworkError && settings.bypassProxy ? " (Check CORS headers on SAP server)" : "";
          return { results: [], error: `Network Exception: ${error.message}${hint}` };
      }
  }

  // Fallback Mock Data
  console.log("⚠️ Proxy failed or not configured. Using Mock Data.");
  await new Promise(resolve => setTimeout(resolve, 600));

  const mockCustomers: SapCustomer[] = [
    { BusinessPartner: '1000001', CustomerName: 'Acme Corp', CityName: 'New York', Country: 'US', PostalCode: '10001', StreetName: '5th Avenue' },
    { BusinessPartner: '1000002', CustomerName: 'Globex Corp', CityName: 'Berlin', Country: 'DE', PostalCode: '10115', StreetName: 'Torstrasse' },
    { BusinessPartner: '1000003', CustomerName: 'Soylent Corp', CityName: 'Chicago', Country: 'US', PostalCode: '60601', StreetName: 'Michigan Ave' },
    { BusinessPartner: '1000004', CustomerName: 'Umbrella Corp', CityName: 'Raccoon City', Country: 'US', PostalCode: '99999', StreetName: 'Main St' },
    { BusinessPartner: '1000005', CustomerName: 'Stark Industries', CityName: 'Malibu', Country: 'US', PostalCode: '90265', StreetName: 'Cliffside Dr' },
    { BusinessPartner: '1000006', CustomerName: 'Wayne Enterprises', CityName: 'Gotham', Country: 'US', PostalCode: '12345', StreetName: 'Wayne Tower' },
  ];

  if (!query.name && !query.city) return { results: mockCustomers.slice(0, 5) };

  const filtered = mockCustomers.filter(c => {
    const nameMatch = !query.name || c.CustomerName.toLowerCase().includes(query.name.toLowerCase());
    const cityMatch = !query.city || c.CityName.toLowerCase().includes(query.city.toLowerCase());
    const countryMatch = !query.country || c.Country.toLowerCase() === query.country.toLowerCase();
    return nameMatch && cityMatch && countryMatch;
  });

  return { results: filtered, error: "Using Mock Data (Check Settings)" };
};