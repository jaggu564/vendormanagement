import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Typography, Box, Paper, Chip, Button, Alert } from '@mui/material';
//import { Explain as ExplainIcon } from '@mui/icons-material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import apiClient from '../../api/client';
import { useTranslation } from 'react-i18next';

export default function RFPDetail() {
  const { id } = useParams();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ['rfp', id],
    queryFn: async () => {
      const response = await apiClient.get(`/rfp/${id}`);
      return response.data.rfp;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (!data) {
    return <Typography>RFP not found</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">{data.title}</Typography>
        <Chip label={data.status} />
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Details
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          RFP Number: {data.rfp_number}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Owner: {data.owner_name}
        </Typography>
        {data.due_date && (
          <Typography variant="body2" color="text.secondary">
            Due Date: {new Date(data.due_date).toLocaleDateString()}
          </Typography>
        )}
        <Typography variant="body1" sx={{ mt: 2 }}>
          {data.description}
        </Typography>
      </Paper>

      {data.ai_suggestions && data.ai_suggestions.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('rfp.aiSuggestions')}
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('ai.advisoryOnly')}
          </Alert>
          {data.ai_suggestions.map((suggestion: any, index: number) => (
            <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle2">{suggestion.suggestion}</Typography>
              <Typography variant="body2" color="text.secondary">
                {suggestion.rationale}
              </Typography>
              <Button
                size="small"
                startIcon={<InfoOutlined />}
                sx={{ mt: 1 }}
              >
                {t('ai.explain')}
              </Button>
            </Box>
          ))}
        </Paper>
      )}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Sections
        </Typography>
        {data.sections && data.sections.length > 0 ? (
          data.sections.map((section: any) => (
            <Box key={section.id} sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle1">
                {section.section_number}. {section.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {section.content}
              </Typography>
              {section.ai_generated && (
                <Chip label="AI Generated" size="small" sx={{ mt: 1 }} />
              )}
            </Box>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            No sections added yet
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
