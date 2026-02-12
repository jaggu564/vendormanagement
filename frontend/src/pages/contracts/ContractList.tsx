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
  Divider,
  LinearProgress,
} from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import AddOutlined from '@mui/icons-material/AddOutlined';
import apiClient from '../../api/client';
import { useTranslation } from 'react-i18next';

type Contract = {
  id: string;
  contract_number: string;
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  contract_type: 'MSA' | 'SOW' | 'PO' | 'Amendment';
  status: string;
  template_version?: string | null;
  ai_generated?: boolean;
  ai_rationale?: string | null;
  effective_date?: string | null;
  expiration_date?: string | null;
};

type Clause = {
  id: string;
  clause_number: string;
  title: string;
  content: string;
  clause_type?: string | null;
  source?: string | null;
  ai_generated?: boolean;
  ai_rationale?: string | null;
};

type ContractVersion = {
  id: string;
  version_number: number;
  created_at: string;
  changed_by_name?: string | null;
  change_summary?: string | null;
};

type ContractDetail = Contract & {
  clauses: Clause[];
  versions: ContractVersion[];
};

export default function ContractList() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newVendorId, setNewVendorId] = useState('');
  const [newType, setNewType] = useState<'MSA' | 'SOW' | 'PO' | 'Amendment'>('MSA');
  const [newTemplateVersion, setNewTemplateVersion] = useState('V2.5');
  const [newContent, setNewContent] = useState('');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['contracts', { status: statusFilter, type: typeFilter }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.contract_type = typeFilter;
      const response = await apiClient.get('/contracts', { params });
      return response.data.contracts as Contract[];
    },
  });

  const {
    data: detailData,
    isLoading: isDetailLoading,
    isError: isDetailError,
    error: detailError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ['contract', selectedContractId],
    queryFn: async () => {
      if (!selectedContractId) return null;
      const response = await apiClient.get(`/contracts/${selectedContractId}`);
      return response.data.contract as ContractDetail;
    },
    enabled: !!selectedContractId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        vendor_id: newVendorId,
        contract_type: newType,
      };

      if (newTemplateVersion) {
        payload.template_version = newTemplateVersion;
      }

      // If content is empty, backend will generate AI-assisted draft
      if (newContent.trim()) {
        payload.content = newContent.trim();
      }

      const response = await apiClient.post('/contracts', payload);
      return response.data;
    },
    onSuccess: (result: any) => {
      setIsCreateOpen(false);
      setNewVendorId('');
      setNewContent('');
      setNewTemplateVersion('V2.5');
      setNewType('MSA');
      refetch();
      if (result?.contract?.id) {
        setSelectedContractId(result.contract.id);
        refetchDetail();
      }
    },
  });

  const handleOpenCreate = () => {
    setIsCreateOpen(true);
  };

  const handleCloseCreate = () => {
    if (createMutation.isLoading) return;
    setIsCreateOpen(false);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const contracts = data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('contracts.title', 'Contracts & MSAs')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'contracts.subtitle',
              'AI-assisted, auditable contract workspace. AI is advisory only; all clauses are reviewable and overrideable.'
            )}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={handleOpenCreate}
        >
          {t('contracts.create', 'New Contract')}
        </Button>
      </Box>

      {(isLoading || isFetching) && <LinearProgress aria-label={t('common.loading')} />}

      {isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              {t('common.retry', 'Retry')}
            </Button>
          }
        >
          {error instanceof Error
            ? error.message
            : t('contracts.loadError', 'Unable to load contracts. Please try again.')}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                mb: 2,
              }}
            >
              <TextField
                select
                size="small"
                label={t('contracts.filters.status', 'Status')}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">
                  {t('contracts.filters.allStatuses', 'All statuses')}
                </MenuItem>
                <MenuItem value="draft">{t('contracts.status.draft', 'Draft')}</MenuItem>
                <MenuItem value="in_review">
                  {t('contracts.status.inReview', 'In Review')}
                </MenuItem>
                <MenuItem value="locked">{t('contracts.status.locked', 'Locked')}</MenuItem>
              </TextField>

              <TextField
                select
                size="small"
                label={t('contracts.filters.type', 'Type')}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">
                  {t('contracts.filters.allTypes', 'All types')}
                </MenuItem>
                <MenuItem value="MSA">MSA</MenuItem>
                <MenuItem value="SOW">SOW</MenuItem>
                <MenuItem value="PO">PO</MenuItem>
                <MenuItem value="Amendment">
                  {t('contracts.type.amendment', 'Amendment')}
                </MenuItem>
              </TextField>
            </Box>

            <TableContainer>
              <Table size="small" aria-label={t('contracts.table.aria', 'Contracts table')}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('contracts.columns.number', 'Contract #')}</TableCell>
                    <TableCell>{t('contracts.columns.vendor', 'Vendor')}</TableCell>
                    <TableCell>{t('contracts.columns.type', 'Type')}</TableCell>
                    <TableCell>{t('contracts.columns.status', 'Status')}</TableCell>
                    <TableCell>{t('contracts.columns.ai', 'AI')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contracts.length === 0 && !isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'contracts.empty',
                            'No contracts yet. Create your first AI-assisted draft to get started.'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    contracts.map((contract) => (
                      <TableRow
                        key={contract.id}
                        hover
                        tabIndex={0}
                        role="button"
                        selected={selectedContractId === contract.id}
                        onClick={() => setSelectedContractId(contract.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedContractId(contract.id);
                          }
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{contract.contract_number}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{contract.vendor_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {contract.vendor_code}
                          </Typography>
                        </TableCell>
                        <TableCell>{contract.contract_type}</TableCell>
                        <TableCell>
                          <Chip
                            label={contract.status}
                            size="small"
                            color={
                              contract.status === 'locked'
                                ? 'success'
                                : contract.status === 'in_review'
                                ? 'warning'
                                : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {contract.ai_generated && (
                            <Tooltip
                              title={
                                contract.ai_rationale ||
                                t(
                                  'contracts.aiDraftRationale',
                                  'AI-drafted based on your preferred templates.'
                                )
                              }
                            >
                              <Chip
                                icon={<InfoOutlined fontSize="small" />}
                                label={t('contracts.aiDraft', 'AI Draft')}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
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
          <Paper sx={{ p: 2, minHeight: 320 }} aria-live="polite">
            {!selectedContractId && (
              <Typography variant="body2" color="text.secondary">
                {t(
                  'contracts.detail.placeholder',
                  'Select a contract to view clauses, AI rationale, and version history.'
                )}
              </Typography>
            )}

            {selectedContractId && isDetailLoading && (
              <Box>
                <LinearProgress aria-label={t('common.loading')} />
                <Typography sx={{ mt: 1 }} variant="body2">
                  {t('contracts.detail.loading', 'Loading contract details...')}
                </Typography>
              </Box>
            )}

            {selectedContractId && isDetailError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                action={
                  <Button color="inherit" size="small" onClick={() => refetchDetail()}>
                    {t('common.retry', 'Retry')}
                  </Button>
                }
              >
                {detailError instanceof Error
                  ? detailError.message
                  : t(
                      'contracts.detail.loadError',
                      'Unable to load contract details. Please try again.'
                    )}
              </Alert>
            )}

            {detailData && !isDetailLoading && (
              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 1,
                  }}
                >
                  <Box>
                    <Typography variant="h6">{detailData.contract_number}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {detailData.vendor_name} ({detailData.contract_type})
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {detailData.ai_generated && (
                      <Tooltip
                        title={
                          detailData.ai_rationale ||
                          t(
                            'contracts.aiDraftExplain',
                            'This draft was generated from your preferred MSA/SOW template.'
                          )
                        }
                      >
                        <IconButton
                          aria-label={t('ai.explain', 'Explain')}
                          size="small"
                        >
                          <InfoOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Chip
                      label={detailData.status}
                      size="small"
                      color={
                        detailData.status === 'locked'
                          ? 'success'
                          : detailData.status === 'in_review'
                          ? 'warning'
                          : 'default'
                      }
                    />
                  </Box>
                </Box>

                {detailData.template_version && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    {t('contracts.templateVersion', 'Template version')}: {detailData.template_version}
                  </Typography>
                )}

                {detailData.ai_generated && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      {t(
                        'contracts.aiAdvisoryBanner',
                        'This contract was AI-assisted. All clauses are advisory only and must be reviewed and approved by a human before finalization.'
                      )}
                    </Typography>
                  </Alert>
                )}

                <Divider sx={{ my: 1 }} />

                <Typography variant="subtitle2" gutterBottom>
                  {t('contracts.clauses.title', 'Clauses & Sources')}
                </Typography>
                {detailData.clauses && detailData.clauses.length > 0 ? (
                  <Box
                    sx={{
                      maxHeight: 220,
                      overflowY: 'auto',
                      pr: 1,
                    }}
                  >
                    {detailData.clauses.map((clause) => (
                      <Box
                        key={clause.id}
                        sx={{
                          mb: 1.5,
                          p: 1,
                          borderRadius: 1,
                          bgcolor: 'background.default',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 0.5,
                          }}
                        >
                          <Typography variant="subtitle2">
                            {clause.clause_number}. {clause.title}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            {clause.source && (
                              <Chip
                                label={t('contracts.clauses.source', {
                                  defaultValue: 'Source: {{source}}',
                                  source: clause.source,
                                })}
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {clause.ai_generated && (
                              <Tooltip
                                title={
                                  clause.ai_rationale ||
                                  t(
                                    'contracts.clauses.aiRationaleDefault',
                                    'Suggested based on buyer preferred template and prior contracts.'
                                  )
                                }
                              >
                                <Chip
                                  icon={<InfoOutlined fontSize="small" />}
                                  label={t('contracts.clauses.aiClause', 'AI Clause')}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {clause.content}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('contracts.clauses.empty', 'No clauses extracted yet.')}
                  </Typography>
                )}

                <Divider sx={{ my: 1.5 }} />

                <Typography variant="subtitle2" gutterBottom>
                  {t('contracts.versions.title', 'Version history')}
                </Typography>
                {detailData.versions && detailData.versions.length > 0 ? (
                  <Box
                    sx={{
                      maxHeight: 120,
                      overflowY: 'auto',
                      pr: 1,
                    }}
                  >
                    {detailData.versions.map((version) => (
                      <Box key={version.id} sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          {t('contracts.versions.versionLabel', {
                            defaultValue: 'Version {{number}}',
                            number: version.version_number,
                          })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {new Date(version.created_at).toLocaleString()}
                          {version.changed_by_name ? ` • ${version.changed_by_name}` : ''}
                        </Typography>
                        {version.change_summary && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {version.change_summary}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('contracts.versions.empty', 'No versions recorded yet.')}
                  </Typography>
                )}
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      <Dialog
        open={isCreateOpen}
        onClose={handleCloseCreate}
        fullWidth
        maxWidth="md"
        aria-labelledby="create-contract-dialog-title"
      >
        <DialogTitle id="create-contract-dialog-title">
          {t('contracts.create', 'New Contract')}
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t(
                'contracts.createAiInfo',
                'If you leave the main content blank, the system will draft a contract using your preferred template. All AI output is advisory only; you can edit, replace, or reject any clause.'
              )}
            </Typography>
          </Alert>

          <Box
            component="form"
            onSubmit={handleCreateSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}
          >
            <TextField
              label={t('contracts.fields.vendorId', 'Vendor ID')}
              value={newVendorId}
              onChange={(e) => setNewVendorId(e.target.value)}
              required
              fullWidth
              helperText={t(
                'contracts.fields.vendorIdHelp',
                'Paste or select the vendor identifier from your vendor master.'
              )}
            />

            <TextField
              select
              label={t('contracts.fields.type', 'Contract type')}
              value={newType}
              onChange={(e) =>
                setNewType(e.target.value as 'MSA' | 'SOW' | 'PO' | 'Amendment')
              }
              required
              fullWidth
            >
              <MenuItem value="MSA">MSA</MenuItem>
              <MenuItem value="SOW">SOW</MenuItem>
              <MenuItem value="PO">PO</MenuItem>
              <MenuItem value="Amendment">
                {t('contracts.type.amendment', 'Amendment')}
              </MenuItem>
            </TextField>

            <TextField
              label={t('contracts.fields.templateVersion', 'Template version')}
              value={newTemplateVersion}
              onChange={(e) => setNewTemplateVersion(e.target.value)}
              fullWidth
              helperText={t(
                'contracts.fields.templateVersionHelp',
                'Used to explain AI suggestions, e.g., “Drafted from buyer MSA template V2.5”.'
              )}
            />

            <TextField
              label={t('contracts.fields.content', 'Initial draft (optional)')}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              fullWidth
              multiline
              minRows={6}
              placeholder={t(
                'contracts.fields.contentPlaceholder',
                'Paste an existing draft or leave blank to let AI propose an initial contract based on your template.'
              )}
            />

            {createMutation.isError && (
              <Alert severity="error">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : t(
                      'contracts.createError',
                      'Unable to create contract. Please check required fields and try again.'
                    )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreate} disabled={createMutation.isLoading}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleCreateSubmit}
            variant="contained"
            disabled={createMutation.isLoading}
          >
            {t('common.create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
