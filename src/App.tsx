import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ItemsList from "./pages/ItemsList";
import InvoicesPage from "./pages/InvoicesPage";
import PrivateRoute from "./components/PrivateRoute";
import MainLayout from "./layouts/MainLayout";
import InvoiceEditor from "./components/InvoiceEditor";
import PrintInvoicePage from "./pages/PrintInvoicePage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/" element={<Navigate to="/invoices" replace />} />

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
        <Route path="/invoice/print/:id" element={<PrintInvoicePage />} />
      </Route>

      <Route path="*" element={<div>Not found</div>} />
    </Routes>
  );
}