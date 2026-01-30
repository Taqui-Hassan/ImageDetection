import React, { useState } from 'react';
import SendIcon from '@mui/icons-material/Send';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import TerminalIcon from '@mui/icons-material/Terminal';

export default function BulkSender({ onBack }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);

    const handleBlast = async () => {
        if (!file) return;
        setLoading(true); setReport(null);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/send-bulk`, {
                method: "POST", headers: { "ngrok-skip-browser-warning": "true" }, body: formData
            });
            const data = await res.json();
            setReport(data);
        } catch (err) { setReport({ status: "error", message: "Server Connection Failed" }); } 
        finally { setLoading(false); }
    };

    return (
        <div className="animate-fade-in">
            <button onClick={onBack} className="mb-4 text-slate-400 hover:text-white transition-colors">
                 ← Return to Modules
            </button>

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-full text-green-500">
                        <TerminalIcon />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Direct Broadcast Protocol</h2>
                        <p className="text-xs text-slate-400">Mass messaging engine. Excel + Image URL support.</p>
                    </div>
                </div>

                <div className="p-6">
                    {/* Upload Area */}
                    <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center bg-slate-900/50 mb-6 hover:border-green-500/50 transition-colors">
                        <label className="cursor-pointer inline-flex flex-col items-center gap-2 group">
                            <UploadFileIcon className="text-slate-400 group-hover:text-white transition-colors" style={{ fontSize: 40 }} />
                            <span className="text-sm font-medium text-slate-300 group-hover:text-white">
                                {file ? file.name : "Click to Upload Excel List"}
                            </span>
                            <input type="file" hidden accept=".xlsx, .xls" onChange={(e) => setFile(e.target.files[0])} />
                        </label>
                        
                        {/* Format Guide */}
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-1">Format:</span>
                            {['Name', 'Phone','ImageURL','Seat'].map(h => (
                                <span key={h} className="text-[10px] bg-slate-800 text-blue-400 px-2 py-0.5 rounded border border-slate-700 font-mono">
                                    {h}
                                </span>
                            ))}
                        </div>
                    </div>

                    {loading && (
                        <div className="mb-6">
                            <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 animate-progress w-full origin-left"></div>
                            </div>
                            <p className="text-xs text-green-500 mt-2 text-center font-mono">TRANSMITTING DATA PACKETS...</p>
                        </div>
                    )}

                    <button 
                        onClick={handleBlast} 
                        disabled={!file || loading}
                        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
                    >
                        {loading ? "SENDING..." : (
                            <>
                                <SendIcon fontSize="small" /> INITIATE BROADCAST
                            </>
                        )}
                    </button>

                    {/* Report Card */}
                    {report && (
                        <div className={`mt-6 p-4 rounded-lg border ${report.status === 'success' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                            {report.status === 'success' ? (
                                <div>
                                    <h4 className="text-green-400 font-bold mb-1">MISSION COMPLETE</h4>
                                    <div className="grid grid-cols-3 gap-4 text-center mt-2">
                                        <div className="bg-slate-900/50 p-2 rounded">
                                            <div className="text-xl font-bold text-white">{report.total}</div>
                                            <div className="text-[10px] text-slate-400 uppercase">Targeted</div>
                                        </div>
                                        <div className="bg-slate-900/50 p-2 rounded">
                                            <div className="text-xl font-bold text-green-400">{report.sent}</div>
                                            <div className="text-[10px] text-slate-400 uppercase">Sent</div>
                                        </div>
                                        <div className="bg-slate-900/50 p-2 rounded">
                                            <div className="text-xl font-bold text-red-400">{report.failed}</div>
                                            <div className="text-[10px] text-slate-400 uppercase">Failed</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-red-400 font-mono text-sm">ERROR: {report.message}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}