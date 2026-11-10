import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import Login from "@/pages/Login";

// Every section but Login is lazy — mapbox-gl (Orders' map, Branches'
// picker) and recharts (Dashboard/Finance) alone pushed the single bundle
// past 2.5MB; splitting per route means a session only ever downloads the
// 1-2 sections it actually opens.
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Showcase = lazy(() => import("@/pages/Showcase"));
const ProductForm = lazy(() => import("@/pages/ProductForm"));
const Categories = lazy(() => import("@/pages/Categories"));
const Characters = lazy(() => import("@/pages/Characters"));
const AddonCategories = lazy(() => import("@/pages/AddonCategories"));
const Occasions = lazy(() => import("@/pages/Occasions"));
const Orders = lazy(() => import("@/pages/Orders"));
const Finance = lazy(() => import("@/pages/Finance"));
const Warehouse = lazy(() => import("@/pages/Warehouse"));
const Branches = lazy(() => import("@/pages/Branches"));
const Settings = lazy(() => import("@/pages/Settings"));

function RouteFallback() {
  return <div className="p-8 text-sm text-graphite">Загрузка…</div>;
}

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
        <Route
          path="/"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Dashboard />
            </Suspense>
          }
        />

        {/* Витрина — visual product browser mirroring the storefront,
            plus its taxonomy (categories/characters/addons/occasions)
            as nested tabs instead of separate sidebar items. */}
        <Route
          path="/showcase"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Showcase />
            </Suspense>
          }
        />
        <Route
          path="/showcase/new"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ProductForm />
            </Suspense>
          }
        />
        <Route
          path="/showcase/:id"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ProductForm />
            </Suspense>
          }
        />
        <Route
          path="/showcase/categories"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Categories />
            </Suspense>
          }
        />
        <Route
          path="/showcase/characters"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Characters />
            </Suspense>
          }
        />
        <Route
          path="/showcase/addons"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AddonCategories />
            </Suspense>
          }
        />
        <Route
          path="/showcase/occasions"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Occasions />
            </Suspense>
          }
        />

        <Route
          path="/orders"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Orders />
            </Suspense>
          }
        />
        <Route
          path="/finance"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Finance />
            </Suspense>
          }
        />
        <Route
          path="/warehouse"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Warehouse />
            </Suspense>
          }
        />

        <Route
          path="/branches"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Branches />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Settings />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
