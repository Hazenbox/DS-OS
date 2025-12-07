import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useTenant } from './TenantContext';

interface Project {
  _id: Id<"projects">;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  userId: string;
}

interface ProjectContextType {
  activeProject: Project | null | undefined;
  projectId: Id<"projects"> | undefined;
  tenantId: Id<"tenants"> | undefined;
  userId: Id<"users"> | undefined;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  activeProject: undefined,
  projectId: undefined,
  tenantId: undefined,
  userId: undefined,
  isLoading: true,
});

export const useProject = () => useContext(ProjectContext);

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const { tenantId, userId } = useTenant();
  
  const activeProject = useQuery(
    api.projects.getActive,
    tenantId && userId
      ? { tenantId, userId }
      : "skip"
  );
  
  const value: ProjectContextType = {
    activeProject,
    projectId: activeProject?._id,
    tenantId,
    userId,
    isLoading: tenantId === undefined || userId === undefined || activeProject === undefined,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};
