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
} from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import AddOutlined from '@mui/icons-material/AddOutlined';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import apiClient from '../../api/client';
import { useTranslation } from 'react-i18next';

type Metric = {
  id: string;
  metric_name: string;
  metric_value: number;
  target_value: number;
  unit: string;
  score: number;
};

type Scorecard = {
  id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  contract_id?: string | null;
  period_start: string;
  period_end: string;
  overall_score: number;
  ai_generated?: boolean;
  ai_confidence?: number | null;
  ai_rationale?: string | null;
  metrics: Metric[];
};

type Penalty = {
  id: string;
  vendor_id: string;
  vendor_name: string;
  contract_id?: string | null;
  penalty_type: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  ai_suggested?: boolean;
  ai_rationale?: string | null;
  bias_flag?: {
    flagged: boolean;
    reason?: string;
    requires_review?: boolean;
  };
};

export default function PerformanceDashboard() {
  const { t } = useTranslation();
  const [vendorFilter, setVendorFilter] = useState('');
  const [selectedScorecard, setSelectedScorecard] = useState<Scorecard | null>(null);
  const [selectedPenalty, setSelectedPenalty] = useState<Penalty | null>(null);
  const [isCreateScorecardOpen, setIsCreateScorecardOpen] = useState(false);
  const [newVendorId, setNewVendorId] = useState('');
  const [newContractId, setNewContractId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const {
    data: scorecardData,
    isLoading: isScorecardLoading,
    isError: isScorecardError,
    error: scorecardError,
    refetch: refetchScorecards,
    isFetching: isScorecardFetching,
  } = useQuery({
    queryKey: ['performance-scorecards', { vendor_id: vendorFilter }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (vendorFilter) params.vendor_id = vendorFilter;
      const response = await apiClient.get('/performance/scorecards', { params });
      return response.data.scorecards as Scorecard[];
    },
  });

  const {
    data: penaltyData,
    isLoading: isPenaltyLoading,
    isError: isPenaltyError,
    error: penaltyError,
    refetch: refetchPenalties,
  } = useQuery({
    queryKey: ['performance-penalties'],
    queryFn: async () => {
      const response = await apiClient.get('/performance/penalties');
      return response.data.penalties as Penalty[];
    },
  });

  const createScorecardMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        vendor_id: newVendorId,
        contract_id: newContractId || undefined,
        period_start: periodStart,
        period_end: periodEnd,
      };
      const response = await apiClient.post('/performance/scorecards', payload);
      return response.data;
    },
    onSuccess: () => {
      setIsCreateScorecardOpen(false);
      setNewVendorId('');
      setNewContractId('');
      setPeriodStart('');
      setPeriodEnd('');
      refetchScorecards();
    },
  });

  const approvePenaltyMutation = useMutation({
    mutationFn: async (penaltyId: string) => {
      const response = await apiClient.post(`/performance/penalties/${penaltyId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      refetchPenalties();
    },
  });

  const scorecards = scorecardData || [];
  const penalties = penaltyData || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('performance.title', 'Vendor Performance Management')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'performance.subtitle',
              'AI-assisted scorecards and penalty suggestions are advisory only. All actions require human approval and are fully auditable.'
            )}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={() => setIsCreateScorecardOpen(true)}
        >
          {t('performance.createScorecard', 'New Scorecard')}
        </Button>
      </Box>

      {(isScorecardLoading || isScorecardFetching) && (
        <LinearProgress aria-label={t('common.loading', 'Loading...')} />
      )}

      {isScorecardError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetchScorecards()}>
              {t('performance.retry', 'Retry')}
            </Button>
          }
        >
          {scorecardError instanceof Error
            ? scorecardError.message
            : t(
                'performance.loadError',
                'Unable to load performance scorecards. Please try again.'
              )}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        <Box sx={{ flex: 2 }}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                label={t('performance.filters.vendorId', 'Vendor ID filter')}
                size="small"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                sx={{ minWidth: 220 }}
              />
            </Box>

            <TableContainer>
              <Table
                size="small"
                aria-label={t('performance.table.aria', 'Scorecards table')}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>{t('performance.columns.vendor', 'Vendor')}</TableCell>
                    <TableCell>{t('performance.columns.period', 'Period')}</TableCell>
                    <TableCell>{t('performance.columns.overallScore', 'Overall score')}</TableCell>
                    <TableCell>{t('performance.columns.ai', 'AI')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scorecards.length === 0 && !isScorecardLoading ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'performance.empty',
                            'No scorecards yet. Generate one to see AI-assisted performance insights.'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    scorecards.map((sc) => (
                      <TableRow
                        key={sc.id}
                        hover
                        tabIndex={0}
                        role="button"
                        selected={selectedScorecard?.id === sc.id}
                        onClick={() => setSelectedScorecard(sc)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedScorecard(sc);
                          }
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography variant="body2">{sc.vendor_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {sc.vendor_code}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(sc.period_start).toLocaleDateString()} –{' '}
                            {new Date(sc.period_end).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={sc.overall_score.toFixed(1)}
                            size="small"
                            color={sc.overall_score >= 85 ? 'success' : sc.overall_score >= 70 ? 'warning' : 'error'}
                          />
                        </TableCell>
                        <TableCell>
                          {sc.ai_generated && (
                            <Tooltip
                              title={
                                sc.ai_rationale ||
                                t(
                                  'performance.aiScorecardRationale',
                                  'Generated from SLA, delivery, and quality metrics.'
                                )
                              }
                            >
                              <Chip
                                icon={<InfoOutlined fontSize="small" />}
                                label={t('performance.aiScorecard', 'AI Scorecard')}
                                size="small"
                                variant="outlined"
                                color="primary"
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

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {t('performance.penalties.title', 'Penalty suggestions')}
            </Typography>

            {isPenaltyLoading && (
              <LinearProgress aria-label={t('common.loading', 'Loading...')} />
            )}

            {isPenaltyError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                action={
                  <Button color="inherit" size="small" onClick={() => refetchPenalties()}>
                    {t('performance.retry', 'Retry')}
                  </Button>
                }
              >
                {penaltyError instanceof Error
                  ? penaltyError.message
                  : t(
                      'performance.penalties.loadError',
                      'Unable to load penalties. Please try again.'
                    )}
              </Alert>
            )}

            <TableContainer>
              <Table
                size="small"
                aria-label={t('performance.penalties.tableAria', 'Penalties table')}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>{t('performance.penalties.columns.vendor', 'Vendor')}</TableCell>
                    <TableCell>{t('performance.penalties.columns.type', 'Type')}</TableCell>
                    <TableCell>{t('performance.penalties.columns.amount', 'Amount')}</TableCell>
                    <TableCell>{t('performance.penalties.columns.status', 'Status')}</TableCell>
                    <TableCell>{t('performance.penalties.columns.bias', 'Bias')}</TableCell>
                    <TableCell align="right">
                      {t('performance.penalties.columns.actions', 'Actions')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {penalties.length === 0 && !isPenaltyLoading ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'performance.penalties.empty',
                            'No penalties recorded yet. AI suggestions will appear here for human approval.'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    penalties.map((p) => (
                      <TableRow
                        key={p.id}
                        hover
                        tabIndex={0}
                        role="button"
                        selected={selectedPenalty?.id === p.id}
                        onClick={() => setSelectedPenalty(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedPenalty(p);
                          }
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{p.vendor_name}</TableCell>
                        <TableCell>{p.penalty_type}</TableCell>
                        <TableCell>
                          {p.amount.toLocaleString(undefined, {
                            style: 'currency',
                            currency: p.currency || 'USD',
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={p.status}
                            size="small"
                            color={
                              p.status === 'approved'
                                ? 'success'
                                : p.status === 'pending'
                                ? 'warning'
                                : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {p.bias_flag?.flagged ? (
                            <Tooltip
                              title={
                                p.bias_flag.reason ||
                                t(
                                  'performance.penalties.biasFlagTooltip',
                                  'Bias pattern detected. Requires explicit review.'
                                )
                              }
                            >
                              <Chip
                                icon={<InfoOutlined fontSize="small" />}
                                label={t('ai.biasFlagged', 'Bias Flagged')}
                                size="small"
                                color="error"
                                variant="outlined"
                              />
                            </Tooltip>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {t(
                                'performance.penalties.noBias',
                                'No bias patterns detected'
                              )}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {p.status === 'pending' && (
                            <Tooltip
                              title={t(
                                'performance.penalties.approveTooltip',
                                'Approve this penalty. No penalty is enforced automatically.'
                              )}
                            >
                              <span>
                                <IconButton
                                  aria-label={t(
                                    'performance.penalties.approve',
                                    'Approve penalty'
                                  )}
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    approvePenaltyMutation.mutate(p.id);
                                  }}
                                  disabled={approvePenaltyMutation.isLoading}
                                >
                                  <CheckCircleOutline fontSize="small" />
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
          <Paper sx={{ p: 2, mb: 2 }} aria-live="polite">
            {!selectedScorecard && (
              <Typography variant="body2" color="text.secondary">
                {t(
                  'performance.detail.placeholder',
                  'Select a scorecard to see AI explanation, metrics, and confidence levels.'
                )}
              </Typography>
            )}

            {selectedScorecard && (
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
                    <Typography variant="h6">{selectedScorecard.vendor_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedScorecard.vendor_code}
                    </Typography>
                  </Box>
                  {selectedScorecard.ai_generated && (
                    <Tooltip
                      title={
                        selectedScorecard.ai_rationale ||
                        t(
                          'performance.aiScorecardRationale',
                          'Generated from SLA, delivery, and quality metrics.'
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
                </Box>

                <Typography variant="body2" color="text.secondary">
                  {t('performance.detail.periodLabel', 'Period')}:&nbsp;
                  {new Date(selectedScorecard.period_start).toLocaleDateString()} –{' '}
                  {new Date(selectedScorecard.period_end).toLocaleDateString()}
                </Typography>

                {selectedScorecard.ai_generated && (
                  <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                    <Typography variant="body2">
                      {t(
                        'performance.detail.aiAdvisory',
                        'This scorecard is AI-assisted and advisory only. Any penalties or actions derived from it must be explicitly approved by a human.'
                      )}
                    </Typography>
                    {typeof selectedScorecard.ai_confidence === 'number' && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {t('ai.confidence', 'Confidence')}:&nbsp;
                        {(selectedScorecard.ai_confidence * 100).toFixed(0)}%
                      </Typography>
                    )}
                  </Alert>
                )}

                <Divider sx={{ my: 1.5 }} />

                <Typography variant="subtitle2" gutterBottom>
                  {t('performance.detail.metricsTitle', 'Key metrics')}
                </Typography>

                {selectedScorecard.metrics && selectedScorecard.metrics.length > 0 ? (
                  <TableContainer>
                    <Table size="small" aria-label={t('performance.detail.metricsAria', 'Metrics')}>
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('performance.metrics.name', 'Metric')}</TableCell>
                          <TableCell>{t('performance.metrics.actual', 'Actual')}</TableCell>
                          <TableCell>{t('performance.metrics.target', 'Target')}</TableCell>
                          <TableCell>{t('performance.metrics.score', 'Score')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedScorecard.metrics.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell>{m.metric_name}</TableCell>
                            <TableCell>
                              {m.metric_value} {m.unit}
                            </TableCell>
                            <TableCell>
                              {m.target_value} {m.unit}
                            </TableCell>
                            <TableCell>{m.score}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      'performance.detail.metricsEmpty',
                      'No detailed metrics available for this scorecard.'
                    )}
                  </Typography>
                )}
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {t('performance.guidance.title', 'Explainability & override guidance')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'performance.guidance.text',
                'AI-generated trends and penalties are suggestions only. All enforcement requires explicit human approval, and any overrides or approvals are logged for audit.'
              )}
            </Typography>
          </Paper>
        </Box>
      </Box>

      <Dialog
        open={isCreateScorecardOpen}
        onClose={() => {
          if (!createScorecardMutation.isLoading) setIsCreateScorecardOpen(false);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="create-scorecard-dialog-title"
      >
        <DialogTitle id="create-scorecard-dialog-title">
          {t('performance.createScorecard', 'New Scorecard')}
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t(
                'performance.createInfo',
                'The system will propose an AI-generated scorecard based on SLA, delivery, and quality data. The result is advisory only and can be overridden or discarded.'
              )}
            </Typography>
          </Alert>

          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              createScorecardMutation.mutate();
            }}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              label={t('performance.fields.vendorId', 'Vendor ID')}
              value={newVendorId}
              onChange={(e) => setNewVendorId(e.target.value)}
              required
              fullWidth
            />

            <TextField
              label={t('performance.fields.contractId', 'Contract ID (optional)')}
              value={newContractId}
              onChange={(e) => setNewContractId(e.target.value)}
              fullWidth
            />

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label={t('performance.fields.periodStart', 'Period start')}
                type="date"
                InputLabelProps={{ shrink: true }}
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
                sx={{ minWidth: 180 }}
              />
              <TextField
                label={t('performance.fields.periodEnd', 'Period end')}
                type="date"
                InputLabelProps={{ shrink: true }}
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
                sx={{ minWidth: 180 }}
              />
            </Box>

            {createScorecardMutation.isError && (
              <Alert severity="error">
                {createScorecardMutation.error instanceof Error
                  ? createScorecardMutation.error.message
                  : t(
                      'performance.createError',
                      'Unable to create scorecard. Please verify the fields and try again.'
                    )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!createScorecardMutation.isLoading) setIsCreateScorecardOpen(false);
            }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={() => createScorecardMutation.mutate()}
            variant="contained"
            disabled={createScorecardMutation.isLoading}
          >
            {t('common.create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
