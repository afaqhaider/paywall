import type { ERPCompany, ERPConfiguration, ERPConnection, ERPPermission } from "@prisma/client";

/**
 * Strips `encryptedApiKey`/`iv`/`authTag` from an ERPConnection row - this
 * function (and `toSafeConnection` below) is the ONLY place an ERPConnection
 * should cross a controller boundary. Never return the raw Prisma
 * `ERPConnection` model directly from a handler.
 */
export type ErpConnectionWithRelations = ERPConnection & {
  company?: ERPCompany | null;
  configuration?: (ERPConfiguration & { permissions?: ERPPermission[] }) | null;
};

export interface SafeErpPermission {
  id: string;
  resource: ERPPermission["resource"];
  canRead: boolean;
  canWrite: boolean;
}

export interface SafeErpConnection {
  id: string;
  baseUrl: string;
  companyId: string;
  lastFour: string;
  apiVersion: string;
  status: ERPConnection["status"];
  lastTestedAt: Date | null;
  lastTestResult: ERPConnection["lastTestResult"];
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  rotatedAt: Date | null;
  company: {
    id: string;
    externalCompanyId: string;
    name: string | null;
    baseCurrency: string | null;
    raw: ERPCompany["raw"];
    fetchedAt: Date;
  } | null;
  configuration: {
    id: string;
    permissions: SafeErpPermission[];
  } | null;
}

export function toSafePermission(permission: ERPPermission): SafeErpPermission {
  return {
    id: permission.id,
    resource: permission.resource,
    canRead: permission.canRead,
    canWrite: permission.canWrite,
  };
}

export function toSafeConnection(connection: ErpConnectionWithRelations): SafeErpConnection {
  return {
    id: connection.id,
    baseUrl: connection.baseUrl,
    companyId: connection.companyId,
    lastFour: connection.lastFour,
    apiVersion: connection.apiVersion,
    status: connection.status,
    lastTestedAt: connection.lastTestedAt,
    lastTestResult: connection.lastTestResult,
    lastSyncedAt: connection.lastSyncedAt,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
    rotatedAt: connection.rotatedAt,
    company: connection.company
      ? {
          id: connection.company.id,
          externalCompanyId: connection.company.externalCompanyId,
          name: connection.company.name,
          baseCurrency: connection.company.baseCurrency,
          raw: connection.company.raw,
          fetchedAt: connection.company.fetchedAt,
        }
      : null,
    configuration: connection.configuration
      ? {
          id: connection.configuration.id,
          permissions: (connection.configuration.permissions ?? []).map(toSafePermission),
        }
      : null,
  };
}
