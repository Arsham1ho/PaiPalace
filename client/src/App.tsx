import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import Leaderboard from "./pages/Leaderboard";
import AgentDetail from "./pages/AgentDetail";
import CreateAgent from "./pages/CreateAgent";
import Portfolio from "./pages/Portfolio";
import Wallet from "./pages/Wallet";
import LiveGames from "./pages/LiveGames";
import GameTable from "./pages/GameTable";
import Players from "./pages/Players";
import ProfileDetail from "./pages/ProfileDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Leaderboard />} />
        <Route path="/agents/:id" element={<AgentDetail />} />
        <Route path="/create" element={<Protected><CreateAgent /></Protected>} />
        <Route path="/portfolio" element={<Protected><Portfolio /></Protected>} />
        <Route path="/wallet" element={<Protected><Wallet /></Protected>} />
        <Route path="/live" element={<LiveGames />} />
        <Route path="/games/:id" element={<GameTable />} />
        <Route path="/players" element={<Players />} />
        <Route path="/players/:id" element={<ProfileDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
