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
  UploadStudentDocumentDTO,
  UploadDocumentResult,
} from '../types/homeroom.types';

export class HomeroomRepository {
  public static async getOverview(token: string, className?: string): Promise<HomeroomOverview> {
    return ProviderFactory.getProvider().getHomeroomOverview(token, className);
  }

  public static async getStudents(token: string, className?: string): Promise<HomeroomStudentItem[]> {
    return ProviderFactory.getProvider().getHomeroomStudents(token, className);
  }

  public static async getStudentDetail(studentId: string, token: string): Promise<StudentPlanDetail> {
    return ProviderFactory.getProvider().getStudentPlanDetail(studentId, token);
  }

  public static async verifyPlan(dto: VerifyPlanDTO, token: string): Promise<VerifyPlanResult> {
    return ProviderFactory.getProvider().verifyStudentPlan(dto, token);
  }

  public static async getDocumentUrl(documentId: string, token: string): Promise<string> {
    return ProviderFactory.getProvider().getHomeroomDocumentUrl(documentId, token);
  }

  public static async savePlan(dto: SaveStudentPlanDTO, token: string): Promise<{ success: boolean; message: string; plan_id?: string }> {
    return ProviderFactory.getProvider().saveStudentPlan(dto, token);
  }

  public static async uploadDocument(dto: UploadStudentDocumentDTO, token: string): Promise<UploadDocumentResult> {
    return ProviderFactory.getProvider().uploadStudentDocument(dto, token);
  }
}
