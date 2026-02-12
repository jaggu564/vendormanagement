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
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/client';

type Assessment = {
  id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  assessment_date: string;
  provider: 'Moodys' | 'DnB' | 'SP' | 'internal';
  provider_data?: {
    rating?: string;
    last_updated?: string;
  };
};

type AlertRecord = {
  id: string;
  vendor_id: string;
  vendor_name: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  source: string;
  status: 'active' | 'acknowledged' | 'closed';
  created_at: string;
};

export default function RiskDashboard() {
  const { t } = useTranslation();

  const [vendorFilter, setVendorFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertRecord | null>(null);
  const [isNewAssessmentOpen, setIsNewAssessmentOpen] = useState(false);
  const [newVendorId, setNewVendorId] = useState('');
  const [newProvider, setNewProvider] = useState<'Moodys' | 'DnB' | 'SP' | 'internal'>('Moodys');

  const {
    data: assessmentData,
    isLoading: isAssessmentLoading,
    isError: isAssessmentError,
    error: assessmentError,
    refetch: refetchAssessments,
    isFetching: isAssessmentFetching,
  } = useQuery({
    queryKey: ['risk-assessments', { vendor_id: vendorFilter }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (vendorFilter) params.vendor_id = vendorFilter;
      const response = await apiClient.get('/risk/assessments', { params });
      return response.data.assessments as Assessment[];
    },
  });

  const {
    data: alertData,
    isLoading: isAlertLoading,
    isError: isAlertError,
    error: alertError,
    refetch: refetchAlerts,
    isFetching: isAlertFetching,
  } = useQuery({
    queryKey: ['risk-alerts', { vendor_id: vendorFilter, severity: severityFilter }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (vendorFilter) params.vendor_id = vendorFilter;
      if (severityFilter) params.severity = severityFilter;
      const response = await apiClient.get('/risk/alerts', { params });
      return response.data.alerts as AlertRecord[];
    },
  });

  const createAssessmentMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        vendor_id: newVendorId,
        provider: newProvider,
      };
      const response = await apiClient.post('/risk/assessments', payload);
      return response.data;
    },
    onSuccess: () => {
      setIsNewAssessmentOpen(false);
      setNewVendorId('');
      setNewProvider('Moodys');
      refetchAssessments();
      refetchAlerts();
    },
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiClient.post(`/risk/alerts/${alertId}/acknowledge`);
      return response.data;
    },
    onSuccess: () => {
      refetchAlerts();
    },
  });

  const assessments = assessmentData || [];
  const alerts = alertData || [];

  const getRiskChipColor = (level: Assessment['risk_level']) => {
    switch (level) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'success';
    }
  };

  const getSeverityChipColor = (severity: AlertRecord['severity']) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('risk.title', 'Vendor Risk Management')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'risk.subtitle',
              'External risk scores and alerts are consolidated here. All data pulls are auditable, and no external data is overwritten without explicit admin action.'
            )}
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => setIsNewAssessmentOpen(true)}
        >
          {t('risk.newAssessment', 'New Risk Assessment')}
        </Button>
      </Box>

      {(isAssessmentLoading || isAssessmentFetching) && (
        <LinearProgress aria-label={t('common.loading', 'Loading...')} />
      )}

      {isAssessmentError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetchAssessments()}>
              {t('risk.retry', 'Retry')}
            </Button>
          }
        >
          {assessmentError instanceof Error
            ? assessmentError.message
            : t(
                'risk.assessments.loadError',
                'Unable to load risk assessments. Please check your connection and try again.'
              )}
        </Alert>
      )}

      {isAlertError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetchAlerts()}>
              {t('risk.retry', 'Retry')}
            </Button>
          }
        >
          {alertError instanceof Error
            ? alertError.message
            : t(
                'risk.alerts.loadError',
                'Unable to load risk alerts. Please check your connection and try again.'
              )}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        <Box sx={{ flex: 2 }}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                label={t('risk.filters.vendorId', 'Vendor ID filter')}
                size="small"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                sx={{ minWidth: 220 }}
              />
              <TextField
                select
                label={t('risk.filters.severity', 'Alert severity')}
                size="small"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">
                  {t('risk.filters.allSeverities', 'All severities')}
                </MenuItem>
                <MenuItem value="critical">{t('risk.severity.critical', 'Critical')}</MenuItem>
                <MenuItem value="high">{t('risk.severity.high', 'High')}</MenuItem>
                <MenuItem value="medium">{t('risk.severity.medium', 'Medium')}</MenuItem>
                <MenuItem value="low">{t('risk.severity.low', 'Low')}</MenuItem>
              </TextField>
            </Box>

            <Typography variant="h6" gutterBottom>
              {t('risk.assessments.title', 'Risk assessments')}
            </Typography>
            <TableContainer>
              <Table size="small" aria-label={t('risk.assessments.aria', 'Risk assessments')}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('risk.columns.vendor', 'Vendor')}</TableCell>
                    <TableCell>{t('risk.columns.provider', 'Provider')}</TableCell>
                    <TableCell>{t('risk.columns.score', 'Score')}</TableCell>
                    <TableCell>{t('risk.columns.level', 'Level')}</TableCell>
                    <TableCell>{t('risk.columns.date', 'Assessment date')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assessments.length === 0 && !isAssessmentLoading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'risk.assessments.empty',
                            'No risk assessments yet. Run a new assessment to pull scores from external providers.'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    assessments.map((a) => (
                      <TableRow
                        key={a.id}
                        hover
                        tabIndex={0}
                        role="button"
                        selected={selectedAssessment?.id === a.id}
                        onClick={() => setSelectedAssessment(a)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedAssessment(a);
                          }
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography variant="body2">{a.vendor_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {a.vendor_code}
                          </Typography>
                        </TableCell>
                        <TableCell>{a.provider}</TableCell>
                        <TableCell>{a.risk_score.toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip
                            label={a.risk_level}
                            size="small"
                            color={getRiskChipColor(a.risk_level)}
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(a.assessment_date).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1,
              }}
            >
              <Typography variant="h6">
                {t('risk.alerts.title', 'Risk alerts')}
              </Typography>
              {(isAlertLoading || isAlertFetching) && (
                <LinearProgress
                  aria-label={t('common.loading', 'Loading...')}
                  sx={{ width: 120 }}
                />
              )}
            </Box>

            <TableContainer>
              <Table size="small" aria-label={t('risk.alerts.aria', 'Risk alerts')}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('risk.columns.vendor', 'Vendor')}</TableCell>
                    <TableCell>{t('risk.columns.message', 'Message')}</TableCell>
                    <TableCell>{t('risk.columns.severity', 'Severity')}</TableCell>
                    <TableCell>{t('risk.columns.status', 'Status')}</TableCell>
                    <TableCell>{t('risk.columns.source', 'Source')}</TableCell>
                    <TableCell align="right">
                      {t('risk.columns.actions', 'Actions')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alerts.length === 0 && !isAlertLoading ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'risk.alerts.empty',
                            'No active risk alerts. Threshold-crossing events from providers will appear here.'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    alerts.map((alert) => (
                      <TableRow
                        key={alert.id}
                        hover
                        tabIndex={0}
                        role="button"
                        selected={selectedAlert?.id === alert.id}
                        onClick={() => setSelectedAlert(alert)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedAlert(alert);
                          }
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{alert.vendor_name}</TableCell>
                        <TableCell>{alert.message}</TableCell>
                        <TableCell>
                          <Chip
                            label={alert.severity}
                            size="small"
                            color={getSeverityChipColor(alert.severity)}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={alert.status}
                            size="small"
                            color={
                              alert.status === 'active'
                                ? 'warning'
                                : alert.status === 'acknowledged'
                                ? 'info'
                                : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>{alert.source}</TableCell>
                        <TableCell align="right">
                          {alert.status === 'active' && (
                            <Tooltip
                              title={t(
                                'risk.alerts.acknowledgeTooltip',
                                'Acknowledge this alert. No changes are applied automatically.'
                              )}
                            >
                              <span>
                                <IconButton
                                  aria-label={t(
                                    'risk.alerts.acknowledge',
                                    'Acknowledge alert'
                                  )}
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    acknowledgeAlertMutation.mutate(alert.id);
                                  }}
                                  disabled={acknowledgeAlertMutation.isLoading}
                                >
                                  <RefreshIcon fontSize="small" />
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
            {!selectedAssessment && !selectedAlert && (
              <Typography variant="body2" color="text.secondary">
                {t(
                  'risk.detail.placeholder',
                  'Select an assessment or alert to view provider details and risk rationale.'
                )}
              </Typography>
            )}

            {selectedAssessment && (
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
                    <Typography variant="h6">{selectedAssessment.vendor_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedAssessment.vendor_code}
                    </Typography>
                  </Box>
                  <Tooltip
                    title={t(
                      'risk.detail.providerInfoTooltip',
                      'View how this external score was calculated.'
                    )}
                  >
                    <IconButton
                      aria-label={t('ai.explain', 'Explain')}
                      size="small"
                    >
                      <InfoOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Typography variant="body2" color="text.secondary">
                  {t('risk.detail.assessmentDate', 'Assessment date')}:&nbsp;
                  {new Date(selectedAssessment.assessment_date).toLocaleString()}
                </Typography>

                <Box sx={{ mt: 2, mb: 2 }}>
                  <Typography variant="subtitle2">
                    {t('risk.detail.scoreLabel', 'Risk score & level')}
                  </Typography>
                  <Typography variant="body1">
                    {selectedAssessment.risk_score.toFixed(2)} ({selectedAssessment.risk_level})
                  </Typography>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Typography variant="subtitle2" gutterBottom>
                  {t('risk.detail.providerDataTitle', 'Provider data snapshot')}
                </Typography>
                {selectedAssessment.provider_data ? (
                  <Box>
                    {selectedAssessment.provider_data.rating && (
                      <Typography variant="body2">
                        {t('risk.detail.ratingLabel', 'Rating')}:&nbsp;
                        {selectedAssessment.provider_data.rating}
                      </Typography>
                    )}
                    {selectedAssessment.provider_data.last_updated && (
                      <Typography variant="body2">
                        {t('risk.detail.lastUpdated', 'Last updated')}:&nbsp;
                        {new Date(
                          selectedAssessment.provider_data.last_updated
                        ).toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      'risk.detail.noProviderData',
                      'No additional provider details stored for this assessment.'
                    )}
                  </Typography>
                )}
              </Box>
            )}

            {selectedAlert && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 1.5 }} />
                <Typography variant="subtitle2" gutterBottom>
                  {t('risk.detail.alertTitle', 'Selected alert')}
                </Typography>
                <Typography variant="body2">
                  {selectedAlert.message}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {t('risk.detail.alertCreated', 'Created')}:&nbsp;
                  {new Date(selectedAlert.created_at).toLocaleString()}
      </Typography>
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {t('risk.guidance.title', 'External risk data & lossless handling')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'risk.guidance.text',
                'Risk scores from providers like Moody’s, D&B, and S&P are pulled but never overwrite internal data without explicit admin action. All provider calls use retry and backoff, and persistent failures surface as visible alerts for risk admins.'
              )}
            </Typography>
          </Paper>
        </Box>
      </Box>

      <Dialog
        open={isNewAssessmentOpen}
        onClose={() => {
          if (!createAssessmentMutation.isLoading) setIsNewAssessmentOpen(false);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="new-risk-assessment-dialog-title"
      >
        <DialogTitle id="new-risk-assessment-dialog-title">
          {t('risk.newAssessment', 'New Risk Assessment')}
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t(
                'risk.newAssessment.info',
                'The platform will pull the latest vendor risk score from the selected provider. Network failures surface with retry guidance; no existing scores are deleted.'
              )}
      </Typography>
          </Alert>

          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              createAssessmentMutation.mutate();
            }}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              label={t('risk.fields.vendorId', 'Vendor ID')}
              value={newVendorId}
              onChange={(e) => setNewVendorId(e.target.value)}
              required
              fullWidth
            />

            <TextField
              select
              label={t('risk.fields.provider', 'Provider')}
              value={newProvider}
              onChange={(e) =>
                setNewProvider(e.target.value as 'Moodys' | 'DnB' | 'SP' | 'internal')
              }
              required
              fullWidth
            >
              <MenuItem value="Moodys">Moody&apos;s</MenuItem>
              <MenuItem value="DnB">D&amp;B</MenuItem>
              <MenuItem value="SP">S&amp;P</MenuItem>
              <MenuItem value="internal">
                {t('risk.fields.internalProvider', 'Internal model')}
              </MenuItem>
            </TextField>

            {createAssessmentMutation.isError && (
              <Alert severity="error">
                {createAssessmentMutation.error instanceof Error
                  ? createAssessmentMutation.error.message
                  : t(
                      'risk.newAssessment.error',
                      'Unable to create risk assessment. Please verify the fields and try again.'
                    )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!createAssessmentMutation.isLoading) setIsNewAssessmentOpen(false);
            }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={() => createAssessmentMutation.mutate()}
            variant="contained"
            disabled={createAssessmentMutation.isLoading}
          >
            {t('common.create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
