import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface Project {
  _id: Id<"projects">;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

interface ProjectContextType {
  activeProject: Project | null | undefined;
  projectId: Id<"projects"> | undefined;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  activeProject: undefined,
  projectId: undefined,
  isLoading: true,
});

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const activeProject = useQuery(api.projects.getActive);
  
  const value: ProjectContextType = {
    activeProject,
    projectId: activeProject?._id,
    isLoading: activeProject === undefined,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

