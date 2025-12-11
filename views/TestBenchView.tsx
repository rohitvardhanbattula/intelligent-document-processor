
import React, { useState } from 'react';
import { searchCustomers, checkERPDuplication } from '../services/erpService';
import { SapCustomer } from '../types';
import { ICONS } from '../constants';

const TestBenchView: React.FC = () => {
    // Customer Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [customerResults, setCustomerResults] = useState<SapCustomer[]>([]);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [customerError, setCustomerError] = useState<string | null>(null);
    const [customerDebugUrl, setCustomerDebugUrl] = useState<string | null>(null);

    // PO Check State
    const [poQuery, setPoQuery] = useState('');
    const [poResult, setPoResult] = useState<{ exists: boolean; details?: string } | null>(null);
    const [poLoading, setPoLoading] = useState(false);
    const [poDebugUrl, setPoDebugUrl] = useState<string | null>(null);

    const handleCustomerSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setCustomerLoading(true);
        setCustomerError(null);
        setCustomerResults([]);
        setCustomerDebugUrl(null);
        
        try {
            const { results, debugUrl, error } = await searchCustomers({ name: searchQuery });
            setCustomerResults(results);
            setCustomerDebugUrl(debugUrl || null);
            
            if (error) {
                setCustomerError(error);
            } else if (results.length === 0) {
                setCustomerError("No results found in SAP.");
            }
        } catch (err: any) {
            setCustomerError(err.message || "An unknown error occurred");
        } finally {
            setCustomerLoading(false);
        }
    };

    const handlePoCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        setPoLoading(true);
        setPoResult(null);
        setPoDebugUrl(null);
        
        try {
            const result = await checkERPDuplication(poQuery);
            setPoResult(result);
            if(result.debugUrl) setPoDebugUrl(result.debugUrl);
        } catch (err) {
            console.error(err);
        } finally {
            setPoLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto min-h-full bg-slate-50 dark:bg-slate-900">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    <span>Developer Test Bench</span>
                </h2>
                <p className="text-slate-500 mt-2">
                    Isolated testing environment for SAP OData services. Use this to verify your proxy and paths.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 1. Customer Search Tester */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                        Customer Search API
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                        Tests the <code className="bg-slate-100 px-1 rounded">API_BUSINESS_PARTNER</code> service mapping.
                    </p>

                    <form onSubmit={handleCustomerSearch} className="flex gap-2 mb-6">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Enter Customer Name (e.g., Barbara)"
                            className="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded"
                        />
                        <button 
                            type="submit" 
                            disabled={!searchQuery || customerLoading}
                            className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50"
                        >
                            {customerLoading ? 'Searching...' : 'Search'}
                        </button>
                    </form>

                    {customerDebugUrl && (
                        <div className="mb-4 p-2 bg-slate-100 dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-600 overflow-x-auto">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Requested URL (Proxy):</span>
                            <code className="text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">{customerDebugUrl}</code>
                        </div>
                    )}

                    {customerError && (
                        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded mb-4 text-sm break-all">
                            {customerError}
                        </div>
                    )}

                    <div className="bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 h-64 overflow-y-auto p-4 custom-scrollbar">
                        {customerResults.length > 0 ? (
                            <div className="space-y-3">
                                {customerResults.map((cust, idx) => (
                                    <div key={idx} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-blue-700 dark:text-blue-400">{cust.CustomerName}</span>
                                            <span className="text-xs font-mono text-slate-400">{cust.BusinessPartner}</span>
                                        </div>
                                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                            {cust.StreetName && <span>{cust.StreetName}, </span>}
                                            {cust.CityName}, {cust.Country} {cust.PostalCode}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                                {customerLoading ? 'Waiting for response...' : 'Results will appear here'}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. PO Duplication Check Tester */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                        PO Duplication Check
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                        Tests the pre-check logic for existing Purchase Orders in SAP.
                    </p>

                    <form onSubmit={handlePoCheck} className="flex gap-2 mb-6">
                        <input
                            type="text"
                            value={poQuery}
                            onChange={(e) => setPoQuery(e.target.value)}
                            placeholder="Enter PO Number (e.g. 4500012399)"
                            className="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded"
                        />
                        <button 
                            type="submit" 
                            disabled={!poQuery || poLoading}
                            className="bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700 disabled:opacity-50"
                        >
                            {poLoading ? 'Checking...' : 'Check'}
                        </button>
                    </form>

                    {poDebugUrl && (
                        <div className="mb-4 p-2 bg-slate-100 dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-600 overflow-x-auto">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Requested URL (Proxy):</span>
                            <code className="text-xs text-purple-600 dark:text-purple-400 whitespace-nowrap">{poDebugUrl}</code>
                        </div>
                    )}

                    <div className="bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 p-4 min-h-[100px] flex items-center justify-center">
                        {poResult ? (
                            <div className={`text-center ${poResult.exists ? 'text-red-600' : 'text-green-600'}`}>
                                <div className="text-2xl mb-1">{poResult.exists ? '⚠️ Found' : '✅ Available'}</div>
                                <div className="font-bold">{poResult.exists ? 'Duplicate Detected' : 'No Duplicate Found'}</div>
                                {poResult.details && <div className="text-xs mt-2 text-slate-600">{poResult.details}</div>}
                            </div>
                        ) : (
                            <div className="text-slate-400 italic text-sm">Status will appear here</div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TestBenchView;
