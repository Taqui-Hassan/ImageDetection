import React, { useState } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

export default function GuestList() {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [password, setPassword] = useState("");
    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    
    // 👇 NEW: Search State
    const [searchTerm, setSearchTerm] = useState("");

    const fetchGuests = (pwd) => {
        setLoading(true); setError("");
        // Pass the password (if you enabled the check in backend)
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

    // 👇 NEW: Toggle Entry Status
    const handleToggleEntry = async (name) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/guests/${name}/toggle`, {
                method: "PUT", headers: { "ngrok-skip-browser-warning": "true" }
            });
            const data = await res.json();
            
            // Update local state instantly
            if (data.status === "success") {
                setGuests(prev => prev.map(g => 
                    g.name === name ? { ...g, entered: data.entered } : g
                ));
            }
        } catch (err) { console.error("Toggle failed", err); }
    };

    // Filter guests based on search
    const filteredGuests = guests.filter(g => 
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        g.phone.includes(searchTerm)
    );

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
            {/* Header with Search */}
            <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-200">Guest Manifest</h3>
                    <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded">
                        {guests.filter(g => g.entered).length} / {guests.length} Arrived
                    </span>
                </div>

                {/* 👇 SEARCH BAR */}
                <div className="relative w-full sm:w-64">
                    <SearchIcon className="absolute left-2 top-2 text-slate-500" fontSize="small" />
                    <input 
                        type="text" 
                        placeholder="Search Name or Phone..." 
                        className="w-full bg-slate-800 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900 text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3">Status</th> {/* New Column */}
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3">Phone</th>
                            <th className="px-6 py-3">Seat</th>
                            <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {filteredGuests.map((guest, i) => (
                            <tr key={i} className={`hover:bg-slate-700/50 transition-colors ${guest.entered ? 'bg-green-500/5' : ''}`}>
                                
                                {/* 👇 STATUS COLUMN (CLICK TO TOGGLE) */}
                                <td className="px-6 py-4 cursor-pointer" onClick={() => handleToggleEntry(guest.name)}>
                                    {guest.entered ? (
                                        <div className="flex items-center gap-1 text-green-500 font-bold">
                                            <CheckCircleIcon fontSize="small" />
                                            <span className="text-xs">IN</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-slate-600 hover:text-slate-400">
                                            <RadioButtonUncheckedIcon fontSize="small" />
                                            <span className="text-xs">OUT</span>
                                        </div>
                                    )}
                                </td>

                                <td className={`px-6 py-4 font-medium ${guest.entered ? 'text-green-300' : 'text-white'}`}>
                                    {guest.name}
                                </td>
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
                        {filteredGuests.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-slate-500 italic">
                                    No guests found matching "{searchTerm}"
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}