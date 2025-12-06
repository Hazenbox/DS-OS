import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface Tenant {
  _id: Id<"tenants">;
  name: string;
  slug: string;
  plan?: "free" | "pro" | "enterprise";
  status: "active" | "suspended" | "deleted" | "pending";
  createdAt: number;
  updatedAt: number;
}

interface TenantContextType {
  activeTenant: Tenant | null | undefined;
  tenantId: Id<"tenants"> | undefined;
  userId: Id<"users"> | undefined;
  isLoading: boolean;
  switchTenant: (tenantId: Id<"tenants">) => void;
  refreshTenants: () => void;
}

const TenantContext = createContext<TenantContextType>({
  activeTenant: undefined,
  tenantId: undefined,
  userId: undefined,
  isLoading: true,
  switchTenant: () => {},
  refreshTenants: () => {},
});

export const useTenant = () => useContext(TenantContext);

interface TenantProviderProps {
  children: ReactNode;
  userId: Id<"users">;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children, userId }) => {
  const [activeTenantId, setActiveTenantId] = useState<Id<"tenants"> | null>(null);
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  
  // Get user's tenants
  const tenants = useQuery(api.tenants.list, { userId });
  const createTenant = useMutation(api.tenants.create);
  
  // Auto-create personal tenant if user has none
  // This will be handled by the migration script, but we can also create on-demand
  useEffect(() => {
    if (tenants && tenants.length === 0 && !isCreatingTenant) {
      setIsCreatingTenant(true);
      // Create a personal tenant with a safe slug
      const tenantSlug = `personal-${userId.replace(/[^a-zA-Z0-9]/g, '-')}`;
      
      createTenant({
        name: "My Workspace",
        slug: tenantSlug,
        userId,
        plan: 'free',
      })
        .then((newTenantId) => {
          setActiveTenantId(newTenantId);
          localStorage.setItem('activeTenantId', newTenantId);
          setIsCreatingTenant(false);
        })
        .catch((error) => {
          console.error('Failed to create personal tenant:', error);
          setIsCreatingTenant(false);
        });
    }
  }, [tenants, userId, isCreatingTenant, createTenant]);
  
  // Get active tenant details
  const activeTenant = useQuery(
    api.tenants.get,
    activeTenantId && userId
      ? { tenantId: activeTenantId, userId }
      : "skip"
  );
  
  // Load active tenant from localStorage on mount
  useEffect(() => {
    if (tenants && tenants.length > 0 && !activeTenantId && !isCreatingTenant) {
      const savedTenantId = localStorage.getItem('activeTenantId');
      if (savedTenantId) {
        // Verify the saved tenant is still in user's tenants
        const savedTenant = tenants.find(t => t._id === savedTenantId);
        if (savedTenant && savedTenant.status === 'active') {
          setActiveTenantId(savedTenantId as Id<"tenants">);
          return;
        }
      }
      // Default to first active tenant
      const firstActive = tenants.find(t => t.status === 'active');
      if (firstActive) {
        setActiveTenantId(firstActive._id);
        localStorage.setItem('activeTenantId', firstActive._id);
      }
    }
  }, [tenants, activeTenantId, isCreatingTenant]);
  
  // Save active tenant to localStorage when it changes
  useEffect(() => {
    if (activeTenantId) {
      localStorage.setItem('activeTenantId', activeTenantId);
    }
  }, [activeTenantId]);
  
  const switchTenant = (tenantId: Id<"tenants">) => {
    setActiveTenantId(tenantId);
    localStorage.setItem('activeTenantId', tenantId);
  };
  
  const refreshTenants = () => {
    // Force refetch by updating a dummy state
    // The query will automatically refetch
  };
  
  const value: TenantContextType = {
    activeTenant: activeTenant || null,
    tenantId: activeTenantId || undefined,
    userId,
    isLoading: tenants === undefined || isCreatingTenant || (activeTenantId !== null && activeTenant === undefined),
    switchTenant,
    refreshTenants,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

