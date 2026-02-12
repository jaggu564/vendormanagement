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
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { useTranslation } from 'react-i18next';
import apiClient from '../../api/client';

type Attachment = {
  name: string;
  url?: string;
};

type Ticket = {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  type: 'dispute' | 'support' | 'question' | 'complaint';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  vendor_id?: string | null;
  vendor_name?: string | null;
  contract_id?: string | null;
  created_by_name?: string | null;
  assigned_to_name?: string | null;
  attachments?: Attachment[];
  created_at?: string;
};

type Comment = {
  id: string;
  ticket_id: string;
  comment: string;
  created_at: string;
  created_by_name?: string | null;
  attachments?: Attachment[];
};

type TicketDetail = Ticket & {
  comments: Comment[];
};

export default function Helpdesk() {
  const { t } = useTranslation();

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<'dispute' | 'support' | 'question' | 'complaint'>(
    'support'
  );
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(
    'medium'
  );
  const [newVendorId, setNewVendorId] = useState('');
  const [newContractId, setNewContractId] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);

  const [newComment, setNewComment] = useState('');
  const [newCommentAttachmentName, setNewCommentAttachmentName] = useState('');
  const [newCommentAttachments, setNewCommentAttachments] = useState<Attachment[]>([]);

  const {
    data: ticketsData,
    isLoading: isTicketsLoading,
    isError: isTicketsError,
    error: ticketsError,
    refetch: refetchTickets,
    isFetching: isTicketsFetching,
  } = useQuery({
    queryKey: ['tickets', { status: statusFilter, type: typeFilter, priority: priorityFilter }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const response = await apiClient.get('/helpdesk/tickets', { params });
      return response.data.tickets as Ticket[];
    },
  });

  const {
    data: ticketDetailData,
    isLoading: isTicketDetailLoading,
    isError: isTicketDetailError,
    error: ticketDetailError,
    refetch: refetchTicketDetail,
  } = useQuery({
    queryKey: ['ticket', selectedTicketId],
    queryFn: async () => {
      if (!selectedTicketId) return null;
      const response = await apiClient.get(`/helpdesk/tickets/${selectedTicketId}`);
      return response.data.ticket as TicketDetail;
    },
    enabled: !!selectedTicketId,
  });

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: newTitle,
        description: newDescription,
        type: newType,
        priority: newPriority,
        attachments: newAttachments,
      };
      if (newVendorId) payload.vendor_id = newVendorId;
      if (newContractId) payload.contract_id = newContractId;
      const response = await apiClient.post('/helpdesk/tickets', payload);
      return response.data;
    },
    onSuccess: () => {
      setIsCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewType('support');
      setNewPriority('medium');
      setNewVendorId('');
      setNewContractId('');
      setNewAttachmentName('');
      setNewAttachments([]);
      refetchTickets();
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicketId) return;
      const payload = {
        comment: newComment,
        attachments: newCommentAttachments,
      };
      const response = await apiClient.post(
        `/helpdesk/tickets/${selectedTicketId}/comments`,
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      setNewComment('');
      setNewCommentAttachmentName('');
      setNewCommentAttachments([]);
      refetchTicketDetail();
    },
  });

  const tickets = ticketsData || [];
  const selectedTicket = ticketDetailData || null;

  const handleAddAttachment = () => {
    if (!newAttachmentName.trim()) return;
    setNewAttachments((prev) => [...prev, { name: newAttachmentName.trim() }]);
    setNewAttachmentName('');
  };

  const handleAddCommentAttachment = () => {
    if (!newCommentAttachmentName.trim()) return;
    setNewCommentAttachments((prev) => [...prev, { name: newCommentAttachmentName.trim() }]);
    setNewCommentAttachmentName('');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('helpdesk.title', 'Helpdesk & Disputes')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'helpdesk.subtitle',
              'Track tickets, disputes, and evidence in an accessible, auditable workspace. No actions are lost on network issues—drafts remain in the form until submitted.'
            )}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={() => setIsCreateOpen(true)}
        >
          {t('helpdesk.createTicket', 'New Ticket')}
        </Button>
      </Box>

      {(isTicketsLoading || isTicketsFetching) && (
        <LinearProgress aria-label={t('common.loading', 'Loading...')} />
      )}

      {isTicketsError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetchTickets()}>
              {t('helpdesk.retry', 'Retry')}
            </Button>
          }
        >
          {ticketsError instanceof Error
            ? ticketsError.message
            : t(
                'helpdesk.loadError',
                'Unable to load tickets. Please check your connection and try again.'
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
                label={t('helpdesk.filters.status', 'Status')}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">
                  {t('helpdesk.filters.allStatuses', 'All statuses')}
                </MenuItem>
                <MenuItem value="open">{t('helpdesk.status.open', 'Open')}</MenuItem>
                <MenuItem value="in_progress">
                  {t('helpdesk.status.inProgress', 'In progress')}
                </MenuItem>
                <MenuItem value="resolved">
                  {t('helpdesk.status.resolved', 'Resolved')}
                </MenuItem>
                <MenuItem value="closed">{t('helpdesk.status.closed', 'Closed')}</MenuItem>
              </TextField>

              <TextField
                select
                size="small"
                label={t('helpdesk.filters.type', 'Type')}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">
                  {t('helpdesk.filters.allTypes', 'All types')}
                </MenuItem>
                <MenuItem value="dispute">
                  {t('helpdesk.type.dispute', 'Dispute')}
                </MenuItem>
                <MenuItem value="support">
                  {t('helpdesk.type.support', 'Support')}
                </MenuItem>
                <MenuItem value="question">
                  {t('helpdesk.type.question', 'Question')}
                </MenuItem>
                <MenuItem value="complaint">
                  {t('helpdesk.type.complaint', 'Complaint')}
                </MenuItem>
              </TextField>

              <TextField
                select
                size="small"
                label={t('helpdesk.filters.priority', 'Priority')}
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">
                  {t('helpdesk.filters.allPriorities', 'All priorities')}
                </MenuItem>
                <MenuItem value="low">{t('helpdesk.priority.low', 'Low')}</MenuItem>
                <MenuItem value="medium">{t('helpdesk.priority.medium', 'Medium')}</MenuItem>
                <MenuItem value="high">{t('helpdesk.priority.high', 'High')}</MenuItem>
                <MenuItem value="urgent">{t('helpdesk.priority.urgent', 'Urgent')}</MenuItem>
              </TextField>
            </Box>

            <TableContainer>
              <Table
                size="small"
                aria-label={t('helpdesk.table.aria', 'Helpdesk tickets table')}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>{t('helpdesk.columns.number', 'Ticket #')}</TableCell>
                    <TableCell>{t('helpdesk.columns.title', 'Title')}</TableCell>
                    <TableCell>{t('helpdesk.columns.vendor', 'Vendor')}</TableCell>
                    <TableCell>{t('helpdesk.columns.type', 'Type')}</TableCell>
                    <TableCell>{t('helpdesk.columns.priority', 'Priority')}</TableCell>
                    <TableCell>{t('helpdesk.columns.status', 'Status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tickets.length === 0 && !isTicketsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'helpdesk.empty',
                            'No tickets yet. Create one to start tracking issues and disputes.'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tickets.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        hover
                        tabIndex={0}
                        role="button"
                        selected={selectedTicketId === ticket.id}
                        onClick={() => setSelectedTicketId(ticket.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedTicketId(ticket.id);
                          }
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{ticket.ticket_number}</TableCell>
                        <TableCell>{ticket.title}</TableCell>
                        <TableCell>{ticket.vendor_name}</TableCell>
                        <TableCell>{ticket.type}</TableCell>
                        <TableCell>
                          <Chip
                            label={ticket.priority}
                            size="small"
                            color={
                              ticket.priority === 'urgent'
                                ? 'error'
                                : ticket.priority === 'high'
                                ? 'warning'
                                : ticket.priority === 'medium'
                                ? 'info'
                                : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ticket.status}
                            size="small"
                            color={
                              ticket.status === 'open'
                                ? 'warning'
                                : ticket.status === 'resolved' || ticket.status === 'closed'
                                ? 'success'
                                : 'default'
                            }
                          />
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
            {!selectedTicketId && (
              <Typography variant="body2" color="text.secondary">
                {t(
                  'helpdesk.detail.placeholder',
                  'Select a ticket to view its details, threaded discussion, and evidence.'
                )}
              </Typography>
            )}

            {selectedTicketId && isTicketDetailLoading && (
              <Box>
                <LinearProgress aria-label={t('common.loading', 'Loading...')} />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {t('helpdesk.detail.loading', 'Loading ticket details...')}
                </Typography>
              </Box>
            )}

            {selectedTicketId && isTicketDetailError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                action={
                  <Button color="inherit" size="small" onClick={() => refetchTicketDetail()}>
                    {t('helpdesk.retry', 'Retry')}
                  </Button>
                }
              >
                {ticketDetailError instanceof Error
                  ? ticketDetailError.message
                  : t(
                      'helpdesk.detail.loadError',
                      'Unable to load ticket details. Please try again.'
                    )}
              </Alert>
            )}

            {selectedTicket && !isTicketDetailLoading && (
              <Box>
                <Typography variant="h6">{selectedTicket.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedTicket.ticket_number}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1 }}>
                  <Chip label={selectedTicket.type} size="small" />
                  <Chip
                    label={selectedTicket.priority}
                    size="small"
                    color={
                      selectedTicket.priority === 'urgent'
                        ? 'error'
                        : selectedTicket.priority === 'high'
                        ? 'warning'
                        : selectedTicket.priority === 'medium'
                        ? 'info'
                        : 'default'
                    }
                  />
                  <Chip
                    label={selectedTicket.status}
                    size="small"
                    color={
                      selectedTicket.status === 'open'
                        ? 'warning'
                        : selectedTicket.status === 'resolved' ||
                          selectedTicket.status === 'closed'
                        ? 'success'
                        : 'default'
                    }
                  />
                </Box>

                <Typography variant="body2" color="text.secondary">
                  {t('helpdesk.detail.createdBy', 'Created by')}:&nbsp;
                  {selectedTicket.created_by_name || t('helpdesk.detail.unknown', 'Unknown')}
                </Typography>
                {selectedTicket.assigned_to_name && (
                  <Typography variant="body2" color="text.secondary">
                    {t('helpdesk.detail.assignedTo', 'Assigned to')}:&nbsp;
                    {selectedTicket.assigned_to_name}
                  </Typography>
                )}

                <Typography variant="body1" sx={{ mt: 2 }}>
                  {selectedTicket.description}
                </Typography>

                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">
                      {t('helpdesk.detail.attachments', 'Evidence & attachments')}
                    </Typography>
                    <List dense>
                      {selectedTicket.attachments.map((att, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={att.name}
                            secondary={att.url}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  {t('helpdesk.comments.title', 'Threaded discussion')}
                </Typography>
                <Box
                  sx={{
                    maxHeight: 220,
                    overflowY: 'auto',
                    mb: 2,
                    pr: 1,
                  }}
                >
                  {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                    selectedTicket.comments.map((c) => (
                      <Box
                        key={c.id}
                        sx={{
                          mb: 1.5,
                          p: 1,
                          borderRadius: 1,
                          bgcolor: 'background.default',
                        }}
                      >
                        <Typography variant="body2">
                          {c.comment}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {c.created_by_name || t('helpdesk.detail.unknown', 'Unknown')} •{' '}
                          {new Date(c.created_at).toLocaleString()}
                        </Typography>
                        {c.attachments && c.attachments.length > 0 && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {t(
                              'helpdesk.comments.attachments',
                              'Attachments'
                            )}: {c.attachments.map((a) => a.name).join(', ')}
                          </Typography>
                        )}
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('helpdesk.comments.empty', 'No comments yet.')}
                    </Typography>
                  )}
                </Box>

                <Box
                  component="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newComment.trim()) return;
                    addCommentMutation.mutate();
                  }}
                  sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                >
                  <TextField
                    label={t('helpdesk.comments.add', 'Add a comment')}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    multiline
                    minRows={2}
                    fullWidth
                  />

                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      label={t(
                        'helpdesk.comments.attachmentField',
                        'Attachment name or URL (optional)'
                      )}
                      size="small"
                      value={newCommentAttachmentName}
                      onChange={(e) => setNewCommentAttachmentName(e.target.value)}
                      fullWidth
                    />
                    <Button onClick={handleAddCommentAttachment} size="small">
                      {t('helpdesk.comments.addAttachment', 'Add')}
                    </Button>
                  </Box>

                  {newCommentAttachments.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {t('helpdesk.comments.pendingAttachments', 'Pending attachments')}:&nbsp;
                      {newCommentAttachments.map((a) => a.name).join(', ')}
                    </Typography>
                  )}

                  {addCommentMutation.isError && (
                    <Alert severity="error">
                      {addCommentMutation.error instanceof Error
                        ? addCommentMutation.error.message
                        : t(
                            'helpdesk.comments.error',
                            'Unable to add comment. Please try again.'
                          )}
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      endIcon={<SendIcon />}
                      disabled={addCommentMutation.isLoading}
                    >
                      {t('helpdesk.comments.submit', 'Post comment')}
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      <Dialog
        open={isCreateOpen}
        onClose={() => {
          if (!createTicketMutation.isLoading) setIsCreateOpen(false);
        }}
        fullWidth
        maxWidth="md"
        aria-labelledby="create-ticket-dialog-title"
      >
        <DialogTitle id="create-ticket-dialog-title">
          {t('helpdesk.createTicket', 'New Ticket')}
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t(
                'helpdesk.create.info',
                'Ticket drafts stay in this dialog until submitted. If your network drops, your text and attachments remain in the form so you can retry without losing data.'
              )}
            </Typography>
          </Alert>

          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              createTicketMutation.mutate();
            }}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              label={t('helpdesk.fields.title', 'Title')}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              fullWidth
            />

            <TextField
              label={t('helpdesk.fields.description', 'Description')}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              required
              fullWidth
              multiline
              minRows={4}
            />

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                select
                label={t('helpdesk.fields.type', 'Ticket type')}
                value={newType}
                onChange={(e) =>
                  setNewType(e.target.value as 'dispute' | 'support' | 'question' | 'complaint')
                }
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="dispute">
                  {t('helpdesk.type.dispute', 'Dispute')}
                </MenuItem>
                <MenuItem value="support">
                  {t('helpdesk.type.support', 'Support')}
                </MenuItem>
                <MenuItem value="question">
                  {t('helpdesk.type.question', 'Question')}
                </MenuItem>
                <MenuItem value="complaint">
                  {t('helpdesk.type.complaint', 'Complaint')}
                </MenuItem>
              </TextField>

              <TextField
                select
                label={t('helpdesk.fields.priority', 'Priority')}
                value={newPriority}
                onChange={(e) =>
                  setNewPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')
                }
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="low">{t('helpdesk.priority.low', 'Low')}</MenuItem>
                <MenuItem value="medium">{t('helpdesk.priority.medium', 'Medium')}</MenuItem>
                <MenuItem value="high">{t('helpdesk.priority.high', 'High')}</MenuItem>
                <MenuItem value="urgent">{t('helpdesk.priority.urgent', 'Urgent')}</MenuItem>
              </TextField>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label={t('helpdesk.fields.vendorId', 'Vendor ID (optional)')}
                value={newVendorId}
                onChange={(e) => setNewVendorId(e.target.value)}
                sx={{ minWidth: 220 }}
              />
              <TextField
                label={t('helpdesk.fields.contractId', 'Contract ID (optional)')}
                value={newContractId}
                onChange={(e) => setNewContractId(e.target.value)}
                sx={{ minWidth: 220 }}
              />
            </Box>

            <Divider />

            <Typography variant="subtitle2">
              {t('helpdesk.fields.attachments', 'Evidence & attachments')}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              {t(
                'helpdesk.fields.attachmentsHint',
                'Paste filenames or URLs for now. Actual file upload endpoints can be wired later; all entries remain linked to this ticket.'
              )}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                label={t('helpdesk.fields.attachmentName', 'Attachment name or URL')}
                size="small"
                value={newAttachmentName}
                onChange={(e) => setNewAttachmentName(e.target.value)}
                fullWidth
              />
              <Button onClick={handleAddAttachment} size="small">
                {t('helpdesk.fields.addAttachment', 'Add')}
              </Button>
            </Box>

            {newAttachments.length > 0 && (
              <List dense>
                {newAttachments.map((att, index) => (
                  <ListItem key={index}>
                    <ListItemText primary={att.name} />
                  </ListItem>
                ))}
              </List>
            )}

            {createTicketMutation.isError && (
              <Alert severity="error">
                {createTicketMutation.error instanceof Error
                  ? createTicketMutation.error.message
                  : t(
                      'helpdesk.create.error',
                      'Unable to create ticket. Please check required fields and try again.'
                    )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!createTicketMutation.isLoading) setIsCreateOpen(false);
            }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={() => createTicketMutation.mutate()}
            variant="contained"
            disabled={createTicketMutation.isLoading}
          >
            {t('common.create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
