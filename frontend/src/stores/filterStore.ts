/**
 * Filter Store
 * Global state for filter persistence across views using Zustand
 * Filters persist during the session and across route navigation
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FilterState {
  search: string;
  selectedDEOs: number[];
  selectedProvinces: string[];
  selectedStatuses: string[];
  selectedFundYears: number[];
  selectedFundSources: string[];
  selectedModes: string[];
  selectedScales: string[];
}

interface FilterActions {
  setSearch: (value: string) => void;
  setSelectedDEOs: (value: number[]) => void;
  setSelectedProvinces: (value: string[]) => void;
  setSelectedStatuses: (value: string[]) => void;
  setSelectedFundYears: (value: number[]) => void;
  setSelectedFundSources: (value: string[]) => void;
  setSelectedModes: (value: string[]) => void;
  setSelectedScales: (value: string[]) => void;
  clearAllFilters: () => void;
}

type FilterStore = FilterState & FilterActions;

const initialState: FilterState = {
  search: '',
  selectedDEOs: [],
  selectedProvinces: [],
  selectedStatuses: [],
  selectedFundYears: [],
  selectedFundSources: [],
  selectedModes: [],
  selectedScales: [],
};

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      ...initialState,

      setSearch: (value) => set({ search: value }),
      setSelectedDEOs: (value) => set({ selectedDEOs: value }),
      setSelectedProvinces: (value) => set({ selectedProvinces: value }),
      setSelectedStatuses: (value) => set({ selectedStatuses: value }),
      setSelectedFundYears: (value) => set({ selectedFundYears: value }),
      setSelectedFundSources: (value) => set({ selectedFundSources: value }),
      setSelectedModes: (value) => set({ selectedModes: value }),
      setSelectedScales: (value) => set({ selectedScales: value }),

      clearAllFilters: () => set(initialState),
    }),
    {
      name: 'ebarmm-filters', // localStorage key
      partialize: (state) => ({
        // Persist all filter state
        search: state.search,
        selectedDEOs: state.selectedDEOs,
        selectedProvinces: state.selectedProvinces,
        selectedStatuses: state.selectedStatuses,
        selectedFundYears: state.selectedFundYears,
        selectedFundSources: state.selectedFundSources,
        selectedModes: state.selectedModes,
        selectedScales: state.selectedScales,
      }),
    }
  )
);

export default useFilterStore;
