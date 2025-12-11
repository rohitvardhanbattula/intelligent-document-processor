
import React, { useState, useEffect } from 'react';
import { SystemSettings, ExtractionEngine } from '../types';
import { loadSettings, saveSettings } from '../services/settingsService';
import { ICONS } from '../constants';

const SettingsView: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings>({
        sapBaseUrl: '',
        customerServicePath: '',
        orderServicePath: '',
        sapUsername: '',
        sapPassword: '',
        extractionEngine: 'gemini-cloud',
        bypassProxy: false
    });
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const loaded = loadSettings();
        setSettings(loaded);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target;
        const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
        const name = target.name;
        
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage(null);

        try {
            saveSettings(settings);
            // Simulate a short delay to give feedback
            setTimeout(() => {
                setMessage({ type: 'success', text: 'System settings saved successfully.' });
                setIsSaving(false);
            }, 500);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save settings to local storage.' });
            setIsSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto min-h-full">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    {ICONS.settings}
                    <span>System Configuration</span>
                </h2>
                <p className="text-slate-500 mt-2">
                    Configure connection details for your SAP S/4HANA Cloud instance and AI extraction preferences.
                </p>
            </div>

            <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                
                {/* AI Engine Selection */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-blue-50/30 dark:bg-blue-900/10">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">AI Extraction Engine</h3>
                    <div className="grid gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Processing Strategy
                            </label>
                            <select
                                name="extractionEngine"
                                value={settings.extractionEngine}
                                onChange={handleChange}
                                className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <option value="gemini-cloud">Google Gemini Cloud API (Recommended - Highest Accuracy)</option>
                                <option value="tesseract-local">Local Tesseract OCR (Rule-based, Privacy focused)</option>
                                <option value="chrome-device-llm">On-Device LLM (Tesseract + Chrome Built-in AI)</option>
                            </select>
                            <div className="mt-2 text-xs text-slate-500 space-y-1">
                                <p><strong>Gemini Cloud:</strong> Uses Google's most powerful models. Requires internet.</p>
                                <p><strong>Tesseract Local:</strong> Performs OCR in your browser. Uses simple keyword matching. Fast, works offline, lower accuracy.</p>
                                <p><strong>On-Device LLM:</strong> Uses 'Gemini Nano' in Chrome (Experimental). Requires Chrome Canary with AI enabled. No data leaves device.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SAP Connectivity Section */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">SAP S/4HANA Connectivity</h3>
                    
                    <div className="grid gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                SAP Base URL
                            </label>
                            <input
                                type="url"
                                name="sapBaseUrl"
                                value={settings.sapBaseUrl}
                                onChange={handleChange}
                                placeholder="https://my-sap-instance.com"
                                className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <p className="text-xs text-slate-500 mt-1">The root URL of your SAP instance.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Customer Lookup Service Path
                                </label>
                                <input
                                    type="text"
                                    name="customerServicePath"
                                    value={settings.customerServicePath}
                                    onChange={handleChange}
                                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">OData endpoint for Business Partners.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Order Service Path
                                </label>
                                <input
                                    type="text"
                                    name="orderServicePath"
                                    value={settings.orderServicePath}
                                    onChange={handleChange}
                                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">OData endpoint for Sales Orders.</p>
                            </div>
                        </div>

                        {/* Bypass Proxy Option */}
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded border border-amber-200 dark:border-amber-800">
                             <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="bypassProxy"
                                    name="bypassProxy"
                                    checked={settings.bypassProxy}
                                    onChange={handleChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                                />
                                <label htmlFor="bypassProxy" className="ml-2 block text-sm font-bold text-slate-900 dark:text-slate-200 cursor-pointer">
                                    Bypass Proxy (Direct Call to SAP)
                                </label>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 ml-6">
                                Enable this when deployed in an environment without a backend proxy, or to test direct connectivity. 
                                <br/>
                                <span className="font-semibold text-amber-700 dark:text-amber-500">Note:</span> Your SAP server must support CORS (Cross-Origin Resource Sharing) for this to work from a browser.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Credentials Section */}
                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Authentication</h3>
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded-r mb-6">
                         <div className="flex">
                            <div className="ml-3">
                                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                    Credentials are saved locally in your browser with basic obfuscation. 
                                    For production use, ensure this application is behind a secure proxy or uses OAuth.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                User ID
                            </label>
                            <input
                                type="text"
                                name="sapUsername"
                                value={settings.sapUsername}
                                onChange={handleChange}
                                autoComplete="off"
                                className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                name="sapPassword"
                                value={settings.sapPassword}
                                onChange={handleChange}
                                autoComplete="new-password"
                                className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer / Actions */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                     <div>
                        {message && (
                            <span className={`text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {message.text}
                            </span>
                        )}
                     </div>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-6 rounded shadow-sm hover:shadow transition-all disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SettingsView;