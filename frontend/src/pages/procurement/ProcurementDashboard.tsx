import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Chip,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import AddOutlined from '@mui/icons-material/AddOutlined';
import apiClient from '../../api/client';
import { useTranslation } from 'react-i18next';

type PurchaseOrder = {
  id: string;
  po_number: string;
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  contract_id?: string | null;
  total_amount: number;
  currency: string;
  status: string;
  erp_system?: string | null;
  erp_sync_status?: string | null;
  erp_sync_error?: string | null;
  erp_po_id?: string | null;
  created_at?: string | null;
};

type Onboarding = {
  id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  onboarding_steps: { step: string; status: string }[];
  status: string;
  created_at?: string | null;
};

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

export default function ProcurementDashboard() {
  const { t } = useTranslation();

  const [poStatusFilter, setPoStatusFilter] = useState('');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newVendorId, setNewVendorId] = useState('');
  const [newContractId, setNewContractId] = useState('');
  const [newCurrency, setNewCurrency] = useState('USD');
  const [newERPSystem, setNewERPSystem] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0 },
  ]);

  const {
    data: poData,
    isLoading: isPoLoading,
    isError: isPoError,
    error: poError,
    refetch: refetchPOs,
    isFetching: isPoFetching,
  } = useQuery({
    queryKey: ['purchase-orders', { status: poStatusFilter }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (poStatusFilter) params.status = poStatusFilter;
      const response = await apiClient.get('/procurement/purchase-orders', { params });
      return response.data.purchase_orders as PurchaseOrder[];
    },
  });

  const {
    data: onboardingData,
    isLoading: isOnboardingLoading,
    isError: isOnboardingError,
    error: onboardingError,
    refetch: refetchOnboarding,
  } = useQuery({
    queryKey: ['onboarding'],
    queryFn: async () => {
      const response = await apiClient.get('/procurement/onboarding');
      return response.data.onboarding as Onboarding[];
    },
  });

  const createPOMutation = useMutation({
    mutationFn: async () => {
      const items = lineItems.filter(
        (li) => li.description.trim() && li.quantity > 0 && li.unit_price >= 0
      );
      const total = items.reduce(
        (sum, li) => sum + li.quantity * li.unit_price,
        0
      );

      const payload: any = {
        vendor_id: newVendorId,
        contract_id: newContractId || undefined,
        total_amount: total,
        currency: newCurrency,
        line_items: items,
      };

      if (newERPSystem) {
        payload.erp_system = newERPSystem;
      }

      const response = await apiClient.post('/procurement/purchase-orders', payload);
      return response.data;
    },
    onSuccess: () => {
      setIsCreateOpen(false);
      setNewVendorId('');
      setNewContractId('');
      setNewCurrency('USD');
      setNewERPSystem('');
      setLineItems([{ description: '', quantity: 1, unit_price: 0 }]);
      refetchPOs();
    },
  });

  const syncPOMutation = useMutation({
    mutationFn: async (poId: string) => {
      const response = await apiClient.post(`/procurement/purchase-orders/${poId}/sync`);
      return response.data;
    },
    onSuccess: () => {
      refetchPOs();
    },
  });

  const initiateOnboardingMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      const response = await apiClient.post('/procurement/onboarding', {
        vendor_id: vendorId,
      });
      return response.data;
    },
    onSuccess: () => {
      refetchOnboarding();
    },
  });

  const handleAddLineItem = () => {
    setLineItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string) => {
    setLineItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]:
                field === 'description'
                  ? value
                  : Number.isNaN(Number(value))
                  ? 0
                  : Number(value),
            }
          : item
      )
    );
  };

  const purchaseOrders = poData || [];
  const onboarding = onboardingData || [];

  const totalAmountForDialog = lineItems.reduce(
    (sum, li) =>
      li.description.trim() && li.quantity > 0 && li.unit_price >= 0
        ? sum + li.quantity * li.unit_price
        : sum,
    0
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('procurement.title', 'Procurement & Onboarding')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'procurement.subtitle',
              'Create and sync purchase orders with ERP systems and track vendor onboarding with clear, auditable status.'
            )}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={() => setIsCreateOpen(true)}
        >
          {t('procurement.createPO', 'New Purchase Order')}
        </Button>
      </Box>

      {(isPoLoading || isPoFetching) && (
        <LinearProgress aria-label={t('common.loading', 'Loading...')} />
      )}

      {isPoError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetchPOs()}>
              {t('procurement.retry', 'Retry')}
            </Button>
          }
        >
          {poError instanceof Error
            ? poError.message
            : t(
                'procurement.loadError',
                'Unable to load purchase orders. Please check your connection and try again.'
              )}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        <Box sx={{ flex: 2 }}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                select
                size="small"
                label={t('procurement.filters.status', 'Status')}
                value={poStatusFilter}
                onChange={(e) => setPoStatusFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">
                  {t('procurement.filters.allStatuses', 'All statuses')}
                </MenuItem>
                <MenuItem value="draft">{t('procurement.status.draft', 'Draft')}</MenuItem>
                <MenuItem value="submitted">
                  {t('procurement.status.submitted', 'Submitted')}
                </MenuItem>
                <MenuItem value="approved">
                  {t('procurement.status.approved', 'Approved')}
                </MenuItem>
              </TextField>
            </Box>

            <TableContainer>
              <Table
                size="small"
                aria-label={t('procurement.table.aria', 'Purchase orders table')}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>{t('procurement.columns.number', 'PO #')}</TableCell>
                    <TableCell>{t('procurement.columns.vendor', 'Vendor')}</TableCell>
                    <TableCell>{t('procurement.columns.total', 'Total')}</TableCell>
                    <TableCell>{t('procurement.columns.status', 'Status')}</TableCell>
                    <TableCell>{t('procurement.columns.erp', 'ERP Sync')}</TableCell>
                    <TableCell align="right">
                      {t('procurement.columns.actions', 'Actions')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchaseOrders.length === 0 && !isPoLoading ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'procurement.empty',
                            'No purchase orders yet. Create one to begin ERP hand-off.'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    purchaseOrders.map((po) => (
                      <TableRow
                        key={po.id}
                        hover
                        tabIndex={0}
                        role="button"
                        selected={selectedPO?.id === po.id}
                        onClick={() => setSelectedPO(po)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedPO(po);
                          }
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{po.po_number}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{po.vendor_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {po.vendor_code}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {po.total_amount.toLocaleString(undefined, {
                            style: 'currency',
                            currency: po.currency || 'USD',
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={po.status}
                            size="small"
                            color={
                              po.status === 'approved'
                                ? 'success'
                                : po.status === 'submitted'
                                ? 'warning'
                                : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {po.erp_system ? (
                            <Tooltip
                              title={
                                po.erp_sync_error
                                  ? po.erp_sync_error
                                  : po.erp_sync_status === 'synced'
                                  ? t(
                                      'procurement.erp.syncedTooltip',
                                      'Successfully synced to ERP.'
                                    )
                                  : t(
                                      'procurement.erp.pendingTooltip',
                                      'Configured for ERP sync; not yet confirmed.'
                                    )
                              }
                            >
                              <Chip
                                label={
                                  po.erp_sync_status === 'synced'
                                    ? t('procurement.erp.synced', 'Synced')
                                    : po.erp_sync_status === 'failed'
                                    ? t('procurement.erp.failed', 'Failed')
                                    : t('procurement.erp.pending', 'Pending')
                                }
                                size="small"
                                color={
                                  po.erp_sync_status === 'synced'
                                    ? 'success'
                                    : po.erp_sync_status === 'failed'
                                    ? 'error'
                                    : 'default'
                                }
                                variant="outlined"
                              />
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {t(
                                'procurement.erp.notConfigured',
                                'No ERP system configured'
                              )}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {po.erp_system && (
                            <Tooltip
                              title={t(
                                'procurement.erp.manualSync',
                                'Manually trigger ERP sync'
                              )}
                            >
                              <span>
                                <IconButton
                                  aria-label={t(
                                    'procurement.erp.manualSync',
                                    'Manually trigger ERP sync'
                                  )}
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    syncPOMutation.mutate(po.id);
                                  }}
                                  disabled={syncPOMutation.isLoading}
                                >
                                  <SyncIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              {t('procurement.onboarding.title', 'Vendor onboarding')}
            </Typography>

            {isOnboardingLoading && (
              <Box>
                <LinearProgress aria-label={t('common.loading', 'Loading...')} />
              </Box>
            )}

            {isOnboardingError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                action={
                  <Button color="inherit" size="small" onClick={() => refetchOnboarding()}>
                    {t('procurement.retry', 'Retry')}
                  </Button>
                }
              >
                {onboardingError instanceof Error
                  ? onboardingError.message
                  : t(
                      'procurement.onboarding.loadError',
                      'Unable to load onboarding records. Please try again.'
                    )}
              </Alert>
            )}

            <List dense>
              {onboarding.length === 0 && !isOnboardingLoading ? (
                <ListItem>
                  <ListItemText
                    primary={t(
                      'procurement.onboarding.empty',
                      'No onboarding records yet.'
                    )}
                    secondary={t(
                      'procurement.onboarding.emptyHint',
                      'Start onboarding from vendor management or by ID.'
                    )}
                  />
                </ListItem>
              ) : (
                onboarding.map((o) => (
                  <ListItem key={o.id} alignItems="flex-start">
                    <ListItemText
                      primary={`${o.vendor_name} (${o.vendor_code})`}
                      secondary={
                        <Box component="span">
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                          >
                            {t('procurement.onboarding.statusLabel', 'Status')}: {o.status}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                          >
                            {t('procurement.onboarding.stepsLabel', 'Steps')}:{' '}
                            {o.onboarding_steps
                              .map((s) => `${s.step} (${s.status})`)
                              .join(', ')}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                label={t(
                  'procurement.onboarding.vendorIdField',
                  'Vendor ID to initiate onboarding'
                )}
                size="small"
                fullWidth
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value) {
                    initiateOnboardingMutation.mutate(value);
                    e.target.value = '';
                  }
                }}
                helperText={t(
                  'procurement.onboarding.vendorIdHelp',
                  'Paste vendor ID and tab out to initiate onboarding.'
                )}
              />
            </Box>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {t('procurement.guidance.title', 'Integration & error guidance')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'procurement.guidance.text',
                'ERP sync attempts are logged and surfaced here. Persistent failures should be reviewed by an admin using the integration dashboard; no PO changes are lost if sync fails.'
              )}
            </Typography>
          </Paper>
        </Box>
      </Box>

      <Dialog
        open={isCreateOpen}
        onClose={() => {
          if (!createPOMutation.isLoading) setIsCreateOpen(false);
        }}
        fullWidth
        maxWidth="md"
        aria-labelledby="create-po-dialog-title"
      >
        <DialogTitle id="create-po-dialog-title">
          {t('procurement.createPO', 'New Purchase Order')}
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t(
                'procurement.createPoInfo',
                'PO creation is transactional: if ERP sync fails, the PO is still saved locally and errors are clearly surfaced for admin resolution.'
              )}
            </Typography>
          </Alert>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              createPOMutation.mutate();
            }}
          >
            <TextField
              label={t('procurement.fields.vendorId', 'Vendor ID')}
              value={newVendorId}
              onChange={(e) => setNewVendorId(e.target.value)}
              required
              fullWidth
            />

            <TextField
              label={t('procurement.fields.contractId', 'Linked contract (optional)')}
              value={newContractId}
              onChange={(e) => setNewContractId(e.target.value)}
              fullWidth
            />

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                select
                label={t('procurement.fields.currency', 'Currency')}
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="EUR">EUR</MenuItem>
                <MenuItem value="GBP">GBP</MenuItem>
              </TextField>

              <TextField
                select
                label={t('procurement.fields.erpSystem', 'ERP system (optional)')}
                value={newERPSystem}
                onChange={(e) => setNewERPSystem(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">
                  {t('procurement.fields.noErp', 'Do not sync yet')}
                </MenuItem>
                <MenuItem value="SAP">SAP</MenuItem>
                <MenuItem value="Oracle">Oracle</MenuItem>
                <MenuItem value="NetSuite">NetSuite</MenuItem>
              </TextField>
            </Box>

            <Divider />

            <Typography variant="subtitle2">
              {t('procurement.fields.lineItems', 'Line items')}
            </Typography>

            {lineItems.map((item, index) => (
              <Box
                key={index}
                sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}
              >
                <TextField
                  label={t('procurement.fields.description', 'Description')}
                  value={item.description}
                  onChange={(e) =>
                    handleLineItemChange(index, 'description', e.target.value)
                  }
                  sx={{ flex: 2, minWidth: 200 }}
                  required
                />
                <TextField
                  label={t('procurement.fields.quantity', 'Qty')}
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    handleLineItemChange(index, 'quantity', e.target.value)
                  }
                  sx={{ width: 100 }}
                  inputProps={{ min: 1 }}
                  required
                />
                <TextField
                  label={t('procurement.fields.unitPrice', 'Unit price')}
                  type="number"
                  value={item.unit_price}
                  onChange={(e) =>
                    handleLineItemChange(index, 'unit_price', e.target.value)
                  }
                  sx={{ width: 140 }}
                  inputProps={{ min: 0, step: 0.01 }}
                  required
                />
              </Box>
            ))}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button onClick={handleAddLineItem}>
                {t('procurement.fields.addLineItem', 'Add line item')}
              </Button>
              <Typography variant="subtitle2">
                {t('procurement.fields.estimatedTotal', 'Estimated total')}:&nbsp;
                {totalAmountForDialog.toLocaleString(undefined, {
                  style: 'currency',
                  currency: newCurrency || 'USD',
                  maximumFractionDigits: 2,
                })}
      </Typography>
            </Box>

            {createPOMutation.isError && (
              <Alert severity="error">
                {createPOMutation.error instanceof Error
                  ? createPOMutation.error.message
                  : t(
                      'procurement.createPoError',
                      'Unable to create PO. Please verify fields and try again.'
                    )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!createPOMutation.isLoading) setIsCreateOpen(false);
            }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={() => createPOMutation.mutate()}
            variant="contained"
            disabled={createPOMutation.isLoading}
          >
            {t('common.create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
