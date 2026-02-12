import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Chip,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import apiClient from '../../api/client';
import { useTranslation } from 'react-i18next';

export default function RFPList() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
  queryKey: ['rfps'],
  queryFn: async () => {
    const response = await apiClient.get('/rfp');
    return response.data.rfps;
  },
});

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">{t('modules.rfp')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/rfp/create')}
        >
          {t('rfp.create')}
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>RFP Number</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Owner</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data && data.length > 0 ? (
              data.map((rfp: any) => (
                <TableRow key={rfp.id}>
                  <TableCell>{rfp.rfp_number}</TableCell>
                  <TableCell>{rfp.title}</TableCell>
                  <TableCell>
                    <Chip label={rfp.status} size="small" />
                  </TableCell>
                  <TableCell>
                    {rfp.due_date ? new Date(rfp.due_date).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>{rfp.owner_name || '-'}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={() => navigate(`/rfp/${rfp.id}`)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No RFPs found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
