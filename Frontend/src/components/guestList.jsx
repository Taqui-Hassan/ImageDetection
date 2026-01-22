import React, { useState } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';

export default function GuestList() {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [password, setPassword] = useState("");
    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchGuests = (pwd) => {
        setLoading(true); setError("");
        fetch(`${import.meta.env.VITE_API_URL}/guests`, {
            headers: { "ngrok-skip-browser-warning": "true", "x-admin-password": pwd }
        })
        .then(async res => {
            if (res.status === 403) throw new Error("INVALID KEY");
            return res.json();
        })
        .then(data => { setGuests(data); setIsUnlocked(true); setLoading(false); })
        .catch(() => { setError("INVALID PASSCODE"); setLoading(false); });
    };

    const handleDelete = async (name) => {
        if (!window.confirm(`DELETE RECORD: ${name}?`)) return;
        await fetch(`${import.meta.env.VITE_API_URL}/guests/${name}`, { method: "DELETE", headers: { "ngrok-skip-browser-warning": "true" } });
        setGuests(prev => prev.filter(g => g.name !== name));
    };

    // Locked View
    if (!isUnlocked) {
        return (
            <div className="border border-dashed border-slate-600 rounded-xl p-8 text-center bg-slate-800/50">
                <LockIcon className="text-slate-500 mb-2" style={{ fontSize: 40 }} />
                <h3 className="text-lg font-bold text-slate-300">Encrypted Database</h3>
                <p className="text-xs text-slate-500 mb-4">Enter secondary admin key to view raw data.</p>
                <div className="flex justify-center gap-2 max-w-xs mx-auto">
                    <input 
                        type="password" 
                        placeholder="List Password" 
                        className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white text-sm w-full focus:outline-none focus:border-blue-500"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                        onClick={() => fetchGuests(password)} 
                        disabled={loading}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
                    >
                        {loading ? "..." : "Unlock"}
                    </button>
                </div>
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </div>
        );
    }

    // Table View
    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-200">Guest Manifest <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded ml-2">{guests.length} Records</span></h3>
                <button onClick={() => setIsUnlocked(false)} className="text-xs text-slate-400 hover:text-white">Lock Table</button>
            </div>
            
            <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900 text-xs uppercase font-medium text-slate-500 sticky top-0">
                        <tr>
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3">Phone</th>
                            <th className="px-6 py-3">Seat</th>
                            <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {guests.map((guest, i) => (
                            <tr key={i} className="hover:bg-slate-700/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-white">{guest.name}</td>
                                <td className="px-6 py-4 font-mono">{guest.phone}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-slate-700 text-white px-2 py-1 rounded text-xs">{guest.seat}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => handleDelete(guest.name)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10 p-1 rounded transition-colors">
                                        <DeleteIcon fontSize="small" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}