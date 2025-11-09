import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import ItemsList from "./pages/ItemsList";
import InvoicesPage from "./pages/InvoicesPage";
import PrivateRoute from "./components/PrivateRoute";
import MainLayout from "./layouts/MainLayout";
import { Container } from "@mui/material";
import InvoiceEditor from "./components/InvoiceEditor";

export default function App() {
  return (
    // Keep a top-level container for page padding for public pages if you like
    <Container sx={{ mt: 1 }}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Root redirect: if user has token handled by PrivateRoute, it will show dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Protected layout: MainLayout will render for any nested protected route */}
        <Route
          element={
            <PrivateRoute>
              <MainLayout><Outlet /></MainLayout>
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/items" element={<ItemsList />} />
          <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/invoice/new" element={<InvoiceEditor />} />
          <Route path="/invoice/edit/:id" element={<InvoiceEditor />} />
          {/* <Route path="/invoice/print/:id" element={<div>Print view placeholder</div>} /> */}
        </Route>

        {/* fallback */}
        <Route path="*" element={<div>Not found</div>} />
      </Routes>
    </Container>
  );
}