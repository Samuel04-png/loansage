import { Navigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';

interface InviteRouteProps {
  children: React.ReactNode;
}

export function InviteRoute({ children }: InviteRouteProps) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
}

