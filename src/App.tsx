import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ItemsList from "./pages/ItemsList";
import InvoicesPage from "./pages/InvoicesPage";
import PrivateRoute from "./components/PrivateRoute";
import MainLayout from "./layouts/MainLayout";
import InvoiceEditor from "./components/InvoiceEditor";

export default function App() {
  return (
    // Remove the Container wrapper
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/invoices" replace />} />

      {/* Protected layout */}
      <Route
        element={
          <PrivateRoute>
            <MainLayout><Outlet /></MainLayout>
          </PrivateRoute>
        }
      >
        <Route path="/items" element={<ItemsList />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoice/new" element={<InvoiceEditor />} />
        <Route path="/invoice/edit/:id" element={<InvoiceEditor />} />
      </Route>

      {/* fallback */}
      <Route path="*" element={<div>Not found</div>} />
    </Routes>
  );
}