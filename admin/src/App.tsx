import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import ProductForm from "@/pages/ProductForm";
import Categories from "@/pages/Categories";
import Characters from "@/pages/Characters";
import Orders from "@/pages/Orders";
import Branches from "@/pages/Branches";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/new" element={<ProductForm />} />
        <Route path="/products/:id" element={<ProductForm />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/characters" element={<Characters />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
