import React, { useEffect, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function GuestList() {
    const [guests, setGuests] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    // 1. Fetch Guests from Backend
    const fetchGuests = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/guests`, {
                headers: { "ngrok-skip-browser-warning": "true" }
            });
            const data = await res.json();
            // Sort: Entered guests first, then alphabetical
            const sorted = data.sort((a, b) => (b.entered === a.entered) ? 0 : b.entered ? 1 : -1);
            setGuests(sorted);
        } catch (err) {
            console.error("Failed to load guests", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGuests();
        // Optional: Auto-refresh every 5 seconds to see live updates from other devices
        const interval = setInterval(fetchGuests, 5000);
        return () => clearInterval(interval);
    }, []);

    // 2. The Fixed Toggle Logic (Optimistic Update)
    const handleToggle = async (name, currentStatus) => {
        // A. INSTANTLY flip the status in UI (User feels zero lag)
        setGuests(prevGuests => prevGuests.map(guest => 
            guest.name === name ? { ...guest, entered: !currentStatus } : guest
        ));

        // B. Send update to Backend silently
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/guests/${encodeURIComponent(name)}/toggle`, {
                method: 'PUT'
            });
            
            if (!res.ok) {
                throw new Error("Server failed");
            }
        } catch (err) {
            console.error("Toggle failed, reverting UI:", err);
            // C. If server fails, FLIP IT BACK (Undo)
            setGuests(prevGuests => prevGuests.map(guest => 
                guest.name === name ? { ...guest, entered: currentStatus } : guest
            ));
            alert("Connection Error: Could not update status.");
        }
    };

    // Filter Logic
    const filteredGuests = guests.filter(g => 
        g.name.toLowerCase().includes(search.toLowerCase()) || 
        g.phone.includes(search) ||
        g.seat.toLowerCase().includes(search.toLowerCase())
    );

    const enteredCount = guests.filter(g => g.entered).length;

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            {/* HEADER STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider">Total Guests</h3>
                    <p className="text-3xl font-bold text-white mt-1">{guests.length}</p>
                </div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-4 opacity-10">
                        <CheckCircleIcon style={{ fontSize: 80 }} />
                    </div>
                    <h3 className="text-green-400 text-sm font-bold uppercase tracking-wider">Checked In</h3>
                    <p className="text-3xl font-bold text-white mt-1">{enteredCount}</p>
                </div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <h3 className="text-red-400 text-sm font-bold uppercase tracking-wider">Not Arrived</h3>
                    <p className="text-3xl font-bold text-white mt-1">{guests.length - enteredCount}</p>
                </div>
            </div>

            {/* SEARCH BAR */}
            <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-4 top-3.5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search by Name, Phone, or Seat..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-md"
                    />
                </div>
                <button 
                    onClick={fetchGuests} 
                    className="bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-xl border border-slate-700 transition-colors"
                    title="Refresh List"
                >
                    <RefreshIcon className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* GUEST LIST TABLE */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/50 border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400">
                                <th className="p-4 font-semibold">Status</th>
                                <th className="p-4 font-semibold">Name</th>
                                <th className="p-4 font-semibold hidden md:table-cell">Phone</th>
                                <th className="p-4 font-semibold hidden md:table-cell">Seat</th>
                                <th className="p-4 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {filteredGuests.length > 0 ? (
                                filteredGuests.map((guest) => (
                                    <tr key={guest.name} className="hover:bg-slate-700/30 transition-colors group">
                                        <td className="p-4">
                                            {guest.entered ? (
                                                <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs font-bold border border-green-500/20">
                                                    <CheckCircleIcon style={{ fontSize: 14 }} /> IN
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 px-2 py-1 rounded text-xs font-bold border border-red-500/20">
                                                    <CancelIcon style={{ fontSize: 14 }} /> OUT
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 font-medium text-white">
                                            {guest.name}
                                        </td>
                                        <td className="p-4 text-slate-400 hidden md:table-cell font-mono text-sm">
                                            {guest.phone}
                                        </td>
                                        <td className="p-4 text-slate-300 hidden md:table-cell">
                                            {guest.seat}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleToggle(guest.name, guest.entered)}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md ${
                                                    guest.entered 
                                                    ? 'bg-slate-700 text-slate-300 hover:bg-red-600 hover:text-white border border-slate-600'
                                                    : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-105'
                                                }`}
                                            >
                                                {guest.entered ? "Mark Out" : "Mark In"}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-500">
                                        No guests found matching "{search}"
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <p className="text-center text-slate-500 text-xs mt-4">
                Showing {filteredGuests.length} of {guests.length} guests. Auto-refreshes every 5s.
            </p>
        </div>
    );
}