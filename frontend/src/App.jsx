import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth.jsx";
import Layout from "./components/Layout.jsx";
import { Skeleton } from "./components/States.jsx";
import KanbanBoard from "./components/KanbanBoard.jsx";
import Login from "./screens/Login.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import Candidates from "./screens/Candidates.jsx";
import CandidateDetail from "./screens/CandidateDetail.jsx";

// Login guard: everything inside this route needs a signed-in user.
function RequireAuth() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="boot"><Skeleton rows={3} /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/candidates" element={<Candidates />} />
        <Route path="/candidates/:id" element={<CandidateDetail />} />
        <Route path="/board" element={<KanbanBoard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
