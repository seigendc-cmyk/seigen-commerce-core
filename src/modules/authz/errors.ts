import type { PermissionCheckResult } from "./types";

export class AuthorizationDeniedError extends Error {
  name = "AuthorizationDeniedError";
  result: PermissionCheckResult;
  constructor(result: PermissionCheckResult) {
    super(result.reasonMessage);
    this.result = result;
  }
}

export class PermissionNotFoundError extends Error {
  name = "PermissionNotFoundError";
  permissionKey: string;
  constructor(permissionKey: string) {
    super(`Permission not found: ${permissionKey}`);
    this.permissionKey = permissionKey;
  }
}

export class ScopeMismatchError extends Error {
  name = "ScopeMismatchError";
  constructor(message = "Scope mismatch") {
    super(message);
  }
}

export class ProtectedRoleOperationError extends Error {
  name = "ProtectedRoleOperationError";
  constructor(message = "Protected role operation denied") {
    super(message);
  }
}

export class InactiveRoleAssignmentError extends Error {
  name = "InactiveRoleAssignmentError";
  constructor(message = "Inactive role assignment") {
    super(message);
  }
}

export class CriticalActionRequirementError extends Error {
  name = "CriticalActionRequirementError";
  constructor(message = "Critical action requirement not met") {
    super(message);
  }
}

