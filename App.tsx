
import React, { useState, useCallback, useEffect } from 'react';
import { User, Document, DocumentStatus, TrainingRules, SapCustomer } from './types';
import Header from './components/Header';
import DashboardView from './views/DashboardView';
import ReviewView from './views/ReviewView';
import TrainingView from './views/TrainingView';
import SettingsView from './views/SettingsView';
import TestBenchView from './views/TestBenchView';
import LoginView from './views/LoginView';
import { extractAndMapData, fileToBase64 } from './services/geminiService';
import { checkERPDuplication, searchCustomers } from './services/erpService';
import { getCurrentUser, hasPermission } from './services/authService';

const STORAGE_KEY = 'idp_documents';
const RULES_STORAGE_KEY = 'idp_training_rules';

const initialTrainingRules: TrainingRules = {
  schema: [
    { id: '1', name: 'po_number', type: 'string', description: 'The Purchase Order Number' },
    { id: '2', name: 'customer_name', type: 'string', description: 'Name of the customer placing the order' },
    { id: '3', name: 'total_amount', type: 'number', description: 'Total value of the order' },
    { id: '4', name: 'order_date', type: 'date', description: 'Date of the order' },
    { id: '5', name: 'delivery_address', type: 'string', description: 'Shipping or delivery address' },
  ],
  naturalLanguageRules: 'Identify the PO Number (often labeled as PO#, Order No). Extract the customer name from the header. Look for the total amount at the bottom. Identify specific delivery instructions if present.'
};

interface DuplicateAlertState {
  show: boolean;
  docId: string | null;
  message: string;
  source: 'Local' | 'SAP';
}

