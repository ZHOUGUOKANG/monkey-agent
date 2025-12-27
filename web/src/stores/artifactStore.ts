/**
 * Artifact Store
 * 
 * 管理 Artifact 状态，支持 localStorage 持久化
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Artifact } from '../types';

interface ArtifactState {
  artifacts: Map<string, Artifact>;
  currentArtifactId: string | null;
  
  // Actions
  addArtifact: (artifact: Artifact) => void;
  updateArtifact: (id: string, code: string) => void;
  deleteArtifact: (id: string) => void;
  setCurrentArtifact: (id: string | null) => void;
  getArtifact: (id: string) => Artifact | undefined;
  getAllArtifacts: () => Artifact[];
  clearAll: () => void;
}

export const useArtifactStore = create<ArtifactState>()(
  persist(
    (set, get) => ({
      artifacts: new Map<string, Artifact>(),
      currentArtifactId: null,

      addArtifact: (artifact: Artifact) => {
        set((state) => {
          const newArtifacts = new Map(state.artifacts);
          newArtifacts.set(artifact.id, artifact);
          return {
            artifacts: newArtifacts,
            currentArtifactId: artifact.id,
          };
        });
      },

      updateArtifact: (id: string, code: string) => {
        set((state) => {
          const artifact = state.artifacts.get(id);
          if (!artifact) return state;

          const updatedArtifact: Artifact = {
            ...artifact,
            code,
            updatedAt: Date.now(),
          };

          const newArtifacts = new Map(state.artifacts);
          newArtifacts.set(id, updatedArtifact);

          return {
            artifacts: newArtifacts,
          };
        });
      },

      deleteArtifact: (id: string) => {
        set((state) => {
          const newArtifacts = new Map(state.artifacts);
          newArtifacts.delete(id);

          return {
            artifacts: newArtifacts,
            currentArtifactId: state.currentArtifactId === id ? null : state.currentArtifactId,
          };
        });
      },

      setCurrentArtifact: (id: string | null) => {
        set({ currentArtifactId: id });
      },

      getArtifact: (id: string) => {
        return get().artifacts.get(id);
      },

      getAllArtifacts: () => {
        return Array.from(get().artifacts.values()).sort(
          (a, b) => b.createdAt - a.createdAt
        );
      },

      clearAll: () => {
        set({
          artifacts: new Map(),
          currentArtifactId: null,
        });
      },
    }),
    {
      name: 'artifact-storage',
      // Map 需要特殊处理以支持 localStorage
      partialize: (state) => ({
        artifacts: Array.from(state.artifacts.entries()),
        currentArtifactId: state.currentArtifactId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.artifacts)) {
          state.artifacts = new Map(state.artifacts as any);
        }
      },
    }
  )
);

