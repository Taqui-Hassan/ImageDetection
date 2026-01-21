import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, Box, CircularProgress } from '@mui/material';

export default function GuestList() {
    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL}/guests`, {
            headers: {
                "ngrok-skip-browser-warning": "true",
                "Content-Type": "application/json"
            }
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
    }, []);

    if (loading) return <Box textAlign="center"><CircularProgress /></Box>;

    return (
        <Box mt={4}>
            <Typography variant="h6" gutterBottom color="primary" fontWeight="bold">
                Enrolled Guest List ({guests.length})
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 300, border: '1px solid #ddd' }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ bgcolor: '#f5f5f5' }}><strong>Name</strong></TableCell>
                            <TableCell sx={{ bgcolor: '#f5f5f5' }}><strong>Phone Number</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {/* Ensure guests is an array before mapping */}
                        {Array.isArray(guests) && guests.map((guest, index) => (
                            <TableRow key={index} hover>
                                <TableCell>{guest.name}</TableCell>
                                <TableCell>{guest.phone}</TableCell>
                            </TableRow>
                        ))}
                        {guests.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={2} align="center" sx={{ py: 3 }}>
                                    No guests enrolled yet. Upload an Excel file.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}