// src/repositories/HomeroomRepository.ts
// Centralized Repository for Homeroom & Student Continuation Plans
// Enforces Provider Pattern abstraction (ProviderFactory.getProvider())

import { ProviderFactory } from '../providers/provider-factory';
import type {
  HomeroomOverview,
  HomeroomStudentItem,
  StudentPlanDetail,
  VerifyPlanDTO,
  VerifyPlanResult,
  SaveStudentPlanDTO,
  SaveStudentPlanResult,
} from '../types/homeroom.types';

export class HomeroomRepository {
  public static async getOverview(
    token: string,
    className?: string,
    academicYear: string = '2026/2027'
  ): Promise<HomeroomOverview> {
    return ProviderFactory.getProvider().getHomeroomOverview(token, className, academicYear);
  }

  public static async getStudents(
    token: string,
    className?: string,
    academicYear: string = '2026/2027'
  ): Promise<HomeroomStudentItem[]> {
    return ProviderFactory.getProvider().getHomeroomStudents(token, className, academicYear);
  }

  public static async getStudentDetail(
    studentId: string,
    token: string,
    academicYear: string = '2026/2027'
  ): Promise<StudentPlanDetail> {
    return ProviderFactory.getProvider().getStudentPlanDetail(studentId, token, academicYear);
  }

  public static async verifyPlan(dto: VerifyPlanDTO, token: string): Promise<VerifyPlanResult> {
    return ProviderFactory.getProvider().verifyStudentPlan(dto, token);
  }

  public static async saveStudentPlan(dto: SaveStudentPlanDTO, token: string): Promise<SaveStudentPlanResult> {
    const provider = ProviderFactory.getProvider();
    if (provider.saveStudentPlan) {
      return provider.saveStudentPlan(dto, token);
    }
    return { success: false, message: 'Provider tidak mendukung operasi penyimpanan rencana studi.' };
  }

  public static async getDocumentUrl(documentId: string, token: string): Promise<string> {
    return ProviderFactory.getProvider().getHomeroomDocumentUrl(documentId, token);
  }
}
