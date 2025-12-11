
import React, { useState, useMemo, useRef } from 'react';
import { Document, DocumentStatus } from '../types';
import { DOCUMENT_STATUSES, ICONS, getTagColor } from '../constants';

interface KanbanColumnProps {
  status: DocumentStatus;
  documents: Document[];
  onReview: (docId: string) => void;
  onDelete: (docId: string) => void;
  onUpdateTags: (docId: string, tags: string[]) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ status, documents, onReview, onDelete, onUpdateTags }) => {
  const [displayCount, setDisplayCount] = useState(20);

  const statusColors: Record<DocumentStatus, string> = {
    [DocumentStatus.Uploaded]: 'bg-slate-400',
    [DocumentStatus.Parsing]: 'bg-blue-500',
    [DocumentStatus.Mapping]: 'bg-indigo-600',
    [DocumentStatus.Review]: 'bg-amber-500',
    [DocumentStatus.Posting]: 'bg-purple-600',
    [DocumentStatus.Done]: 'bg-emerald-600',
  };

  const visibleDocuments = useMemo(() => documents.slice(0, displayCount), [documents, displayCount]);
  const hasMore = documents.length > displayCount;

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 20);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg w-64 md:w-72 lg:w-80 flex-shrink-0 h-full flex flex-col border border-slate-200 dark:border-slate-700">
      <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-lg flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-2">
           <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide">{status}</h3>
           <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
             {documents.length}
           </span>
        </div>
        <span className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`}></span>
      </div>
      
      <div className="p-3 space-y-3 flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        {visibleDocuments.map(doc => (
            <DocumentCard key={doc.id} doc={doc} onReview={onReview} onDelete={onDelete} onUpdateTags={onUpdateTags} />
        ))}
        
        {documents.length === 0 && (
            <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-10 italic">
                No items
            </div>
        )}

        {hasMore && (
            <button 
                onClick={handleLoadMore}
                className="w-full py-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-transparent hover:border-blue-100 transition-all"
            >
                Load {Math.min(20, documents.length - displayCount)} more...
            </button>
        )}
      </div>
    </div>
  );
};

const Spinner = () => (
  <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

interface DocumentCardProps {
  doc: Document;
  onReview: (docId: string) => void;
  onDelete: (docId: string) => void;
  onUpdateTags: (docId: string, tags: string[]) => void;
}

const DocumentCard: React.FC<DocumentCardProps> = ({ doc, onReview, onDelete, onUpdateTags }) => {
  const isProcessing = [DocumentStatus.Parsing, DocumentStatus.Mapping, DocumentStatus.Posting].includes(doc.status);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    const tag = newTag.trim();
    if(tag) {
        const currentTags = doc.tags || [];
        if(!currentTags.includes(tag)){
            onUpdateTags(doc.id, [...currentTags, tag]);
        }
    }
    setNewTag('');
    setShowTagInput(false);
  };

  return (
    <div className={`bg-white dark:bg-slate-700 p-4 rounded border-l-4 shadow-sm border-t border-r border-b border-slate-200 dark:border-slate-600 hover:shadow-md transition-all relative group ${isProcessing ? 'border-l-blue-500 ring-1 ring-blue-100' : 'border-l-slate-300'}`}>
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 z-10"
        title="Delete Document"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
      </button>

      <div className="flex items-start space-x-3 pr-4">
        <div className={`mt-1 ${isProcessing ? 'text-blue-600 animate-pulse' : 'text-slate-500'}`}>
            {ICONS.document}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate" title={doc.file.name}>{doc.file.name}</p>
          <div className="flex justify-between items-center mt-0.5">
             <p className="text-xs text-slate-500 dark:text-slate-400">{(doc.file.size / 1024).toFixed(2)} KB</p>
             {doc.emailContext && (
                 <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1 rounded border border-indigo-100 flex items-center gap-1" title="Processed with Email Context">
                     <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                     <span>Email</span>
                 </span>
             )}
          </div>
          
          <div className="flex flex-wrap gap-1 mt-2">
            {doc.tags?.map(tag => (
                <span key={tag} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${getTagColor(tag)}`}>{tag}</span>
            ))}
            <button 
                onClick={(e) => { e.stopPropagation(); setShowTagInput(true); }}
                className={`text-[9px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 hover:text-slate-600 transition-colors ${showTagInput ? 'hidden' : ''}`}
                title="Add Tag"
            >
                +
            </button>
          </div>

          {showTagInput && (
             <div className="mt-1 flex gap-1">
                 <input 
                    type="text" 
                    value={newTag} 
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTag();
                        if (e.key === 'Escape') setShowTagInput(false);
                    }}
                    onBlur={() => setShowTagInput(false)}
                    autoFocus
                    placeholder="Tag..."
                    className="w-full text-xs p-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                 />
             </div>
          )}

          {isProcessing && (
            <div className="flex items-center space-x-2 mt-3 bg-blue-50 dark:bg-blue-900/30 p-1.5 rounded border border-blue-100 dark:border-blue-800">
                <Spinner />
                <span className="text-xs text-blue-800 dark:text-blue-300 font-medium">
                    {doc.status === DocumentStatus.Mapping ? 'AI Analyzing...' : `${doc.status}...`}
                </span>
            </div>
          )}
        </div>
      </div>
      {doc.status === DocumentStatus.Review && (
        <button
          onClick={() => onReview(doc.id)}
          className="mt-3 w-full text-center bg-white border border-blue-600 text-blue-700 hover:bg-blue-50 text-xs font-bold py-1.5 px-3 rounded transition-colors uppercase tracking-wide"
        >
          Review Required
        </button>
      )}
    </div>
  );
};

