import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Typography,
  TextField,
  Button,
  Box,
  Paper,
  Alert,
} from '@mui/material';
import apiClient from '../../api/client';
import { useTranslation } from 'react-i18next';

export default function RFPCreate() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

const mutation = useMutation({
  mutationFn: async (data: any) => {
    const response = await apiClient.post('/rfp', data);
    return response.data;
  },
  onSuccess: (data) => {
    navigate(`/rfp/${data.rfp.id}`);
  },
});
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      title,
      description,
      due_date: dueDate || undefined,
    });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('rfp.create')}
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Due Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            sx={{ mb: 2 }}
          />
          {mutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'An error occurred'}
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button type="submit" variant="contained" disabled={mutation.isLoading}>
              {t('common.create')}
            </Button>
            <Button variant="outlined" onClick={() => navigate('/rfp')}>
              {t('common.cancel')}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}
