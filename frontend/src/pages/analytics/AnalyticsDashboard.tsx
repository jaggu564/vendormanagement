import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Alert,
  LinearProgress,
  Grid,
  Chip,
  Tooltip,
} from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/client';

type Dashboard = {
  id: string;
  name: string;
  description?: string | null;
  is_shared: boolean;
  created_at: string;
};

type VendorSummary = {
  summary: {
    contract_count?: number;
    po_count?: number;
    total_spend?: number;
    avg_performance_score?: number;
  };
  risk: {
    risk_score: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    assessment_date: string;
  } | null;
  ai_insights: {
    trend: string;
    key_drivers: string[];
    prediction: string;
    confidence: number;
    data_sources: string[];
  };
  advisory_only: boolean;
};

export default function AnalyticsDashboard() {
  const { t } = useTranslation();
  const [vendorId, setVendorId] = useState('');
  const [requestedVendorId, setRequestedVendorId] = useState<string | null>(null);

  const {
    data: dashboardsData,
    isLoading: isDashboardsLoading,
    isError: isDashboardsError,
    error: dashboardsError,
    refetch: refetchDashboards,
  } = useQuery({
    queryKey: ['analytics-dashboards'],
    queryFn: async () => {
      const response = await apiClient.get('/analytics/dashboards');
      return response.data.dashboards as Dashboard[];
    },
  });

  const {
    data: vendorSummaryData,
    isLoading: isVendorSummaryLoading,
    isError: isVendorSummaryError,
    error: vendorSummaryError,
    refetch: refetchVendorSummary,
  } = useQuery({
    queryKey: ['analytics-vendor-summary', requestedVendorId],
    queryFn: async () => {
      if (!requestedVendorId) return null;
      const response = await apiClient.get('/analytics/vendor-summary', {
        params: { vendor_id: requestedVendorId },
      });
      return response.data as VendorSummary;
    },
    enabled: !!requestedVendorId,
  });

  const dashboards = dashboardsData || [];

  const handleVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId.trim()) return;
    setRequestedVendorId(vendorId.trim());
  };

  const summary = vendorSummaryData?.summary || {};
  const risk = vendorSummaryData?.risk || null;
  const ai = vendorSummaryData?.ai_insights;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('analytics.title', 'Vendor Metrics & Analytics')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'analytics.subtitle',
              'Dashboards and AI insights are advisory only. All trends expose their drivers, datasets, and confidence to support accountable decision-making.'
            )}
          </Typography>
        </Box>
      </Box>

      {isDashboardsLoading && (
        <LinearProgress aria-label={t('common.loading', 'Loading...')} />
      )}

      {isDashboardsError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetchDashboards()}>
              {t('analytics.retry', 'Retry')}
            </Button>
          }
        >
          {dashboardsError instanceof Error
            ? dashboardsError.message
            : t(
                'analytics.dashboards.loadError',
                'Unable to load analytics dashboards. Please try again.'
              )}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {t('analytics.dashboards.title', 'Available dashboards')}
            </Typography>
            {dashboards.length === 0 && !isDashboardsLoading ? (
              <Typography variant="body2" color="text.secondary">
                {t(
                  'analytics.dashboards.empty',
                  'No dashboards configured yet. Admins can create shared analytics views in the admin panel.'
                )}
              </Typography>
            ) : (
              dashboards.map((d) => (
                <Box key={d.id} sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle2">{d.name}</Typography>
                  {d.description && (
                    <Typography variant="body2" color="text.secondary">
                      {d.description}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" display="block">
                    {d.is_shared
                      ? t('analytics.dashboards.shared', 'Shared')
                      : t('analytics.dashboards.private', 'Private')}
                    {' • '}
                    {new Date(d.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              ))
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('analytics.vendorSummary.title', 'Vendor summary & AI insight')}
            </Typography>

            <Box
              component="form"
              onSubmit={handleVendorSubmit}
              sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}
            >
              <TextField
                label={t('analytics.vendorSummary.vendorIdField', 'Vendor ID')}
                size="small"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                sx={{ minWidth: 240 }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={isVendorSummaryLoading}
              >
                {t('analytics.vendorSummary.loadButton', 'Load summary')}
              </Button>
            </Box>

            {isVendorSummaryLoading && (
              <LinearProgress aria-label={t('common.loading', 'Loading...')} />
            )}

            {isVendorSummaryError && (
              <Alert
                severity="error"
                sx={{ mt: 2 }}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => refetchVendorSummary()}
                  >
                    {t('analytics.retry', 'Retry')}
                  </Button>
                }
              >
                {vendorSummaryError instanceof Error
                  ? vendorSummaryError.message
                  : t(
                      'analytics.vendorSummary.loadError',
                      'Unable to load vendor summary. Please confirm the vendor ID and try again.'
                    )}
              </Alert>
            )}

            {!requestedVendorId && !isVendorSummaryLoading && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t(
                  'analytics.vendorSummary.placeholder',
                  'Enter a vendor ID to see contracts, spend, performance, risk, and AI insight for that vendor.'
                )}
              </Typography>
            )}

            {requestedVendorId && vendorSummaryData && !isVendorSummaryLoading && (
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('analytics.vendorSummary.contracts', 'Active contracts')}
                    </Typography>
                    <Typography variant="h6">
                      {summary.contract_count ?? 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('analytics.vendorSummary.pos', 'Purchase orders')}
                    </Typography>
                    <Typography variant="h6">
                      {summary.po_count ?? 0}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('analytics.vendorSummary.spend', 'Total spend')}
                    </Typography>
                    <Typography variant="h6">
                      {(summary.total_spend ?? 0).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 0,
                      })}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t(
                        'analytics.vendorSummary.avgScore',
                        'Avg. performance score'
                      )}
                    </Typography>
                    <Typography variant="h6">
                      {summary.avg_performance_score != null
                        ? summary.avg_performance_score.toFixed(1)
                        : '—'}
                    </Typography>
                  </Grid>
                </Grid>

                {risk && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('analytics.vendorSummary.riskTitle', 'Latest risk snapshot')}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip
                        label={`${risk.risk_score.toFixed(2)} (${risk.risk_level})`}
                        color={
                          risk.risk_level === 'critical'
                            ? 'error'
                            : risk.risk_level === 'high'
                            ? 'warning'
                            : risk.risk_level === 'medium'
                            ? 'info'
                            : 'success'
                        }
                      />
                      <Typography variant="body2" color="text.secondary">
                        {t('analytics.vendorSummary.riskDate', 'Assessed on')}:&nbsp;
                        {new Date(risk.assessment_date).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {ai && (
                  <Box sx={{ mt: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="subtitle2">
                        {t('analytics.ai.title', 'AI insight (advisory only)')}
                      </Typography>
                      <Tooltip
                        title={t(
                          'analytics.ai.explainTooltip',
                          'Shows how this prediction was calculated and which factors drove it.'
                        )}
                      >
                        <InfoOutlined fontSize="small" />
                      </Tooltip>
                    </Box>

                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        {t(
                          'analytics.ai.advisoryBanner',
                          'This insight is AI-generated and advisory only. No actions are triggered automatically; you must decide what to do with it.'
                        )}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {t('analytics.ai.trendLabel', 'Trend')}: {ai.trend}
                      </Typography>
                      <Typography variant="body2">
                        {t('analytics.ai.predictionLabel', 'Prediction')}: {ai.prediction}
                      </Typography>
                      <Typography variant="body2">
                        {t('analytics.ai.confidenceLabel', 'Confidence')}:&nbsp;
                        {(ai.confidence * 100).toFixed(0)}%
                      </Typography>
                    </Alert>

                    <Typography variant="subtitle2" gutterBottom>
                      {t('analytics.ai.driversTitle', 'Key drivers')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                      {ai.key_drivers.map((driver) => (
                        <Chip key={driver} label={driver} size="small" variant="outlined" />
                      ))}
                    </Box>

                    <Typography variant="subtitle2" gutterBottom>
                      {t('analytics.ai.dataSourcesTitle', 'Dataset used')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {ai.data_sources.join(', ')}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
