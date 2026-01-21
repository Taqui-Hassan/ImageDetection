import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, Box, CircularProgress, Button, TextField, Chip, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';

export default function GuestList() {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchGuests = (pwd) => {
        setLoading(true); setError("");
        fetch(`${import.meta.env.VITE_API_URL}/guests`, {
            headers: { "ngrok-skip-browser-warning": "true", "x-admin-password": pwd }
        })
        .then(async res => {
            if (res.status === 403) throw new Error("Wrong Password");
            return res.json();
        })
        .then(data => { setGuests(data); setIsUnlocked(true); setLoading(false); })
        .catch(err => { setError("Incorrect Password"); setLoading(false); });
    };

    const handleDelete = async (name) => {
        if (!window.confirm(`Remove ${name}?`)) return;
        const res = await fetch(`${import.meta.env.VITE_API_URL}/guests/${name}`, {
            method: "DELETE",
            headers: { "ngrok-skip-browser-warning": "true" }
        });
        if (res.ok) setGuests(prev => prev.filter(g => g.name !== name));
    };

    // 🔒 LOCKED VIEW
    if (!isUnlocked) {
        return (
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
                <Box sx={{ color: '#94a3b8', mb: 2 }}><LockIcon fontSize="large" /></Box>
                <Typography variant="h6" color="#334155" gutterBottom>Restricted Access</Typography>
                <Box display="flex" gap={1} justifyContent="center" mt={2}>
                    <TextField size="small" type="password" placeholder="List Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <Button variant="contained" onClick={() => fetchGuests(password)} disabled={loading}>
                        {loading ? "..." : "Unlock"}
                    </Button>
                </Box>
                {error && <Typography color="error" variant="caption" display="block" mt={1}>{error}</Typography>}
            </Paper>
        );
    }

    // 🔓 UNLOCKED TABLE
    return (
        <Paper elevation={3} sx={{ overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight="bold">📋 Guest List <Chip label={guests.length} size="small" color="primary" sx={{ ml: 1 }} /></Typography>
                <Button size="small" onClick={() => setIsUnlocked(false)}>Lock 🔒</Button>
            </Box>
            <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 'bold' }}>Name</TableCell>
                            <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 'bold' }}>Phone</TableCell>
                            <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 'bold' }}>Seat</TableCell>
                            <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 'bold' }} align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {guests.map((guest, i) => (
                            <TableRow key={i} hover>
                                <TableCell><Box display="flex" alignItems="center" gap={1}><PersonIcon color="action" fontSize="small"/> {guest.name}</Box></TableCell>
                                <TableCell>{guest.phone}</TableCell>
                                <TableCell><Chip label={guest.seat} size="small" color="secondary" variant="outlined" /></TableCell>
                                <TableCell align="right">
                                    <IconButton color="error" size="small" onClick={() => handleDelete(guest.name)}>
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