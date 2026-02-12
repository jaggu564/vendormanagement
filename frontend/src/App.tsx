import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RFPList from './pages/rfp/RFPList';
import RFPCreate from './pages/rfp/RFPCreate';
import RFPDetail from './pages/rfp/RFPDetail';
import ContractList from './pages/contracts/ContractList';
import ProcurementDashboard from './pages/procurement/ProcurementDashboard';
import PerformanceDashboard from './pages/performance/PerformanceDashboard';
import RiskDashboard from './pages/risk/RiskDashboard';
import AnalyticsDashboard from './pages/analytics/AnalyticsDashboard';
import Helpdesk from './pages/helpdesk/Helpdesk';
import Surveys from './pages/surveys/Surveys';
import AdminPanel from './pages/admin/AdminPanel';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      <Route
        path="/"
        element={user ? <Layout /> : <Navigate to="/login" replace />}
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="rfp" element={<RFPList />} />
        <Route path="rfp/create" element={<RFPCreate />} />
        <Route path="rfp/:id" element={<RFPDetail />} />
        <Route path="contracts" element={<ContractList />} />
        <Route path="procurement" element={<ProcurementDashboard />} />
        <Route path="performance" element={<PerformanceDashboard />} />
        <Route path="risk" element={<RiskDashboard />} />
        <Route path="analytics" element={<AnalyticsDashboard />} />
        <Route path="helpdesk" element={<Helpdesk />} />
        <Route path="surveys" element={<Surveys />} />
        <Route path="admin" element={<AdminPanel />} />
      </Route>
    </Routes>
  );
}

export default App;
