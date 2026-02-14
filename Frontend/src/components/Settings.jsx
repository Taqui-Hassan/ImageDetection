import React, { useState, useEffect } from 'react';
import SaveIcon from '@mui/icons-material/Save';
import LockIcon from '@mui/icons-material/Lock';
import EditIcon from '@mui/icons-material/Edit';
const API_URL = import.meta.env.VITE_API_URL;
const SETTINGS_PASSWORD = import.meta.env.VITE_SETTINGS_PASSWORD;

export default function Settings() {
    const [password, setPassword] = useState("");
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [caption, setCaption] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    // --- LOCK SCREEN LOGIC ---
    const handleUnlock = (e) => {
        e.preventDefault();
        // 🔐 CHANGE THIS PASSWORD if you want
        if (password === SETTINGS_PASSWORD) {
            setIsUnlocked(true);
            fetchConfig();
        } else {
            alert("Incorrect Password");
        }
    };

    // --- FETCH CURRENT CAPTION ---
    const fetchConfig = async () => {
        try {
            const res = await fetch(`${API_URL}/config`, { headers: { "ngrok-skip-browser-warning": "true" } });
            const data = await res.json();
            setCaption(data.captionTemplate);
        } catch (err) { console.error(err); }
    };

    // --- SAVE CAPTION ---
    const handleSave = async () => {
        setLoading(true);
        setStatus(null);
        try {
            await fetch(`${API_URL}/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
                body: JSON.stringify({ captionTemplate: caption })
            });
            setStatus("saved");
            setTimeout(() => setStatus(null), 3000);
        } catch (err) {
            setStatus("error");
        } finally {
            setLoading(false);
        }
    };

    if (!isUnlocked) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] animate-fade-in">
                <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 text-center max-w-sm w-full">
                    <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LockIcon className="text-slate-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-4">Protected Settings</h2>
                    <form onSubmit={handleUnlock}>
                        <input 
                            type="password" 
                            placeholder="Enter Admin Password" 
                            className="w-full bg-slate-900 border border-slate-600 text-white p-3 rounded-lg mb-4 text-center focus:outline-none focus:border-blue-500"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all">
                            Unlock
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex items-center gap-3">
                    <EditIcon className="text-blue-400" />
                    <div>
                        <h2 className="text-lg font-bold text-white">Message Template Configuration</h2>
                        <p className="text-xs text-slate-400">Customize the WhatsApp message sent to guests.</p>
                    </div>
                </div>

                <div className="p-6">
                    <label className="block text-slate-300 text-sm font-bold mb-2">Message Template:</label>
                    <textarea 
                        className="w-full h-40 bg-slate-900 border border-slate-600 rounded-xl p-4 text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                    />
                    
                    <div className="mt-2 flex gap-2">
                        <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs cursor-help" title="Will be replaced by Guest Name">{'{name}'}</span>
                        <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs cursor-help" title="Will be replaced by Seat Number">{'{seat}'}</span>
                    </div>

                    <div className="mt-6 flex items-center justify-between">
                        <p className={`text-sm font-bold transition-opacity ${status === 'saved' ? 'text-green-400 opacity-100' : 'opacity-0'}`}>
                            ✅ Saved Successfully!
                        </p>
                        <button 
                            onClick={handleSave}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {loading ? "Saving..." : <><SaveIcon /> Save Changes</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}