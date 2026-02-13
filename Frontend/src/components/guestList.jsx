console.log("GuestList Loaded - V2");
import React, { useEffect, useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock'; // 🛠️ FIXED: Added missing import

export default function GuestList() {
    const [guests, setGuests] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    
    // 🛠️ FIXED: Added password state
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [password, setPassword] = useState(""); 

    const handleUnlock = (e) => {
        e.preventDefault();
        // 🔐 Uses the password from your .env file
        if (password === import.meta.env.VITE_GUEST_LIST_PASSWORD) {
            setIsUnlocked(true);
            // 🛠️ FIXED: Removed undefined fetchConfig(), it fetches automatically via useEffect
        } else {
            alert("Incorrect Password");
        }
    };

    const fetchGuests = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/guests`, {
                headers: { "ngrok-skip-browser-warning": "true" }
            });
            const data = await res.json();
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
        const interval = setInterval(fetchGuests, 5000);
        return () => clearInterval(interval);
    }, []);

    // TOGGLE STATUS
    const handleToggle = async (name, currentStatus) => {
        setGuests(prev => prev.map(g => g.name === name ? { ...g, entered: !currentStatus } : g));
        try {
            await fetch(`${import.meta.env.VITE_API_URL}/guests/${encodeURIComponent(name)}/toggle`, { method: 'PUT' });
        } catch (err) {
            setGuests(prev => prev.map(g => g.name === name ? { ...g, entered: currentStatus } : g));
            alert("Connection Error");
        }
    };

    // DELETE GUEST
    const handleDelete = async (name) => {
        if (!window.confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return;

        // Optimistic UI Update
        setGuests(prev => prev.filter(g => g.name !== name));

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/guests/${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error("Delete failed");
        } catch (err) {
            alert("Failed to delete guest from server.");
            fetchGuests(); // Revert
        }
    };

    const filteredGuests = guests.filter(g => 
        g.name.toLowerCase().includes(search.toLowerCase()) || 
        (g.phone && g.phone.includes(search)) || // Safety check for missing phone
        (g.seat && g.seat.toLowerCase().includes(search.toLowerCase())) // Safety check for missing seat
    );

    const enteredCount = guests.filter(g => g.entered).length;

    // --- LOCK SCREEN ---
    if (!isUnlocked) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] animate-fade-in">
                <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 text-center max-w-sm w-full">
                    <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LockIcon className="text-slate-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-4">Protected Guest List</h2>
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

    // --- MAIN GUEST LIST ---
    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            {/* STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <h3 className="text-slate-400 text-sm font-bold uppercase">Total Guests</h3>
                    <p className="text-3xl font-bold text-white mt-1">{guests.length}</p>
                </div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <h3 className="text-green-400 text-sm font-bold uppercase">Checked In</h3>
                    <p className="text-3xl font-bold text-white mt-1">{enteredCount}</p>
                </div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <h3 className="text-red-400 text-sm font-bold uppercase">Not Arrived</h3>
                    <p className="text-3xl font-bold text-white mt-1">{guests.length - enteredCount}</p>
                </div>
            </div>

            {/* SEARCH */}
            <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-4 top-3.5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search guests..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <button onClick={fetchGuests} className="bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-xl border border-slate-700">
                    <RefreshIcon className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* TABLE */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/50 border-b border-slate-700 text-xs uppercase text-slate-400">
                                <th className="p-4">Status</th>
                                <th className="p-4">Name</th>
                                <th className="p-4 hidden md:table-cell">Phone</th>
                                <th className="p-4 hidden md:table-cell">Seat</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {filteredGuests.map((guest) => (
                                <tr key={guest.name} className="hover:bg-slate-700/30 transition-colors group">
                                    <td className="p-4">
                                        {guest.entered ? 
                                            <span className="text-green-400 font-bold text-xs bg-green-500/10 px-2 py-1 rounded">IN</span> : 
                                            <span className="text-red-400 font-bold text-xs bg-red-500/10 px-2 py-1 rounded">OUT</span>
                                        }
                                    </td>
                                    <td className="p-4 font-medium text-white">{guest.name}</td>
                                    <td className="p-4 text-slate-400 hidden md:table-cell text-sm">{guest.phone}</td>
                                    <td className="p-4 text-slate-300 hidden md:table-cell">{guest.seat}</td>
                                    <td className="p-4 text-right flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleToggle(guest.name, guest.entered)}
                                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                                                guest.entered ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-blue-600 text-white hover:bg-blue-500'
                                            }`}
                                        >
                                            {guest.entered ? "Mark Out" : "Mark In"}
                                        </button>
                                        
                                        {/* DELETE BUTTON */}
                                        <button
                                            onClick={() => handleDelete(guest.name)}
                                            className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Delete Guest"
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}