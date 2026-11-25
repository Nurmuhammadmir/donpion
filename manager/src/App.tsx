import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import ManagerLayout from "@/components/ManagerLayout";
import Login from "@/pages/Login";
import Leads from "@/pages/Leads";
import Stock from "@/pages/Stock";
import Sell from "@/pages/Sell";

// No lazy()/Suspense splitting here — admin/ needs that because of
// mapbox-gl/recharts, neither of which this app depends on at all.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <ManagerLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Leads />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/sell" element={<Sell />} />
      </Route>
    </Routes>
  );
}
