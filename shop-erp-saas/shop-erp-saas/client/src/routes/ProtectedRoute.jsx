import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from '../components/ui/Spinner.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  // superadmin should land in /admin
  if (user.role === 'superadmin' && !location.pathname.startsWith('/admin'))
    return <Navigate to="/admin" replace />;
  return children;
}
