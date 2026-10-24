import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Upload,
  Search,
  Filter,
  FileText,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  DollarSign,
  Building,
  Clock,
  Edit2,
  Check,
  X,
  RefreshCw
} from 'lucide-react';
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassModal,
  LoadingState,
  EmptyState,
  ErrorState
} from '../components/common/GlassComponents';
import { documentApi } from '../services/api';

const CATEGORIES = ['all', 'bill', 'application', 'education', 'medical', 'government', 'legal', 'financial', 'general'];

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadWarning, setUploadWarning] = useState('');

  // Document Detail Drawer/Modal
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [docFacts, setDocFacts] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editedFactValue, setEditedFactValue] = useState('');
  const [reprocessing, setReprocessing] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await documentApi.list(search || undefined, selectedCategory);
      setDocuments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocuments();
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    if (!uploadFile.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF files are supported for secure extraction.');
      return;
    }

    if (uploadFile.size > 100 * 1024 * 1024) {
      setUploadError(`Selected file is too large (${(uploadFile.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed PDF upload is 100MB.`);
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadWarning('');

    try {
      const res = await documentApi.upload(uploadFile);
      if (res.extraction_warning) {
        setUploadWarning(res.extraction_warning);
      }
      setUploadFile(null);
      setUploadModalOpen(false);
      fetchDocuments();
      if (res.document) {
        openDocumentDetail(res.document.id);
      }
    } catch (err: any) {
      setUploadError(err.message || 'PDF extraction failed. Please check the backend connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const openDocumentDetail = async (docId: string) => {
    setLoadingDetail(true);
    try {
      const res = await documentApi.get(docId);
      setSelectedDoc(res.document);
      setDocFacts(res.facts || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Delete this document and all extracted facts from Smart Memory?')) return;
    try {
      await documentApi.delete(docId);
      setSelectedDoc(null);
      fetchDocuments();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const handleReprocessDocument = async (docId: string) => {
    setReprocessing(true);
    try {
      const res = await documentApi.reprocess(docId);
      setSelectedDoc(res.document);
      setDocFacts(res.facts);
      fetchDocuments();
    } catch (err: any) {
      alert(err.message || 'Failed to reprocess document');
    } finally {
      setReprocessing(false);
    }
  };

  const handleUpdateFact = async (factId: string) => {
    try {
      const updated = await documentApi.updateFact(factId, {
        value: editedFactValue,
        verified: 1
      });
      setDocFacts(prev => prev.map(f => f.id === factId ? updated : f));
      setEditingFactId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update fact');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <FolderOpen className="w-4 h-4" />
            <span>Encrypted Document Vault</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-['Manrope']">
            Smart Memory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Secure PDF extraction powered by PyMuPDF. Categorized facts, verified source snippets, and private storage.
          </p>
        </div>

        <GlassButton
          variant="primary"
          icon={<Upload className="w-4 h-4" />}
          onClick={() => setUploadModalOpen(true)}
        >
          Upload PDF Document
        </GlassButton>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search summaries, institutions, or keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0B1120]/70 text-slate-100 placeholder-slate-500 rounded-xl border border-white/10 px-4 py-2 pl-10 text-xs focus:outline-none focus:border-indigo-400/40"
          />
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-900/40 text-slate-400 hover:text-slate-200 border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      {loading ? (
        <LoadingState message="Scanning Smart Memory repository..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchDocuments} />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-8 h-8 text-indigo-400" />}
          title="No Documents Found"
          description="Upload your PDF bills, visa requirements, or insurance policies to build Orbi's intelligence memory."
          action={{
            label: "Upload Your First PDF",
            onClick: () => setUploadModalOpen(true)
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(doc => (
            <GlassCard
              key={doc.id}
              className="p-5 flex flex-col justify-between hover:border-indigo-500/40 cursor-pointer transition-all"
              onClick={() => openDocumentDetail(doc.id)}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/5">
                    {doc.category}
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-slate-100 line-clamp-1">{doc.original_name}</h4>
                <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {doc.summary || "PDF document parsed and indexed in Smart Memory."}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                <span className="text-indigo-400 font-medium">Inspect facts &rarr;</span>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Upload PDF Modal */}
      <GlassModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Upload Document to Smart Memory"
        description="Select a PDF document. PyMuPDF will extract text, dates, amounts, and structured facts."
      >
        <form onSubmit={handleFileUpload} className="space-y-4">
          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {uploadError}
            </div>
          )}

          {uploadWarning && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{uploadWarning}</span>
            </div>
          )}

          <div className="border-2 border-dashed border-white/10 hover:border-indigo-500/40 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-[#070B14]/40">
            <input
              type="file"
              accept=".pdf,application/pdf"
              id="file-upload"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setUploadFile(e.target.files[0]);
                }
              }}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-8 h-8 text-indigo-400 mb-2" />
              <span className="text-xs font-medium text-slate-200">
                {uploadFile ? uploadFile.name : "Click to select a PDF file"}
              </span>
              <span className="text-[11px] text-slate-500 mt-1">
                {uploadFile ? `${(uploadFile.size / 1024).toFixed(1)} KB` : "Supports PDF files up to 100MB"}
              </span>
            </label>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">Extraction Protections:</p>
            <p>• Contents are treated as untrusted input with sanitization.</p>
            <p>• If OCR is unavailable for scanned image PDFs, extraction will report limitation.</p>
            <p>• No hallucinated values or fabricated facts.</p>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <GlassButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setUploadModalOpen(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              size="sm"
              loading={uploading}
              disabled={!uploadFile}
            >
              Extract & Save to Memory
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* Document Detail & Extracted Facts Modal */}
      {selectedDoc && (
        <GlassModal
          isOpen={!!selectedDoc}
          onClose={() => setSelectedDoc(null)}
          title={selectedDoc.original_name}
          description={`Category: ${selectedDoc.category.toUpperCase()} • File Size: ${(selectedDoc.file_size / 1024).toFixed(1)} KB`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5">
            {/* Summary */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-indigo-400">Executive Summary</span>
              <p className="text-xs text-slate-200 leading-relaxed">{selectedDoc.summary}</p>
            </div>

            {/* Extracted Facts Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">Extracted Facts ({docFacts.length})</span>
                <span className="text-[10px] text-slate-500">Click edit to correct or verify</span>
              </div>

              {docFacts.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No structured facts extracted from this text.</p>
              ) : (
                <div className="divide-y divide-white/5 border border-white/10 rounded-xl bg-[#070B14]/40 overflow-hidden">
                  {docFacts.map((fact) => (
                    <div key={fact.id} className="p-3 flex items-start justify-between gap-3 text-xs">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-300">{fact.label}:</span>
                          {editingFactId === fact.id ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editedFactValue}
                                onChange={(e) => setEditedFactValue(e.target.value)}
                                className="bg-slate-900 text-slate-100 text-xs px-2 py-1 rounded border border-indigo-500/40 focus:outline-none"
                              />
                              <button
                                onClick={() => handleUpdateFact(fact.id)}
                                className="p-1 text-emerald-400 hover:text-white"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingFactId(null)}
                                className="p-1 text-slate-400 hover:text-white"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="font-semibold text-indigo-300">{fact.value}</span>
                          )}
                          {fact.verified ? (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">Verified</span>
                          ) : null}
                        </div>
                        {fact.source_snippet && (
                          <p className="text-[10px] text-slate-500 mt-1 italic">
                            Page {fact.page_number} • "{fact.source_snippet}"
                          </p>
                        )}
                      </div>

                      {editingFactId !== fact.id && (
                        <button
                          onClick={() => {
                            setEditingFactId(fact.id);
                            setEditedFactValue(fact.value);
                          }}
                          className="text-slate-400 hover:text-indigo-400 p-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GlassButton
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => handleDeleteDocument(selectedDoc.id)}
                >
                  Delete Document
                </GlassButton>
                <GlassButton
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw className={`w-3.5 h-3.5 ${reprocessing ? 'animate-spin' : ''}`} />}
                  loading={reprocessing}
                  onClick={() => handleReprocessDocument(selectedDoc.id)}
                >
                  Re-extract Facts
                </GlassButton>
              </div>
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={() => setSelectedDoc(null)}
              >
                Close
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}
    </div>
  );
};