// --- UPLOAD MODAL COMPONENT ---
interface UploadModalProps {
    onClose: () => void;
    onUpload: (files: FileList | File[], emailContext?: string) => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onUpload }) => {
    const [mainFile, setMainFile] = useState<File | null>(null);
    const [emailFile, setEmailFile] = useState<File | null>(null);
    const [emailText, setEmailText] = useState('');
    const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
    const [isParsingEmail, setIsParsingEmail] = useState(false);

    const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setMainFile(e.target.files[0]);
        }
    };

    const handleEmailFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setEmailFile(file);
            
            // Auto-read content if simple text or eml
            if (file.type === 'text/plain' || file.name.endsWith('.eml') || file.name.endsWith('.txt')) {
                setIsParsingEmail(true);
                try {
                    const text = await file.text();
                    setEmailText(text); // Pre-fill the text area for review
                    setActiveTab('text');
                } catch(e) {
                    console.error("Failed to read email file", e);
                } finally {
                    setIsParsingEmail(false);
                }
            }
        }
    };

    const handleSubmit = () => {
        if (!mainFile) return;
        // If user typed in text area, use that. Otherwise if they uploaded a file but didn't switch tabs, we use the file we read?
        // Simpler: We prioritize the text area if populated, otherwise pass nothing.
        onUpload([mainFile], emailText);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Upload with Context</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    {/* 1. Main Document */}
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            1. Invoice / Order Document <span className="text-red-500">*</span>
                        </label>
                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors relative">
                            <input 
                                type="file" 
                                onChange={handleMainFileChange} 
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                accept=".pdf,.png,.jpg,.jpeg,.tiff"
                            />
                            {mainFile ? (
                                <div className="text-blue-600 font-medium flex items-center justify-center gap-2">
                                    {ICONS.document}
                                    {mainFile.name}
                                </div>
                            ) : (
                                <div className="text-slate-500 dark:text-slate-400 text-sm">
                                    <span className="text-blue-600 font-bold">Click to browse</span> or drag PDF/Image here
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. Email Context */}
                    <div className="mb-2">
                         <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex justify-between">
                            <span>2. Email / Supplementary Text (Optional)</span>
                        </label>
                        <p className="text-xs text-slate-500 mb-3">
                            Include email body or specific instructions (e.g. "Ignore the header date"). This helps the AI refine extraction.
                        </p>

                        <div className="flex border-b border-slate-200 dark:border-slate-700 mb-0">
                            <button 
                                onClick={() => setActiveTab('text')}
                                className={`px-4 py-2 text-xs font-bold ${activeTab === 'text' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
                            >
                                Paste Text
                            </button>
                            <button 
                                onClick={() => setActiveTab('file')}
                                className={`px-4 py-2 text-xs font-bold ${activeTab === 'file' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
                            >
                                Upload .EML / .TXT
                            </button>
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 border-t-0 rounded-b-lg p-3">
                            {activeTab === 'text' && (
                                <textarea 
                                    value={emailText}
                                    onChange={(e) => setEmailText(e.target.value)}
                                    placeholder="Paste email content here..."
                                    className="w-full h-32 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-800 dark:text-white resize-none"
                                />
                            )}
                            {activeTab === 'file' && (
                                <div className="text-center py-6">
                                    <input 
                                        type="file" 
                                        onChange={handleEmailFileChange}
                                        accept=".eml,.txt"
                                        className="hidden"
                                        id="email-upload"
                                    />
                                    <label htmlFor="email-upload" className="cursor-pointer bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 px-4 py-2 rounded text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm">
                                        Choose File
                                    </label>
                                    {emailFile && (
                                        <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                                            {emailFile.name} {isParsingEmail ? '(Reading...)' : '(Loaded)'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded font-medium text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={!mainFile}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        Process Document
                    </button>
                </div>
            </div>
        </div>
    );
};


interface DashboardViewProps {
  documents: Document[];
  handleFileUpload: (files: FileList | File[], emailContext?: string) => void;
  navigateToReview: (docId: string) => void;
  onDelete: (docId: string) => void;
  onUpdateTags: (docId: string, tags: string[]) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ documents, handleFileUpload, navigateToReview, onDelete, onUpdateTags }) => {
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Group documents by status for performance
  const docsByStatus = useMemo(() => {
    const grouped: Record<string, Document[]> = {};
    DOCUMENT_STATUSES.forEach(status => grouped[status] = []);
    documents.forEach(doc => {
        if(grouped[doc.status]) grouped[doc.status].push(doc);
    });
    return grouped;
  }, [documents]);

  return (
    <div className="p-6 h-[calc(100vh-64px)] flex flex-col bg-slate-100 dark:bg-slate-900">
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Document Pipeline</h2>
            <p className="text-sm text-slate-500 mt-1">Manage and track your SAP document processing workflows.</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 px-5 rounded shadow-sm hover:shadow transition-all"
        >
          {ICONS.upload}
          <span>Upload Document</span>
        </button>
      </div>

      <div className="flex space-x-4 overflow-x-auto pb-4 flex-1">
        {DOCUMENT_STATUSES.map(status => (
          <KanbanColumn 
            key={status} 
            status={status}
            documents={docsByStatus[status] || []}
            onReview={navigateToReview}
            onDelete={onDelete}
            onUpdateTags={onUpdateTags}
          />
        ))}
      </div>

      {showUploadModal && (
          <UploadModal 
            onClose={() => setShowUploadModal(false)}
            onUpload={handleFileUpload}
          />
      )}
    </div>
  );
};

export default DashboardView;
