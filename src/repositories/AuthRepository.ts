import { ProviderFactory } from '../providers/provider-factory';
import type { UserProfile } from '../types/database.types';

export interface LoginDTO {
  identity: string;
  pin: string;
  device_uuid: string;
  device_model: string;
  user_agent?: string;
}

export interface LoginResponseDTO {
  token: string;
  user: UserProfile;
}

export class AuthRepository {
  public static async login(dto: LoginDTO): Promise<LoginResponseDTO> {
    return ProviderFactory.getProvider().login(dto);
  }

  public static async verifySession(token: string): Promise<UserProfile> {
    return ProviderFactory.getProvider().verifySession(token);
  }

  public static async resetDevice(userId: string, token: string): Promise<boolean> {
    return ProviderFactory.getProvider().resetDevice(userId, token);
  }

  public static async changePin(userId: string, newPin: string, token: string): Promise<boolean> {
    return ProviderFactory.getProvider().changePin(userId, newPin, token);
  }
}
