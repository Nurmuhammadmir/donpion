"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

interface Customer {
  id: string;
  name: string;
  phone: string;
  pointsBalance: number;
}

interface CustomerAuthContextValue {
  customer: Customer | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

// Session lives in the httpOnly donpion_customer cookie set by the server
// after phone+Telegram verification — this just asks "who am I" on load
// and after each verify/logout, rather than tracking any token itself.
export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/customer/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCustomer(data.customer);
      } else {
        setCustomer(null);
      }
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/auth/customer/logout`, { method: "POST", credentials: "include" });
    } finally {
      setCustomer(null);
    }
  }, []);

  return (
    <CustomerAuthContext.Provider value={{ customer, loading, refresh, logout }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within a CustomerAuthProvider");
  return ctx;
}
