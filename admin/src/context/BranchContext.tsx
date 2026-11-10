import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Branch } from "@/lib/types";

const ACTIVE_BRANCH_KEY = "flower-shop-admin-active-branch";

interface BranchContextValue {
  branches: Branch[];
  loading: boolean;
  // CEO (role "superadmin") sees every branch and can switch, including
  // to "all branches" (activeBranchId === null). A branch-pinned account
  // is locked to its own branch and never sees the switcher.
  isCEO: boolean;
  activeBranchId: string | null;
  activeBranch: Branch | null;
  setActiveBranchId: (id: string | null) => void;
  refresh: () => void;
}

const BranchContext = createContext<BranchContextValue | null>(null);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { admin } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_BRANCH_KEY) || null;
    } catch {
      return null;
    }
  });

  const isCEO = admin?.role === "superadmin";

  const setActiveBranchId = (id: string | null) => {
    setActiveBranchIdState(id);
    try {
      if (id) localStorage.setItem(ACTIVE_BRANCH_KEY, id);
      else localStorage.removeItem(ACTIVE_BRANCH_KEY);
    } catch {
      /* private-mode/blocked storage — switching still works for this session */
    }
  };

  const load = () => {
    setLoading(true);
    api<Branch[]>("/branches/admin/all")
      .then(setBranches)
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (admin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.id]);

  // Keep the active branch honest: a staff account is always pinned to
  // its own branch (never "all"), and a CEO's remembered choice is reset
  // to "all branches" if it ever points at a branch that no longer exists.
  useEffect(() => {
    if (!admin) return;
    if (!isCEO) {
      if (admin.branch && admin.branch !== activeBranchId) setActiveBranchId(admin.branch);
      return;
    }
    if (activeBranchId && branches.length > 0 && !branches.some((b) => b._id === activeBranchId)) {
      setActiveBranchId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, isCEO, branches]);

  const activeBranch = useMemo(() => branches.find((b) => b._id === activeBranchId) ?? null, [branches, activeBranchId]);

  return (
    <BranchContext.Provider value={{ branches, loading, isCEO, activeBranchId, activeBranch, setActiveBranchId, refresh: load }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
}
