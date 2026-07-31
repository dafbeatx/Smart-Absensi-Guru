import { create } from 'zustand';
import type { AttendanceEngineStep, AttendanceEngineResult } from '../services/attendance-engine.service';
import type { ErrorDefinition } from '../config/error-codes';

export interface AttendanceMachineState {
  currentStep: AttendanceEngineStep;
  result: AttendanceEngineResult | null;
  lastError: ErrorDefinition | null;
  setStep: (step: AttendanceEngineStep) => void;
  setResult: (result: AttendanceEngineResult) => void;
  resetMachine: () => void;
}

export const useAttendanceMachineStore = create<AttendanceMachineState>((set) => ({
  currentStep: 'IDLE',
  result: null,
  lastError: null,

  setStep: (step: AttendanceEngineStep) => set({ currentStep: step }),

  setResult: (result: AttendanceEngineResult) =>
    set({
      result,
      currentStep: result.step,
      lastError: result.error || null,
    }),

  resetMachine: () =>
    set({
      currentStep: 'IDLE',
      result: null,
      lastError: null,
    }),
}));
