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
  userId: string;
}

interface ProjectContextType {
  activeProject: Project | null | undefined;
  projectId: Id<"projects"> | undefined;
  userId: string | undefined;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  activeProject: undefined,
  projectId: undefined,
  userId: undefined,
  isLoading: true,
});

export const useProject = () => useContext(ProjectContext);

interface ProjectProviderProps {
  children: ReactNode;
  userId: string;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children, userId }) => {
  const activeProject = useQuery(api.projects.getActive, { userId });
  
  const value: ProjectContextType = {
    activeProject,
    projectId: activeProject?._id,
    userId,
    isLoading: activeProject === undefined,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};