// Helper to generate a simple hash for deduplication
const generateFileHash = async (base64: string): Promise<string> => {
    const len = base64.length;
    const start = base64.substring(0, 500);
    const end = base64.substring(len - 500);
    return `${len}-${start}-${end}`; 
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  const [documents, setDocuments] = useState<Document[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load documents from storage", e);
      return [];
    }
  });

  const [trainingRules, setTrainingRules] = useState<TrainingRules>(() => {
    try {
        const stored = localStorage.getItem(RULES_STORAGE_KEY);
        return stored ? JSON.parse(stored) : initialTrainingRules;
    } catch (e) {
        return initialTrainingRules;
    }
  });

  const [currentView, setCurrentView] = useState<'dashboard' | 'review' | 'training' | 'settings' | 'test-bench'>('dashboard');
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  
  const [duplicateAlert, setDuplicateAlert] = useState<DuplicateAlertState>({
    show: false,
    docId: null,
    message: '',
    source: 'Local'
  });

  // Check Auth on Mount
  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoadingAuth(false);
  }, []);

  // Persist Documents
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
    } catch (e) {
      console.error("Local storage quota exceeded or error saving", e);
    }
  }, [documents]);

  // Persist Rules
  useEffect(() => {
    try {
        localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(trainingRules));
    } catch (e) {
        console.error("Failed to save rules", e);
    }
  }, [trainingRules]);

  const updateDocumentStatus = (docId: string, status: DocumentStatus, data?: Partial<Document>) => {
    setDocuments(docs => docs.map(d => d.id === docId ? { ...d, status, ...data } : d));
  };

  const processDocument = useCallback(async (doc: Document) => {
    updateDocumentStatus(doc.id, DocumentStatus.Parsing);
    
    // Simulate latency for UX
    await new Promise(res => setTimeout(res, 800));
    updateDocumentStatus(doc.id, DocumentStatus.Mapping);

    try {
        const { mappedData, lineItems, unmappedData, termsAndConditions, confidence, usageMetadata, appliedRuleIds } = await extractAndMapData(doc, trainingRules);
        
        const newTags = doc.tags ? [...doc.tags] : [];
        const poFieldKey = Object.keys(mappedData).find(k => k.toLowerCase().includes('po_number') || k.toLowerCase().includes('order_no')) || 'po_number';
        const poValue = mappedData[poFieldKey];

        // --- AUTO-LINK SAP CUSTOMER ---
        let sapCustomerMatch: SapCustomer | undefined = undefined;
        const customerNameField = Object.keys(mappedData).find(k => 
            k.toLowerCase().includes('customer') || k.toLowerCase().includes('name')
        );

        if (customerNameField && mappedData[customerNameField]) {
            const nameQuery = String(mappedData[customerNameField]);
            console.log(`Attempting auto-link for customer: ${nameQuery}`);
            
            try {
                // Search for customer in SAP
                const { results } = await searchCustomers({ name: nameQuery });
                
                // Heuristic: If we get 1 result, or an exact name match, we link it.
                if (results.length > 0) {
                     const exact = results.find(c => c.CustomerName.toLowerCase() === nameQuery.toLowerCase());
                     if (exact) {
                         sapCustomerMatch = exact;
                     } else if (results.length === 1) {
                         // High confidence if it's the only result returned by a search
                         sapCustomerMatch = results[0];
                     }
                     
                     if (sapCustomerMatch) {
                         mappedData['customer_id'] = sapCustomerMatch.BusinessPartner;
                         console.log(`Auto-linked SAP Customer: ${sapCustomerMatch.CustomerName} (${sapCustomerMatch.BusinessPartner})`);
                     }
                }
            } catch (e) {
                console.warn("Auto-link SAP customer failed", e);
            }
        }

        // --- DUPLICATE CHECKS ---
        if (poValue) {
            // Check for logical duplicates (same PO number extracted)
            const isLogicalDup = documents.some(d => 
                d.id !== doc.id && 
                d.mappedData &&
                d.mappedData[poFieldKey] === poValue
            );

            if (isLogicalDup) {
                newTags.push(`Duplicate: Local File Exists (PO#${poValue})`);
            }
            
            // Check SAP
            try {
                const erpResult = await checkERPDuplication(String(poValue));
                if (erpResult.exists) {
                    newTags.push(`Duplicate: SAP Order Exists (PO#${poValue})`);
                }
            } catch (e) {
                console.warn("Skipping SAP duplicate check during processing", e);
            }
        }
        
        const uniqueTags = Array.from(new Set(newTags));
        
        updateDocumentStatus(doc.id, DocumentStatus.Review, { 
            mappedData, 
            lineItems,
            unmappedData, 
            termsAndConditions, 
            confidence,
            tags: uniqueTags,
            appliedRuleIds,
            usageMetadata,
            sapCustomerMatch // Attach the linked customer
        });

    } catch (e) {
        console.error("Failed to process document", e);
        updateDocumentStatus(doc.id, DocumentStatus.Review, { 
            tags: [...(doc.tags || []), "Error: Extraction Failed"] 
        });
    }
  }, [trainingRules, documents]); 


  const handleFileUpload = async (files: FileList | File[] | null, emailContext?: string) => {
    if (!files || !user) return;
    
    // Convert to array if FileList
    const fileArray = files instanceof FileList ? Array.from(files) : files;
    const newDocs: Document[] = [];
    
    for (const file of fileArray) {
      const base64 = await fileToBase64(file);
      const fileHash = await generateFileHash(base64);

      // --- DEDUPLICATION LOGIC ---
      const existingDoc = documents.find(d => d.file.fileHash === fileHash && d.status !== DocumentStatus.Uploaded);
      
      if (existingDoc && !emailContext) {
          // If we have an exact file match AND no special email context was provided, restore cache.
          // If email context IS provided, we treat it as unique because the extraction logic might change based on the email.
          const clonedDoc: Document = {
            id: `${Date.now()}-${Math.random()}`,
            file: { name: file.name, type: file.type, size: file.size, base64, fileHash },
            status: DocumentStatus.Review, 
            mappedData: existingDoc.mappedData,
            unmappedData: existingDoc.unmappedData,
            lineItems: existingDoc.lineItems,
            termsAndConditions: existingDoc.termsAndConditions,
            confidence: existingDoc.confidence,
            tags: ["Restored from Cache", ...(existingDoc.tags || [])],
            usageMetadata: { ...existingDoc.usageMetadata!, modelName: "Cached Result" },
            appliedRuleIds: existingDoc.appliedRuleIds,
            sapCustomerMatch: existingDoc.sapCustomerMatch,
            createdBy: user.name,
            createdAt: new Date().toISOString()
          };
          newDocs.push(clonedDoc);
          alert(`File '${file.name}' was recognized. Loaded existing extraction results to save costs.`);
      } else {
          const newDoc: Document = {
            id: `${Date.now()}-${Math.random()}`,
            file: { name: file.name, type: file.type, size: file.size, base64, fileHash },
            status: DocumentStatus.Uploaded,
            mappedData: {},
            tags: [],
            createdBy: user.name,
            createdAt: new Date().toISOString(),
            emailContext: emailContext // Attach the context
          };
          newDocs.push(newDoc);
      }
    }
    
    setDocuments(prev => [...prev, ...newDocs]);
    
    newDocs.forEach(doc => {
        if (doc.status === DocumentStatus.Uploaded) {
            processDocument(doc);
        }
    });
  };

  const handleDeleteDocument = (docId: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      setDocuments(prev => prev.filter(d => d.id !== docId));
      if (activeDocumentId === docId) {
        navigateTo('dashboard');
      }
    }
  };
  
  const handleUpdateTags = (docId: string, tags: string[]) => {
    setDocuments(docs => docs.map(d => d.id === docId ? { ...d, tags } : d));
  };

  const navigateTo = (view: 'dashboard' | 'training' | 'settings' | 'test-bench') => {
    if (user && !hasPermission(user, view)) {
        alert("You do not have permission to access this area.");
        return;
    }
    setActiveDocumentId(null);
    setCurrentView(view);
  };

  const navigateToReview = (docId: string) => {
    setActiveDocumentId(docId);
    setCurrentView('review');
  };

  const handleSaveReview = (docId: string, updatedMappedData: Record<string, any>, updatedUnmappedData: { key: string; value: string | number }[]) => {
    setDocuments(docs => docs.map(d => d.id === docId ? { 
        ...d, 
        mappedData: updatedMappedData, 
        unmappedData: updatedUnmappedData,
        lastModifiedAt: new Date().toISOString()
    } : d));
  };

  const handlePromoteRule = (newRule: string) => {
    setTrainingRules(prev => ({
        ...prev,
        naturalLanguageRules: prev.naturalLanguageRules ? `${prev.naturalLanguageRules}\n${newRule}` : newRule
    }));
    alert("Rule added to global training instructions. It will be applied to all future document uploads.");
  };

  const executePost = (docId: string) => {
    updateDocumentStatus(docId, DocumentStatus.Posting);
    setTimeout(() => { 
      updateDocumentStatus(docId, DocumentStatus.Done);
      if (currentView === 'review') {
          navigateTo('dashboard');
      }
      setDuplicateAlert({ show: false, docId: null, message: '', source: 'Local' });
    }, 2000);
  };

  const handlePostRequest = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    const poFieldKey = Object.keys(doc.mappedData).find(k => k.toLowerCase().includes('po_number') || k.toLowerCase().includes('order_no')) || 'po_number';
    const poValue = doc.mappedData[poFieldKey];

    if (!poValue) {
        executePost(docId);
        return;
    }

    const localDup = documents.find(d => 
        d.id !== docId && 
        d.status === DocumentStatus.Done && 
        d.mappedData[poFieldKey] === poValue
    );

    if (localDup) {
        setDuplicateAlert({
            show: true,
            docId,
            source: 'Local',
            message: `Duplicate PO detected locally (File: ${localDup.file.name}).`
        });
        return;
    }

    try {
        const erpResult = await checkERPDuplication(String(poValue));
        if (erpResult.exists) {
            setDuplicateAlert({
                show: true,
                docId,
                source: 'SAP',
                message: erpResult.details || `Duplicate PO exists in SAP.`
            });
            return;
        }
    } catch (e) {
        if(!window.confirm("Could not verify duplicates with SAP. Proceed anyway?")) return;
    }

    executePost(docId);
  };

  const renderView = () => {
    switch (currentView) {
      case 'settings':
        return <SettingsView />;
      case 'test-bench':
        return <TestBenchView />;
      case 'review':
        return (
          <ReviewView
            document={documents.find(d => d.id === activeDocumentId)}
            userRole={user?.role}
            currentRules={trainingRules}
            onSave={handleSaveReview}
            onPost={handlePostRequest}
            onBack={() => navigateTo('dashboard')}
            onPromoteRule={handlePromoteRule}
            onUpdateTags={handleUpdateTags}
          />
        );
      case 'training':
        return <TrainingView rules={trainingRules} onSave={setTrainingRules} />;
      case 'dashboard':
      default:
        return (
          <DashboardView
            documents={documents}
            handleFileUpload={handleFileUpload}
            navigateToReview={navigateToReview}
            onDelete={handleDeleteDocument}
            onUpdateTags={handleUpdateTags}
          />
        );
    }
  };

  // --- Auth Guards ---
  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900"><div className="animate-spin h-8 w-8 text-blue-600 border-b-2 border-blue-600 rounded-full"></div></div>;

  if (!user) {
      return <LoginView onLoginSuccess={setUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 relative">
      <Header user={user} navigateTo={navigateTo} />
      <main>
        {renderView()}
      </main>

      {duplicateAlert.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full border border-red-200 dark:border-red-900 overflow-hidden">
                <div className="bg-red-50 dark:bg-red-900/30 p-4 border-b border-red-100 dark:border-red-800 flex items-center gap-3">
                    <h3 className="text-lg font-bold text-red-800 dark:text-red-200">
                        Duplicate Detected ({duplicateAlert.source})
                    </h3>
                </div>
                <div className="p-6">
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                        {duplicateAlert.message}
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button 
                            onClick={() => setDuplicateAlert(prev => ({ ...prev, show: false }))}
                            className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-200 font-semibold text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => duplicateAlert.docId && executePost(duplicateAlert.docId)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-sm"
                        >
                            Post Anyway
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
