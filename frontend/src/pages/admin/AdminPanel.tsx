import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Typography,
  Box,
  Paper,
  Alert,
  Button,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  TextField,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/client';

type AuditLog = {
  id: string;
  user_id: string;
  module: string;
  action: string;
  ip_address?: string | null;
  context?: any;
  timestamp: string;
};

type Vendor = {
  id: string;
  vendor_code: string;
  name: string;
  legal_name?: string | null;
  status?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
};

export default function AdminPanel() {
  const { t } = useTranslation();

  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [logsLimit, setLogsLimit] = useState('100');
  const [vendorStatusFilter, setVendorStatusFilter] = useState('');

  const [isCreateVendorOpen, setIsCreateVendorOpen] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCode, setNewVendorCode] = useState('');
  const [newLegalName, setNewLegalName] = useState('');
  const [newTaxId, setNewTaxId] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const {
    data: logsData,
    isLoading: isLogsLoading,
    isError: isLogsError,
    error: logsError,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['audit-logs', { module: moduleFilter, action: actionFilter, limit: logsLimit }],
    queryFn: async () => {
      const params: Record<string, string> = { limit: logsLimit || '100' };
      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      const response = await apiClient.get('/admin/audit-logs', { params });
      return response.data.logs as AuditLog[];
    },
  });

  const {
    data: vendorsData,
    isLoading: isVendorsLoading,
    isError: isVendorsError,
    error: vendorsError,
    refetch: refetchVendors,
  } = useQuery({
    queryKey: ['admin-vendors', { status: vendorStatusFilter }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (vendorStatusFilter) params.status = vendorStatusFilter;
      const response = await apiClient.get('/admin/vendors', { params });
      return response.data.vendors as Vendor[];
    },
  });

  const createVendorMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: newVendorName,
        vendor_code: newVendorCode,
        legal_name: newLegalName || undefined,
        tax_id: newTaxId || undefined,
        contact_email: newContactEmail || undefined,
        contact_phone: newContactPhone || undefined,
      };

      const response = await apiClient.post('/admin/vendors', payload);
      return response.data;
    },
    onSuccess: () => {
      setIsCreateVendorOpen(false);
      setNewVendorName('');
      setNewVendorCode('');
      setNewLegalName('');
      setNewTaxId('');
      setNewContactEmail('');
      setNewContactPhone('');
      refetchVendors();
    },
  });

  const logs = logsData || [];
  const vendors = vendorsData || [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('admin.title', 'Administration')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t(
          'admin.subtitle',
          'Review immutable audit logs and manage vendor master data in line with data governance and tenant isolation policies.'
        )}
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        <Box sx={{ flex: 2 }}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">
                {t('admin.audit.title', 'Audit logs')}
              </Typography>
              {isLogsLoading && (
                <LinearProgress
                  aria-label={t('common.loading', 'Loading...')}
                  sx={{ width: 160 }}
                />
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                label={t('admin.audit.filters.module', 'Module filter')}
                size="small"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              />
              <TextField
                label={t('admin.audit.filters.action', 'Action contains')}
                size="small"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                sx={{ minWidth: 200 }}
              />
              <TextField
                label={t('admin.audit.filters.limit', 'Max rows')}
                size="small"
                type="number"
                value={logsLimit}
                onChange={(e) => setLogsLimit(e.target.value)}
                sx={{ width: 120 }}
                inputProps={{ min: 10, max: 1000 }}
              />
            </Box>

            {isLogsError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                action={
                  <Button color="inherit" size="small" onClick={() => refetchLogs()}>
                    {t('admin.retry', 'Retry')}
                  </Button>
                }
              >
                {logsError instanceof Error
                  ? logsError.message
                  : t(
                      'admin.audit.loadError',
                      'Unable to load audit logs. Please try again.'
                    )}
              </Alert>
            )}

            <TableContainer>
              <Table size="small" aria-label={t('admin.audit.tableAria', 'Audit logs table')}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('admin.audit.columns.timestamp', 'Timestamp')}</TableCell>
                    <TableCell>{t('admin.audit.columns.user', 'User')}</TableCell>
                    <TableCell>{t('admin.audit.columns.module', 'Module')}</TableCell>
                    <TableCell>{t('admin.audit.columns.action', 'Action')}</TableCell>
                    <TableCell>{t('admin.audit.columns.ip', 'IP')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 && !isLogsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'admin.audit.empty',
                            'No audit entries found for the current filters.'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>{log.user_id}</TableCell>
                        <TableCell>{log.module}</TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{log.ip_address || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">
                {t('admin.vendors.title', 'Vendor master')}
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={() => setIsCreateVendorOpen(true)}
              >
                {t('admin.vendors.create', 'New Vendor')}
              </Button>
            </Box>

            {isVendorsLoading && (
              <LinearProgress aria-label={t('common.loading', 'Loading...')} />
            )}

            {isVendorsError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                action={
                  <Button color="inherit" size="small" onClick={() => refetchVendors()}>
                    {t('admin.retry', 'Retry')}
                  </Button>
                }
              >
                {vendorsError instanceof Error
                  ? vendorsError.message
                  : t(
                      'admin.vendors.loadError',
                      'Unable to load vendors. Please try again.'
                    )}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                select
                size="small"
                label={t('admin.vendors.filters.status', 'Status')}
                value={vendorStatusFilter}
                onChange={(e) => setVendorStatusFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">
                  {t('admin.vendors.filters.allStatuses', 'All statuses')}
                </MenuItem>
                <MenuItem value="active">{t('admin.vendors.status.active', 'Active')}</MenuItem>
                <MenuItem value="inactive">
                  {t('admin.vendors.status.inactive', 'Inactive')}
                </MenuItem>
              </TextField>
            </Box>

            <TableContainer>
              <Table size="small" aria-label={t('admin.vendors.tableAria', 'Vendors table')}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('admin.vendors.columns.code', 'Code')}</TableCell>
                    <TableCell>{t('admin.vendors.columns.name', 'Name')}</TableCell>
                    <TableCell>{t('admin.vendors.columns.status', 'Status')}</TableCell>
                    <TableCell>{t('admin.vendors.columns.email', 'Email')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vendors.length === 0 && !isVendorsLoading ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'admin.vendors.empty',
                            'No vendors found. Add a vendor to populate the master.'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendors.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>{v.vendor_code}</TableCell>
                        <TableCell>{v.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={v.status || 'active'}
                            size="small"
                            color={v.status === 'inactive' ? 'default' : 'success'}
                          />
                        </TableCell>
                        <TableCell>{v.contact_email}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {t('admin.governance.title', 'Governance notes')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'admin.governance.text',
                'Audit logs reflect non-repudiable, tenant-scoped actions only. Vendor data shown here belongs to the current tenant and never crosses tenant boundaries, in line with isolation rules.'
              )}
            </Typography>
          </Paper>
        </Box>
      </Box>

      <Dialog
        open={isCreateVendorOpen}
        onClose={() => {
          if (!createVendorMutation.isLoading) setIsCreateVendorOpen(false);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="create-vendor-dialog-title"
      >
        <DialogTitle id="create-vendor-dialog-title">
          {t('admin.vendors.create', 'New Vendor')}
        </DialogTitle>
        <DialogContent dividers>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              createVendorMutation.mutate();
            }}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              label={t('admin.vendors.fields.name', 'Vendor name')}
              value={newVendorName}
              onChange={(e) => setNewVendorName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label={t('admin.vendors.fields.code', 'Vendor code')}
              value={newVendorCode}
              onChange={(e) => setNewVendorCode(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label={t('admin.vendors.fields.legalName', 'Legal name (optional)')}
              value={newLegalName}
              onChange={(e) => setNewLegalName(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('admin.vendors.fields.taxId', 'Tax ID (optional)')}
              value={newTaxId}
              onChange={(e) => setNewTaxId(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('admin.vendors.fields.email', 'Contact email (optional)')}
              value={newContactEmail}
              onChange={(e) => setNewContactEmail(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('admin.vendors.fields.phone', 'Contact phone (optional)')}
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
              fullWidth
            />

            {createVendorMutation.isError && (
              <Alert severity="error">
                {createVendorMutation.error instanceof Error
                  ? createVendorMutation.error.message
                  : t(
                      'admin.vendors.createError',
                      'Unable to create vendor. Please verify fields and try again.'
                    )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!createVendorMutation.isLoading) setIsCreateVendorOpen(false);
            }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={() => createVendorMutation.mutate()}
            variant="contained"
            disabled={createVendorMutation.isLoading}
          >
            {t('common.create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
