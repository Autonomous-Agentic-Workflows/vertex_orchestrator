import React, { useState, useEffect } from 'react';
import { HardDrive, X, Search, FileText, Download, Upload, ExternalLink, RefreshCw, Check, Sparkles, Folder, AlertTriangle } from 'lucide-react';
import { listDriveFiles, getDriveFileContent, createDriveFile, openGooglePicker, DriveFile } from '../../lib/driveService';
import { googleSignIn, getAccessToken } from '../../lib/firebase';

interface GoogleDrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCode: (code: string, fileName: string, mode: 'pyspark' | 'sql') => void;
  currentCodeToExport?: string;
  currentMode?: 'pyspark' | 'sql';
}

export const GoogleDrivePickerModal: React.FC<GoogleDrivePickerModalProps> = ({
  isOpen,
  onClose,
  onImportCode,
  currentCodeToExport,
  currentMode = 'pyspark',
}) => {
  const [token, setToken] = useState<string | null>(getAccessToken());
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [exportFileName, setExportFileName] = useState<string>(`spark_pipeline_${Date.now()}.${currentMode === 'sql' ? 'sql' : 'py'}`);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'picker' | 'explorer' | 'export'>('picker');
  
  // Confirmation state for destructive/mutating actions
  const [showConfirmExport, setShowConfirmExport] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && token) {
      fetchFiles();
    }
  }, [isOpen, token]);

  const handleConnectDrive = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await googleSignIn();
      if (res?.accessToken) {
        setToken(res.accessToken);
        fetchFiles(res.accessToken);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate with Google Drive.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async (authToken?: string) => {
    const activeToken = authToken || token || getAccessToken();
    if (!activeToken) return;

    try {
      setLoading(true);
      setError(null);
      const items = await listDriveFiles(activeToken);
      setFiles(items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Google Drive files.');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchOfficialPicker = () => {
    const activeToken = token || getAccessToken();
    if (!activeToken) {
      handleConnectDrive();
      return;
    }

    openGooglePicker({
      accessToken: activeToken,
      onFilePicked: async (picked) => {
        try {
          setLoadingPreview(true);
          const content = await getDriveFileContent(activeToken, picked.id);
          const isSql = picked.name.endsWith('.sql') || picked.mimeType.includes('sql');
          onImportCode(content, picked.name, isSql ? 'sql' : 'pyspark');
          onClose();
        } catch (err: any) {
          setError(`Failed to read file from Picker: ${err.message}`);
        } finally {
          setLoadingPreview(false);
        }
      },
      onCancel: () => {
        console.log('Picker cancelled');
      },
    });
  };

  const handleSelectFile = async (file: DriveFile) => {
    setSelectedFile(file);
    const activeToken = token || getAccessToken();
    if (!activeToken) return;

    try {
      setLoadingPreview(true);
      setPreviewContent(null);
      const text = await getDriveFileContent(activeToken, file.id);
      setPreviewContent(text);
    } catch (err: any) {
      setPreviewContent(`// Could not load plain text preview: ${err.message}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImportSelected = () => {
    if (!selectedFile || !previewContent) return;
    const isSql = selectedFile.name.endsWith('.sql') || selectedFile.mimeType.includes('sql');
    onImportCode(previewContent, selectedFile.name, isSql ? 'sql' : 'pyspark');
    onClose();
  };

  const handleExportToDrive = async () => {
    if (!currentCodeToExport) return;
    const activeToken = token || getAccessToken();
    if (!activeToken) {
      handleConnectDrive();
      return;
    }

    try {
      setExporting(true);
      setError(null);
      const created = await createDriveFile(
        activeToken,
        exportFileName,
        currentCodeToExport,
        currentMode === 'sql' ? 'text/x-sql' : 'text/x-python'
      );
      setExportSuccess(`Successfully saved "${created.name}" to Google Drive!`);
      setShowConfirmExport(false);
      fetchFiles(activeToken);
    } catch (err: any) {
      setError(err?.message || 'Failed to export to Google Drive.');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                Google Drive & Google Picker
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  OAuth 2.0
                </span>
              </h3>
              <p className="text-xs text-slate-400">Import PySpark/SQL scripts or export Spark pipelines directly to Google Drive</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('picker')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
                activeTab === 'picker'
                  ? 'border-emerald-400 text-emerald-400 bg-slate-800/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Google Picker Dialog
            </button>
            <button
              onClick={() => setActiveTab('explorer')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
                activeTab === 'explorer'
                  ? 'border-emerald-400 text-emerald-400 bg-slate-800/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Drive File Explorer
            </button>
            {currentCodeToExport && (
              <button
                onClick={() => setActiveTab('export')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
                  activeTab === 'export'
                    ? 'border-emerald-400 text-emerald-400 bg-slate-800/50'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Export Notebook to Drive
              </button>
            )}
          </div>

          {token && (
            <button
              onClick={() => fetchFiles()}
              disabled={loading}
              className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded bg-slate-800/40 border border-slate-700/50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!token ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 bg-slate-950/40 border border-slate-800/60 rounded-xl p-8">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400">
                <HardDrive className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-slate-200">Connect Google Drive</h4>
                <p className="text-xs text-slate-400 max-w-md mt-1">
                  Authenticate with your Google account to grant permission to pick and access your PySpark/SQL files safely.
                </p>
              </div>
              <button
                onClick={handleConnectDrive}
                disabled={loading}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                Sign in & Connect Google Drive
              </button>
            </div>
          ) : (
            <>
              {/* TAB 1: Official Google Picker Dialog Launcher */}
              {activeTab === 'picker' && (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-5 bg-slate-950/40 border border-slate-800/60 rounded-xl p-6">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="max-w-md">
                    <h4 className="text-base font-semibold text-slate-200">Launch Google Picker API</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Opens the native Google Picker UI widget to choose any document, dataset, or PySpark script directly from your Google Drive.
                    </p>
                  </div>

                  <button
                    onClick={handleLaunchOfficialPicker}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <HardDrive className="w-4 h-4" />
                    Open Native Google Picker
                  </button>
                </div>
              )}

              {/* TAB 2: Embedded Drive File Explorer */}
              {activeTab === 'explorer' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: File List */}
                  <div className="flex flex-col space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search Drive files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="border border-slate-800/80 rounded-xl bg-slate-950/50 max-h-[300px] overflow-y-auto divide-y divide-slate-800/50">
                      {loading ? (
                        <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                          Loading Google Drive files...
                        </div>
                      ) : filteredFiles.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          No files found in Google Drive.
                        </div>
                      ) : (
                        filteredFiles.map((f) => (
                          <div
                            key={f.id}
                            onClick={() => handleSelectFile(f)}
                            className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                              selectedFile?.id === f.id
                                ? 'bg-emerald-500/10 border-l-2 border-emerald-400 text-emerald-200'
                                : 'hover:bg-slate-800/40 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2 truncate pr-2">
                              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="font-medium truncate">{f.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                              {f.mimeType.split('.').pop()?.split('/').pop()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right Column: Preview & Action */}
                  <div className="flex flex-col bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
                    <h5 className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Selected File Preview</span>
                      {selectedFile && (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          {selectedFile.name}
                        </span>
                      )}
                    </h5>

                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 overflow-auto font-mono text-[11px] text-slate-300 min-h-[220px] max-h-[260px]">
                      {loadingPreview ? (
                        <div className="h-full flex items-center justify-center text-slate-500 gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                          Reading file from Drive...
                        </div>
                      ) : selectedFile ? (
                        <pre className="whitespace-pre-wrap">{previewContent || '// Empty file or binary data'}</pre>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
                          <Folder className="w-8 h-8 mb-2 opacity-40 text-emerald-400" />
                          <span>Select a file on the left to preview its content and import into Spark</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleImportSelected}
                      disabled={!selectedFile || !previewContent}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Import Code into Notebook
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: Export Notebook to Drive */}
              {activeTab === 'export' && currentCodeToExport && (
                <div className="space-y-4 bg-slate-950/40 border border-slate-800/60 rounded-xl p-5">
                  <div className="flex items-center space-x-2 text-xs text-slate-300">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold">Export Spark Notebook to Google Drive</span>
                  </div>

                  {exportSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{exportSuccess}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-mono text-slate-400">File Name in Google Drive</label>
                    <input
                      type="text"
                      value={exportFileName}
                      onChange={(e) => setExportFileName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl max-h-[140px] overflow-auto font-mono text-[11px] text-slate-400">
                    <pre>{currentCodeToExport}</pre>
                  </div>

                  {!showConfirmExport ? (
                    <button
                      onClick={() => setShowConfirmExport(true)}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-4 h-4" />
                      Save File to Google Drive
                    </button>
                  ) : (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3 animate-in fade-in">
                      <div className="flex items-start gap-2 text-xs text-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Confirm Export</p>
                          <p className="text-amber-300/80 mt-0.5">
                            This will create a new file named <span className="font-mono text-amber-100">"{exportFileName}"</span> directly in your Google Drive root folder.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleExportToDrive}
                          disabled={exporting}
                          className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        >
                          {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Confirm & Create File
                        </button>
                        <button
                          onClick={() => setShowConfirmExport(false)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-500">
          <span>Connected Scopes: Drive, Drive.File, Drive.Readonly</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
