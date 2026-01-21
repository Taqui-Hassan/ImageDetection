import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, Box, Button, TextField, Chip, IconButton } from '@mui/material';
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

    if (!isUnlocked) {
        return (
            <Paper sx={{ p: 4, textAlign: 'center', border: '1px dashed #475569', bgcolor: 'transparent' }}>
                <LockIcon sx={{ fontSize: 40, color: '#475569', mb: 2 }} />
                <Typography variant="h6" color="textSecondary" gutterBottom>ENCRYPTED DATABASE</Typography>
                <Box display="flex" gap={1} justifyContent="center" mt={2} maxWidth={300} mx="auto">
                    <TextField size="small" type="password" placeholder="Passcode" value={password} onChange={(e) => setPassword(e.target.value)} 
                        sx={{ bgcolor: '#1e293b' }} />
                    <Button variant="contained" onClick={() => fetchGuests(password)} disabled={loading}>ACCESS</Button>
                </Box>
                {error && <Typography color="error" variant="caption" display="block" mt={1}>{error}</Typography>}
            </Paper>
        );
    }

    return (
        <Paper sx={{ overflow: 'hidden', border: '1px solid #334155' }}>
            <Box sx={{ p: 2, bgcolor: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
                <Typography variant="h6" color="primary">GUEST MANIFEST <span style={{color: '#64748b', fontSize: '0.8em'}}>{guests.length} RECORDS</span></Typography>
                <Button size="small" color="inherit" onClick={() => setIsUnlocked(false)} sx={{ color: '#94a3b8' }}>LOCK</Button>
            </Box>
            <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            {['NAME', 'PHONE', 'SEAT', 'ACTION'].map(head => (
                                <TableCell key={head} sx={{ bgcolor: '#0f172a', color: '#94a3b8', fontSize: '0.75rem', letterSpacing: 1 }}>{head}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {guests.map((guest, i) => (
                            <TableRow key={i} hover sx={{ '&:hover': { bgcolor: '#1e293b !important' } }}>
                                <TableCell sx={{ color: '#fff', fontWeight: 500 }}>{guest.name}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{guest.phone}</TableCell>
                                <TableCell><Chip label={guest.seat} size="small" sx={{ bgcolor: '#334155', color: '#fff', borderRadius: 1, height: 20, fontSize: '0.7rem' }} /></TableCell>
                                <TableCell>
                                    <IconButton size="small" onClick={() => handleDelete(guest.name)} sx={{ color: '#ef4444', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}