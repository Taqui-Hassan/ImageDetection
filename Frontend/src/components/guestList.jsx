import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, Box, CircularProgress, Button, TextField, Alert } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock'; // Make sure to install or use text if icon fails

export default function GuestList() {
    // --- AUTH STATE ---
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    // --- DATA STATE ---
    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(true);

    // Function to handle unlocking
    const handleUnlock = () => {
        // 👇 SET YOUR GUEST LIST PASSWORD HERE
        if (password === "list2024") {
            setIsUnlocked(true);
            fetchGuests(); // Only fetch data AFTER unlocking
        } else {
            setError("Wrong password");
        }
    };

    // Function to fetch the list
    const fetchGuests = () => {
        setLoading(true);
        fetch(`${import.meta.env.VITE_API_URL}/guests`, {
            headers: { "ngrok-skip-browser-warning": "true" }
        })
        .then(res => res.json())
        .then(data => {
            setGuests(data);
            setLoading(false);
        })
        .catch(err => {
            console.error("Error fetching guests:", err);
            setLoading(false);
        });
    };

    const handleDelete = async (name) => {
        if (!window.confirm(`Are you sure you want to remove ${name}?`)) return;

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/guests/${name}`, {
                method: "DELETE",
                headers: { "ngrok-skip-browser-warning": "true" }
            });

            if (res.ok) {
                setGuests(prev => prev.filter(g => g.name !== name));
            } else {
                alert("Failed to delete guest");
            }
        } catch (err) {
            alert("Error connecting to server");
        }
    };

    // 🔒 LOCKED VIEW
    if (!isUnlocked) {
        return (
            <Box mt={4} textAlign="center">
                <Typography variant="h6" gutterBottom color="textSecondary">
                    🔒 Protected Guest List
                </Typography>
                <Paper sx={{ p: 3, maxWidth: 400, mx: 'auto', bgcolor: '#f8f9fa' }} elevation={0} variant="outlined">
                    <Typography variant="body2" gutterBottom>
                        Enter admin password to view/edit the list.
                    </Typography>
                    <Box display="flex" gap={2} mt={2} justifyContent="center">
                        <TextField 
                            size="small"
                            type="password" 
                            label="List Password" 
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError("");
                            }}
                            onKeyPress={(e) => e.key === 'Enter' && handleUnlock()}
                        />
                        <Button variant="contained" onClick={handleUnlock}>
                            Unlock
                        </Button>
                    </Box>
                    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                </Paper>
            </Box>
        );
    }

    // 🔓 UNLOCKED VIEW (Normal List)
    if (loading) return <Box textAlign="center" mt={4}><CircularProgress /></Box>;

    return (
        <Box mt={4}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" color="primary" fontWeight="bold">
                    Enrolled Guest List ({guests.length})
                </Typography>
                <Button size="small" color="inherit" onClick={() => setIsUnlocked(false)}>
                    Lock List 🔒
                </Button>
            </Box>

            <TableContainer component={Paper} sx={{ maxHeight: 300, border: '1px solid #ddd' }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ bgcolor: '#f5f5f5' }}><strong>Name</strong></TableCell>
                            <TableCell sx={{ bgcolor: '#f5f5f5' }}><strong>Phone</strong></TableCell>
                            <TableCell sx={{ bgcolor: '#f5f5f5' }}><strong>Seat</strong></TableCell>
                            <TableCell sx={{ bgcolor: '#f5f5f5', textAlign: 'center' }}><strong>Action</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {Array.isArray(guests) && guests.map((guest, index) => (
                            <TableRow key={index} hover>
                                <TableCell>{guest.name}</TableCell>
                                <TableCell>{guest.phone}</TableCell>
                                <TableCell>{guest.seat}</TableCell>
                                <TableCell align="center">
                                    <Button 
                                        variant="contained" 
                                        color="error" 
                                        size="small"
                                        onClick={() => handleDelete(guest.name)}
                                        sx={{ minWidth: '30px', px: 2 }}
                                    >
                                        X
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {guests.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                                    No guests found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}