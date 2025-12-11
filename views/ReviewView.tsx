
import React, { useState, useEffect } from 'react';
import { Document, DocumentStatus, TrainingRules, UserRole, SapCustomer, LineItem, ExtractionRule } from '../types';
import { ICONS, getTagColor } from '../constants';
import { refineDataWithFeedback } from '../services/geminiService';
import { searchCustomers } from '../services/erpService';

interface ReviewViewProps {
  document: Document | undefined;
  userRole?: UserRole; 
  currentRules?: TrainingRules;
  onSave: (docId: string, updatedMappedData: Record<string, any>, updatedUnmappedData: { key: string; value: string | number }[]) => void;
  onPost: (docId: string) => void;
  onBack: () => void;
  onPromoteRule?: (newRule: string) => void;
  onUpdateTags?: (docId: string, tags: string[]) => void;
}

const Spinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

const ReviewView: React.FC<ReviewViewProps> = ({ 
    document, 
    userRole = UserRole.EndUser,
    currentRules,
    onSave, 
    onPost, 
    onBack,
    onPromoteRule,
    onUpdateTags
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [unmappedData, setUnmappedData] = useState<{ key: string; value: string | number }[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [activeTab, setActiveTab] = useState<'mapped' | 'lineItems' | 'unmapped' | 'terms' | 'assistant' | 'trace' | 'context'>('mapped');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [zoomMode, setZoomMode] = useState<'fit' | 'original'>('fit');
  
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const [feedbackInput, setFeedbackInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [suggestedRule, setSuggestedRule] = useState<string | null>(null);
  
  // Initialize with auto-linked customer if present
  const [selectedCustomer, setSelectedCustomer] = useState<SapCustomer | null>(document?.sapCustomerMatch || null);
  const [autoMatchConfidence, setAutoMatchConfidence] = useState<'none' | 'exact'>(document?.sapCustomerMatch ? 'exact' : 'none');

  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<SapCustomer[]>([]);
  
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const isPosting = document?.status === DocumentStatus.Posting;

  // Derive Applied Rules
  const appliedRules = (currentRules?.conditionalRules || []).filter(r => document?.appliedRuleIds?.includes(r.id));

  useEffect(() => {
    if (document) {
      setFormData(document.mappedData);
      setUnmappedData(document.unmappedData || []);
      setLineItems(document.lineItems || []);
      setSuggestedRule(null);
      // Ensure we use the latest match status from document if prop updates
      if (document.sapCustomerMatch) {
          setSelectedCustomer(document.sapCustomerMatch);
          setAutoMatchConfidence('exact');
      }

      if(document.lastModifiedAt) {
          setLastSaved(new Date(document.lastModifiedAt).toLocaleTimeString());
      }

      if (document.file.type === 'application/pdf') {
        try {
          const byteCharacters = atob(document.file.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);

          return () => {
            URL.revokeObjectURL(url);
          };
        } catch (error) {
          console.error("Error creating PDF blob:", error);
          setPdfUrl(null);
        }
      } else {
        setPdfUrl(null);
      }
    }
  }, [document]);

  // Only perform auto-lookup if we don't already have a match
  useEffect(() => {
      if (formData && Object.keys(formData).length > 0 && !selectedCustomer && !document?.sapCustomerMatch) {
          performAutoLookup();
      }
  }, [formData]); 

  const performAutoLookup = async () => {
      const nameKey = Object.keys(formData).find(k => k.toLowerCase().includes('customer') || k.toLowerCase().includes('name'));
      const cityKey = Object.keys(formData).find(k => k.toLowerCase().includes('city') || k.toLowerCase().includes('address'));
      const countryKey = Object.keys(formData).find(k => k.toLowerCase().includes('country'));

      const searchCriteria = {
          name: nameKey ? String(formData[nameKey]) : '',
          city: cityKey ? String(formData[cityKey]) : '',
          country: countryKey ? String(formData[countryKey]) : ''
      };

      if (searchCriteria.name) {
          setIsSearchingCustomer(true);
          try {
              const { results } = await searchCustomers(searchCriteria);
              
              const exactMatch = results.find(c => 
                  c.CustomerName.toLowerCase() === searchCriteria.name.toLowerCase() &&
                  (searchCriteria.city ? c.CityName.toLowerCase().includes(searchCriteria.city.toLowerCase()) : true)
              );

              if (exactMatch) {
                  setSelectedCustomer(exactMatch);
                  setAutoMatchConfidence('exact');
                  setFormData(prev => ({...prev, customer_id: exactMatch.BusinessPartner}));
              } else {
                   setAutoMatchConfidence('none');
              }
          } catch (e) {
              console.error("Auto lookup failed", e);
          } finally {
              setIsSearchingCustomer(false);
          }
      }
  };

  const handleManualSearch = async () => {
      setIsSearchingCustomer(true);
      try {
          const { results } = await searchCustomers({ name: customerSearchQuery });
          setCustomerSearchResults(results);
      } catch (e) {
          console.error("Manual search failed", e);
      } finally {
          setIsSearchingCustomer(false);
      }
  };

  const selectCustomer = (cust: SapCustomer) => {
      setSelectedCustomer(cust);
      setFormData(prev => ({...prev, customer_id: cust.BusinessPartner}));
      setShowCustomerModal(false);
      setAutoMatchConfidence('exact'); 
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
  };

  const handleLineItemChange = (index: number, field: string, value: string | number) => {
      const newItems = [...lineItems];
      newItems[index] = { ...newItems[index], [field]: value };
      setLineItems(newItems);
  };

  const handleUnmappedChange = (index: number, field: 'key' | 'value', newValue: string) => {
    const newData = [...unmappedData];
    newData[index] = { ...newData[index], [field]: newValue };
    setUnmappedData(newData);
  };

  const addUnmappedField = () => {
    setUnmappedData([...unmappedData, { key: '', value: '' }]);
  };

  const removeUnmappedField = (index: number) => {
    setUnmappedData(unmappedData.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if(document) {
      onSave(document.id, formData, unmappedData);
      setLastSaved(new Date().toLocaleTimeString());
    }
  }

  const handlePost = () => {
    if(document) {
      onSave(document.id, formData, unmappedData);
      onPost(document.id);
    }
  }

  const handleAIFeedback = async () => {
      if (!document || !feedbackInput.trim() || !currentRules) return;
      
      setIsRefining(true);
      setSuggestedRule(null);
      
      try {
          const result = await refineDataWithFeedback(
              document, 
              { mappedData: formData, lineItems, unmappedData }, 
              feedbackInput, 
              currentRules
          );
          
          setFormData(result.updatedMappedData);
          setLineItems(result.updatedLineItems || []);
          setUnmappedData(result.updatedUnmappedData);
          setSuggestedRule(result.suggestedRule);
          setFeedbackInput('');
      } catch (e: any) {
          console.error(e);
          alert(`Failed to refine data.\n\nError: ${e.message || "Unknown error"}`);
      } finally {
          setIsRefining(false);
      }
  };

  const handlePromoteRule = () => {
      if (suggestedRule && onPromoteRule) {
          onPromoteRule(suggestedRule);
          setSuggestedRule(null); 
      }
  };

  const handleAddTag = () => {
      const val = tagInput.trim();
      if(val && document && onUpdateTags) {
          const current = document.tags || [];
          if(!current.includes(val)) {
            onUpdateTags(document.id, [...current, val]);
          }
          setTagInput('');
          setShowTagInput(false);
      }
  };

  const handleRemoveTag = (tagToRemove: string) => {
      if(document && onUpdateTags) {
          const current = document.tags || [];
          onUpdateTags(document.id, current.filter(t => t !== tagToRemove));
      }
  }

  const renderPreview = () => {
    if (!document) return null;
    const { type, base64 } = document.file;
    const dataUrl = `data:${type};base64,${base64}`;

    if (type.startsWith('image/')) {
        return (
            <div className="w-full h-full flex flex-col">
                 <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-700 px-4 py-2 border-b border-slate-200 dark:border-slate-600 flex-shrink-0">
                    <span className="text-xs font-bold text-slate-500 uppercase">Image View</span>
                    <div className="flex space-x-1 bg-white dark:bg-slate-800 rounded p-0.5 border border-slate-300 dark:border-slate-600">
                        <button 
                            onClick={() => setZoomMode('fit')}
                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-colors ${zoomMode === 'fit' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            Fit Width
                        </button>
                        <button 
                            onClick={() => setZoomMode('original')}
                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-colors ${zoomMode === 'original' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            Original Size
                        </button>
                    </div>
                 </div>
                 <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-900 flex justify-center items-start p-4 custom-scrollbar">
                    <img 
                        src={dataUrl} 
                        alt="Document Preview" 
                        className={`shadow-md transition-all duration-200 ${zoomMode === 'fit' ? 'w-full object-contain max-h-none' : 'max-w-none w-auto'}`}
                        style={{ display: 'block' }}
                    />
                </div>
            </div>
        );
    } else if (type === 'application/pdf') {
        return (
            <div className="w-full h-full bg-slate-200 dark:bg-slate-900 rounded-md overflow-hidden relative flex flex-col">
                {pdfUrl ? (
                    <iframe 
                        src={pdfUrl} 
                        className="w-full h-full border-none flex-1" 
                        title="PDF Document Preview"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        <p>Loading PDF preview...</p>
                    </div>
                )}
            </div>
        );
    } else {
        return (
            <div className="flex items-center justify-center h-full text-slate-500 bg-slate-100 dark:bg-slate-700 rounded-md">
                <p>Preview not available for {type}</p>
            </div>
        );
    }
  };

  if (!document) {
    return (
      <div className="flex items-center justify-center h-full p-10">
        <p className="text-slate-500">Select a document from the dashboard to review.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] bg-slate-100 dark:bg-slate-900/50 relative">
      <div className="w-full md:w-1/2 p-4 h-full">
        <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-700 h-full flex flex-col overflow-hidden">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white p-4 pb-3 flex justify-between items-center border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
            <span className="truncate pr-2">{document.file.name}</span>
            <span className="text-xs font-semibold text-slate-500 uppercase px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
              {document.file.type.split('/')[1] || 'file'}
            </span>
          </h3>
          <div className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-800 relative overflow-hidden">
             {renderPreview()}
          </div>
        </div>
      </div>

      <div className="w-full md:w-1/2 p-4 flex flex-col h-full">
        <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-700 flex-1 flex flex-col p-6 h-full">
          <div className="flex justify-between items-start mb-2">
             <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Extracted Data</h3>
                {document.usageMetadata && (
                    <div className="text-[10px] text-slate-400 font-mono mt-1 mb-2 flex flex-wrap gap-x-3 gap-y-1">
                        <span title="Model Used">{document.usageMetadata.modelName}</span>
                        <span className="border-l border-slate-300 pl-3 text-green-600 dark:text-green-400 font-bold" title="Estimated Cost">
                            Est. ${document.usageMetadata.estimatedCost.toFixed(5)}
                        </span>
                        {appliedRules.length > 0 && (
                            <span className="bg-amber-100 text-amber-700 px-1 rounded border border-amber-200 font-bold">
                                {appliedRules.length} Rule{appliedRules.length !== 1 && 's'} Applied
                            </span>
                        )}
                    </div>
                )}
             </div>
             
             <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 p-1 rounded overflow-x-auto">
                {['mapped', 'lineItems', 'unmapped', 'assistant', 'trace', ...(document.emailContext ? ['context'] : [])].map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                    >
                        {tab === 'lineItems' ? `Lines (${lineItems.length})` : tab === 'trace' ? 'Rule Trace' : tab === 'context' ? 'Email/Context' : tab}
                    </button>
                ))}
             </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mb-4 min-h-[24px]">
                {document.tags?.map(tag => (
                    <span key={tag} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${getTagColor(tag)}`}>
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-700 font-bold px-0.5">×</button>
                    </span>
                ))}
                {showTagInput ? (
                    <div className="flex items-center gap-1">
                            <input 
                            type="text" 
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                            autoFocus
                            className="w-24 text-xs p-0.5 border border-slate-300 rounded focus:outline-none"
                            />
                            <button onClick={handleAddTag} className="text-xs text-blue-600 font-bold">✓</button>
                            <button onClick={() => setShowTagInput(false)} className="text-xs text-slate-400">✕</button>
                    </div>
                ) : (
                    <button onClick={() => setShowTagInput(true)} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-100 transition-colors">
                        + Tag
                    </button>
                )}
            </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar relative">
            
            {activeTab === 'mapped' && (
                <>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 rounded p-3 mb-6">
                    <div className="flex justify-between items-center mb-2">
                         <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide">
                             SAP Customer Match
                         </h4>
                         {autoMatchConfidence === 'exact' && (
                            <span className="bg-green-100 text-green-700 border border-green-200 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Verified
                            </span>
                         )}
                    </div>
                    
                    {selectedCustomer ? (
                        <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded border border-blue-200 dark:border-blue-800 shadow-sm">
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white">{selectedCustomer.CustomerName}</p>
                                <p className="text-xs text-slate-500">{selectedCustomer.BusinessPartner} | {selectedCustomer.CityName}, {selectedCustomer.Country}</p>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowCustomerModal(true);
                                    setCustomerSearchQuery(selectedCustomer.CustomerName);
                                }}
                                className="text-xs text-blue-600 hover:underline font-medium"
                            >
                                Change
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-3">
                            <p className="text-xs text-slate-500 mb-2">No customer automatically linked.</p>
                            <button 
                                onClick={() => {
                                    setShowCustomerModal(true);
                                    const nameKey = Object.keys(formData).find(k => k.toLowerCase().includes('customer') || k.toLowerCase().includes('name'));
                                    if (nameKey && formData[nameKey]) setCustomerSearchQuery(String(formData[nameKey]));
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-4 rounded transition-colors"
                            >
                                Search & Link Customer
                            </button>
                        </div>
                    )}
                </div>

                <div className="space-y-5">
                    {Object.entries(formData).map(([key, value]) => {
                        const ruleAffected = appliedRules.find(r => r.targetField === key);
                        return (
                            <div key={key}>
                                <label htmlFor={key} className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                {key.replace(/_/g, ' ')}
                                {ruleAffected && (
                                    <span 
                                        className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] border border-amber-200 cursor-help"
                                        title={`Modified by rule: ${ruleAffected.name}`}
                                    >
                                        ✨ Rule Applied
                                    </span>
                                )}
                                </label>
                                <div className="relative rounded-md shadow-sm">
                                <input
                                    type={typeof value === 'number' ? 'number' : 'text'}
                                    name={key}
                                    id={key}
                                    value={value}
                                    onChange={handleInputChange}
                                    className={`block w-full px-3 py-2 border rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-medium ${ruleAffected ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-300 dark:border-slate-600'}`}
                                />
                                {document.confidence && document.confidence[key] !== undefined && (
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${document.confidence[key] > 0.9 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                        {`${(document.confidence[key] * 100).toFixed(0)}%`}
                                    </span>
                                    </div>
                                )}
                                </div>
                            </div>
                        );
                    })}
                    {Object.keys(formData).length === 0 && <p className="text-slate-500 text-sm italic">No mapped fields found.</p>}
                </div>
                </>
            )}

            {activeTab === 'lineItems' && (
                <div className="h-full flex flex-col">
                    <p className="text-xs text-slate-500 mb-4 bg-blue-50 p-2 rounded text-blue-800 border border-blue-100">
                        Line Items extracted from the document table.
                    </p>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Line</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item #</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cost</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {lineItems.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <input 
                                                className="w-8 text-xs bg-transparent focus:outline-none"
                                                value={item.LineItem || idx + 1}
                                                onChange={(e) => handleLineItemChange(idx, 'LineItem', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <input 
                                                className="w-20 text-xs font-mono bg-transparent focus:outline-none text-blue-600 dark:text-blue-400"
                                                value={item.VendorItemNumber || ''}
                                                onChange={(e) => handleLineItemChange(idx, 'VendorItemNumber', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input 
                                                className="w-full text-xs bg-transparent focus:outline-none"
                                                value={item.ItemDescription || ''}
                                                onChange={(e) => handleLineItemChange(idx, 'ItemDescription', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <input 
                                                type="number"
                                                className="w-12 text-xs bg-transparent focus:outline-none text-right"
                                                value={item.QuantityOrdered || 0}
                                                onChange={(e) => handleLineItemChange(idx, 'QuantityOrdered', parseFloat(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <input 
                                                type="number"
                                                className="w-16 text-xs bg-transparent focus:outline-none text-right"
                                                value={item.CostEach || 0}
                                                onChange={(e) => handleLineItemChange(idx, 'CostEach', parseFloat(e.target.value))}
                                            />
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-xs text-right font-bold text-slate-700 dark:text-slate-300">
                                            {(item.CostExtended || 0).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {lineItems.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-500 italic">No line items extracted.</div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'trace' && (
                <div className="h-full flex flex-col">
                    <p className="text-xs text-slate-500 mb-4 bg-purple-50 p-2 rounded text-purple-800 border border-purple-100">
                        Processing Log: Shows rules and logic applied to this document.
                    </p>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 relative pb-6 border-l-2 border-slate-200 ml-2 pl-6">
                             <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
                             <div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Base Extraction</h4>
                                <p className="text-xs text-slate-500">Document analyzed using global schema.</p>
                                {currentRules?.naturalLanguageRules && (
                                    <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-800">
                                        <p className="text-[10px] font-bold text-blue-800 dark:text-blue-300 mb-1">Global Instructions Applied:</p>
                                        <p className="text-[10px] text-slate-600 dark:text-slate-400 italic line-clamp-3">"{currentRules.naturalLanguageRules}"</p>
                                    </div>
                                )}
                             </div>
                        </div>

                        {appliedRules.length > 0 ? appliedRules.map((rule, i) => (
                             <div key={i} className="flex items-start gap-3 relative pb-6 border-l-2 border-amber-200 ml-2 pl-6">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-amber-500 border-2 border-white"></div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">Rule Applied: {rule.name}</h4>
                                    <div className="text-xs text-slate-600 bg-amber-50 p-2 rounded mt-1 border border-amber-100">
                                        <span className="font-bold">Match:</span> {rule.condition.field} {rule.condition.operator} "{rule.condition.value}"
                                        <br/>
                                        <span className="font-bold">Logic:</span> {rule.instruction}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="flex items-start gap-3 relative pb-6 border-l-2 border-slate-200 ml-2 pl-6 opacity-50">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-300 border-2 border-white"></div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-600">No Conditional Rules Matched</h4>
                                    <p className="text-[10px] text-slate-400 mt-1">If you expected a rule to fire, check that the field value matches exactly.</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-start gap-3 relative ml-2 pl-6">
                             <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
                             <div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Final Output</h4>
                                <p className="text-xs text-slate-500">Ready for review.</p>
                             </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'assistant' && (
                <div className="h-full flex flex-col space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900 rounded p-4">
                        <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm flex items-center">
                            <span className="mr-2">★</span> AI Assistant
                        </h4>
                        <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                            Describe what needs to be fixed. The AI will re-read the document and update values.
                        </p>
                    </div>

                    <div className="flex-1 flex flex-col">
                        <textarea
                            value={feedbackInput}
                            onChange={(e) => setFeedbackInput(e.target.value)}
                            placeholder="e.g., 'The Total Amount is wrong, pick the bold number at the bottom.' or 'Combine First and Last Name into Customer Name'."
                            className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none h-32"
                        />
                        <button
                            onClick={handleAIFeedback}
                            disabled={isRefining || !feedbackInput.trim()}
                            className="mt-2 w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded shadow-sm transition-colors flex items-center justify-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isRefining ? <><Spinner /><span className="ml-2">Analysing...</span></> : 'Apply Fix'}
                        </button>
                    </div>

                    {/* New Section: Global Extraction Hints */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                            Global Extraction Rules
                        </h5>
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 mb-4 text-xs text-slate-700 dark:text-slate-300 italic">
                            "{currentRules?.naturalLanguageRules || 'No global rules defined.'}"
                        </div>
                        
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex justify-between items-center">
                            <span>Active Conditional Rules</span>
                            <span className="bg-slate-100 text-slate-600 px-1.5 rounded text-[10px]">{currentRules?.conditionalRules?.filter(r => r.active).length || 0}</span>
                        </h5>
                        <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-2">
                             {currentRules?.conditionalRules?.filter(r => r.active).map(rule => (
                                 <div key={rule.id} className="text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                                     <div className="font-bold text-slate-700 dark:text-slate-300">{rule.name}</div>
                                     <div className="text-slate-500 truncate" title={rule.instruction}>{rule.instruction}</div>
                                 </div>
                             ))}
                             {(!currentRules?.conditionalRules || currentRules.conditionalRules.length === 0) && (
                                 <p className="text-[10px] text-slate-400 italic">No rules configured.</p>
                             )}
                        </div>
                    </div>

                    {suggestedRule && (
                        <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                                Learning Suggestion
                            </h5>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded border border-slate-200 dark:border-slate-600 mb-3">
                                <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                                    "{suggestedRule}"
                                </p>
                            </div>
                            {userRole === UserRole.Analyst ? (
                                <button
                                    onClick={handlePromoteRule}
                                    className="w-full text-xs bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3 rounded transition-colors flex items-center justify-center gap-2"
                                >
                                    <span>Add to Global Training Rules</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                </button>
                            ) : (
                                <p className="text-[10px] text-slate-400 text-center">
                                    Only Analysts can promote rules.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'context' && (
                <div className="h-full flex flex-col">
                    <p className="text-xs text-slate-500 mb-4 bg-indigo-50 p-2 rounded text-indigo-800 border border-indigo-100 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        <span>Supplementary Context (Email/Text) provided during upload.</span>
                    </p>
                    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-4 shadow-inner">
                         <div className="prose prose-sm max-w-none dark:prose-invert">
                            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {document.emailContext}
                            </pre>
                         </div>
                    </div>
                </div>
            )}

            {activeTab === 'unmapped' && (
                <div className="h-full flex flex-col">
                    <p className="text-xs text-slate-500 mb-4 bg-blue-50 p-2 rounded text-blue-800 border border-blue-100">
                        Additional data fields found outside the main headers and grid.
                    </p>
                    <div className="flex-1 overflow-y-auto space-y-2">
                    {unmappedData.map((item, idx) => (
                        <div key={idx} className="flex space-x-2 items-start">
                            <input 
                                type="text"
                                placeholder="Key"
                                value={item.key}
                                onChange={(e) => handleUnmappedChange(idx, 'key', e.target.value)}
                                className="w-1/3 px-2 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none uppercase"
                            />
                            <input 
                                type="text"
                                placeholder="Value"
                                value={item.value}
                                onChange={(e) => handleUnmappedChange(idx, 'value', e.target.value)}
                                className="flex-1 px-2 py-2 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                            <button 
                                onClick={() => removeUnmappedField(idx)}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                title="Remove Field"
                            >
                                {ICONS.trash}
                            </button>
                        </div>
                    ))}
                    </div>
                     <button 
                        onClick={addUnmappedField}
                        className="mt-4 flex items-center justify-center w-full py-2 border border-dashed border-slate-300 dark:border-slate-600 rounded text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all text-sm font-medium"
                     >
                        {ICONS.plus}
                        <span className="ml-2">Add Custom Field</span>
                    </button>
                </div>
            )}

          </div>
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-blue-700 flex items-center">
                &larr; <span className="ml-1">Dashboard</span>
                </button>
                {lastSaved && (
                    <span className="text-[10px] text-slate-400 italic">Saved at {lastSaved}</span>
                )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleSave}
                className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-6 rounded shadow-sm transition-colors text-sm"
              >
                Save Draft
              </button>
              <button
                onClick={handlePost}
                disabled={isPosting}
                className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-6 rounded shadow hover:shadow-md transition-all disabled:bg-blue-400 flex items-center justify-center min-w-[160px] text-sm"
              >
                {isPosting ? <><Spinner /><span className="ml-2">Posting...</span></> : 'Approve & Post'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden h-[500px] flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Select Customer</h3>
                    <button onClick={() => setShowCustomerModal(false)} className="text-slate-400 hover:text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={customerSearchQuery}
                            onChange={(e) => setCustomerSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                            placeholder="Search by Name, City, or ID..."
                            className="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded text-sm dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            autoFocus
                        />
                        <button 
                            onClick={handleManualSearch}
                            disabled={isSearchingCustomer}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold"
                        >
                            {isSearchingCustomer ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/50">
                    {customerSearchResults.length > 0 ? (
                        <div className="space-y-2">
                            {customerSearchResults.map(cust => (
                                <div key={cust.BusinessPartner} className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 flex justify-between items-center hover:border-blue-300 transition-colors group">
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white text-sm">{cust.CustomerName}</p>
                                        <p className="text-xs text-slate-500">{cust.StreetName ? `${cust.StreetName}, ` : ''}{cust.CityName}, {cust.Country}</p>
                                        <p className="text-[10px] text-slate-400 font-mono mt-1">ID: {cust.BusinessPartner}</p>
                                    </div>
                                    <button 
                                        onClick={() => selectCustomer(cust)}
                                        className="opacity-0 group-hover:opacity-100 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-bold px-3 py-1.5 rounded transition-all"
                                    >
                                        Select
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                            {isSearchingCustomer ? 'Searching...' : 'No results found. Try a different search term.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default ReviewView;
