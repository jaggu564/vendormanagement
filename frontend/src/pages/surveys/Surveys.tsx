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
  Chip,
  TextField,
  MenuItem,
  Divider,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/client';

type Survey = {
  id: string;
  survey_number: string;
  title: string;
  description?: string | null;
  type: 'VOC' | 'VOV';
  status: 'draft' | 'active' | 'closed';
  created_by_name?: string | null;
  created_at?: string;
};

type SurveyAnalytics = {
  total_responses: number;
  average_sentiment: number;
  ai_insights: {
    key_drivers: string[];
    trend: string;
    comparison_to_historic: string;
    bias_check: {
      flagged: boolean;
      message: string;
    };
  };
  advisory_only: boolean;
};

export default function Surveys() {
  const { t } = useTranslation();

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [showExplain, setShowExplain] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<'VOC' | 'VOV'>('VOC');
  const [newQuestionsText, setNewQuestionsText] = useState('');
  const [newTargetAudience, setNewTargetAudience] = useState('');

  const {
    data: surveysData,
    isLoading: isSurveysLoading,
    isError: isSurveysError,
    error: surveysError,
    refetch: refetchSurveys,
  } = useQuery({
    queryKey: ['surveys', { type: typeFilter, status: statusFilter }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const response = await apiClient.get('/surveys', { params });
      return response.data.surveys as Survey[];
    },
  });

  const {
    data: analyticsData,
    isLoading: isAnalyticsLoading,
    isError: isAnalyticsError,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ['survey-analytics', selectedSurveyId],
    queryFn: async () => {
      if (!selectedSurveyId) return null;
      const response = await apiClient.get(`/surveys/${selectedSurveyId}/analytics`);
      return response.data as SurveyAnalytics;
    },
    enabled: !!selectedSurveyId,
  });

  const surveys = surveysData || [];

  const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId) || null;

  const createSurveyMutation = useMutation({
    mutationFn: async () => {
      const questions = newQuestionsText
        .split('\n')
        .map((q) => q.trim())
        .filter((q) => q.length > 0);

      const targetAudience = newTargetAudience
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);

      const payload: any = {
        title: newTitle,
        description: newDescription || undefined,
        type: newType,
        questions,
      };

      if (targetAudience.length > 0) {
        payload.target_audience = targetAudience;
      }

      const response = await apiClient.post('/surveys', payload);
      return response.data;
    },
    onSuccess: () => {
      setIsCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewType('VOC');
      setNewQuestionsText('');
      setNewTargetAudience('');
      refetchSurveys();
    },
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('surveys.title', 'Surveys (VOC / VOV)')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'surveys.subtitle',
              'Capture voice-of-customer and voice-of-vendor feedback with explainable AI sentiment summaries. All analysis is advisory only and never auto-acts.'
            )}
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setIsCreateOpen(true)}>
          {t('surveys.createSurvey', 'New Survey')}
        </Button>
      </Box>

      {isSurveysLoading && (
        <LinearProgress aria-label={t('common.loading', 'Loading...')} />
      )}

      {isSurveysError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetchSurveys()}>
              {t('surveys.retry', 'Retry')}
            </Button>
          }
        >
          {surveysError instanceof Error
            ? surveysError.message
            : t(
                'surveys.loadError',
                'Unable to load surveys. Please check your connection and try again.'
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
                label={t('surveys.filters.type', 'Type')}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">
                  {t('surveys.filters.allTypes', 'All types')}
                </MenuItem>
                <MenuItem value="VOC">{t('surveys.type.VOC', 'Voice of Customer (VOC)')}</MenuItem>
                <MenuItem value="VOV">{t('surveys.type.VOV', 'Voice of Vendor (VOV)')}</MenuItem>
              </TextField>

              <TextField
                select
                size="small"
                label={t('surveys.filters.status', 'Status')}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">
                  {t('surveys.filters.allStatuses', 'All statuses')}
                </MenuItem>
                <MenuItem value="draft">{t('surveys.status.draft', 'Draft')}</MenuItem>
                <MenuItem value="active">{t('surveys.status.active', 'Active')}</MenuItem>
                <MenuItem value="closed">{t('surveys.status.closed', 'Closed')}</MenuItem>
              </TextField>
            </Box>

            <TableContainer>
              <Table size="small" aria-label={t('surveys.table.aria', 'Surveys table')}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('surveys.columns.number', 'Survey #')}</TableCell>
                    <TableCell>{t('surveys.columns.title', 'Title')}</TableCell>
                    <TableCell>{t('surveys.columns.type', 'Type')}</TableCell>
                    <TableCell>{t('surveys.columns.status', 'Status')}</TableCell>
                    <TableCell>{t('surveys.columns.createdBy', 'Created by')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {surveys.length === 0 && !isSurveysLoading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'surveys.empty',
                            'No surveys configured yet. Create one to start capturing feedback.'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    surveys.map((s) => (
                      <TableRow
                        key={s.id}
                        hover
                        tabIndex={0}
                        role="button"
                        selected={selectedSurveyId === s.id}
                        onClick={() => {
                          setSelectedSurveyId(s.id);
                          setShowExplain(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedSurveyId(s.id);
                            setShowExplain(false);
                          }
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{s.survey_number}</TableCell>
                        <TableCell>{s.title}</TableCell>
                        <TableCell>
                          {s.type === 'VOC'
                            ? t('surveys.type.VOC', 'Voice of Customer (VOC)')
                            : t('surveys.type.VOV', 'Voice of Vendor (VOV)')}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={t(`surveys.status.${s.status}`, s.status)}
                            size="small"
                            color={
                              s.status === 'active'
                                ? 'success'
                                : s.status === 'draft'
                                ? 'default'
                                : 'info'
                            }
                          />
                        </TableCell>
                        <TableCell>{s.created_by_name}</TableCell>
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
            {!selectedSurveyId && (
              <Typography variant="body2" color="text.secondary">
                {t(
                  'surveys.detail.placeholder',
                  'Select a survey to view AI sentiment analytics and drivers.'
                )}
              </Typography>
            )}

            {selectedSurveyId && isAnalyticsLoading && (
              <Box>
                <LinearProgress aria-label={t('common.loading', 'Loading...')} />
                <Typography sx={{ mt: 1 }} variant="body2">
                  {t('surveys.detail.loading', 'Loading survey analytics...')}
                </Typography>
              </Box>
            )}

            {selectedSurveyId && isAnalyticsError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                action={
                  <Button color="inherit" size="small" onClick={() => refetchAnalytics()}>
                    {t('surveys.retry', 'Retry')}
                  </Button>
                }
              >
                {analyticsError instanceof Error
                  ? analyticsError.message
                  : t(
                      'surveys.detail.loadError',
                      'Unable to load survey analytics. Please try again.'
                    )}
              </Alert>
            )}

            {selectedSurvey && analyticsData && !isAnalyticsLoading && (
              <Box>
                <Typography variant="h6">{selectedSurvey.title}</Typography>
                {selectedSurvey.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {selectedSurvey.description}
                  </Typography>
                )}

                <Box sx={{ mt: 2, mb: 2, display: 'flex', gap: 3 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('surveys.detail.responsesCount', 'Total responses')}
                    </Typography>
                    <Typography variant="h6">
                      {analyticsData.total_responses}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('surveys.detail.avgSentiment', 'Average sentiment')}
                    </Typography>
                    <Typography variant="h6">
                      {analyticsData.average_sentiment.toFixed(1)}
                    </Typography>
                  </Box>
                </Box>

                <Alert severity="info" sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <InfoOutlined fontSize="small" />
                    <Box>
                      <Typography variant="body2">
                        {t(
                          'surveys.ai.advisoryBanner',
                          'This sentiment summary is AI-generated and advisory only. It does not trigger any workflow or decision automatically.'
                        )}
                      </Typography>
                      <Link
                        component="button"
                        type="button"
                        onClick={() => setShowExplain((prev) => !prev)}
                        sx={{ mt: 0.5 }}
                      >
                        {t('surveys.ai.explainLink', 'How was this score calculated?')}
                      </Link>
                    </Box>
                  </Box>
                </Alert>

                {showExplain && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('surveys.ai.driversTitle', 'Contributing drivers')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {analyticsData.ai_insights.key_drivers.join(', ')}
                    </Typography>

                    <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                      {t('surveys.ai.trendLabel', 'Trend')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {analyticsData.ai_insights.trend}
                    </Typography>

                    <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                      {t('surveys.ai.comparisonLabel', 'Compared to historic average')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {analyticsData.ai_insights.comparison_to_historic}
                    </Typography>

                    <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                      {t('ai.biasFlagged', 'Bias Flagged')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {analyticsData.ai_insights.bias_check.flagged
                        ? analyticsData.ai_insights.bias_check.message ||
                          t('surveys.ai.biasFlagged', 'Bias Flagged')
                        : t('surveys.ai.noBias', 'No significant bias patterns detected')}
                    </Typography>
                  </Box>
                )}

                <Divider />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }} display="block">
                  {t(
                    'ai.advisoryOnly',
                    'Advisory Only'
                  )}
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      <Dialog
        open={isCreateOpen}
        onClose={() => {
          if (!createSurveyMutation.isLoading) setIsCreateOpen(false);
        }}
        fullWidth
        maxWidth="md"
        aria-labelledby="create-survey-dialog-title"
      >
        <DialogTitle id="create-survey-dialog-title">
          {t('surveys.createSurvey', 'New Survey')}
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t(
                'surveys.create.info',
                'Define survey questions as one per line. Responses will later feed AI sentiment analysis that is advisory only, with explainable drivers.'
              )}
            </Typography>
          </Alert>

          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              createSurveyMutation.mutate();
            }}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              label={t('surveys.fields.title', 'Title')}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              fullWidth
            />

            <TextField
              label={t('surveys.fields.description', 'Description (optional)')}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />

            <TextField
              select
              label={t('surveys.fields.type', 'Survey type')}
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'VOC' | 'VOV')}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="VOC">{t('surveys.type.VOC', 'Voice of Customer (VOC)')}</MenuItem>
              <MenuItem value="VOV">{t('surveys.type.VOV', 'Voice of Vendor (VOV)')}</MenuItem>
            </TextField>

            <TextField
              label={t('surveys.fields.questions', 'Questions (one per line)')}
              value={newQuestionsText}
              onChange={(e) => setNewQuestionsText(e.target.value)}
              required
              fullWidth
              multiline
              minRows={4}
            />

            <TextField
              label={t(
                'surveys.fields.targetAudience',
                'Target audience IDs (comma-separated, optional)'
              )}
              value={newTargetAudience}
              onChange={(e) => setNewTargetAudience(e.target.value)}
              fullWidth
            />

            {createSurveyMutation.isError && (
              <Alert severity="error">
                {createSurveyMutation.error instanceof Error
                  ? createSurveyMutation.error.message
                  : t(
                      'surveys.create.error',
                      'Unable to create survey. Please verify required fields and try again.'
                    )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!createSurveyMutation.isLoading) setIsCreateOpen(false);
            }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={() => createSurveyMutation.mutate()}
            variant="contained"
            disabled={createSurveyMutation.isLoading}
          >
            {t('common.create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
