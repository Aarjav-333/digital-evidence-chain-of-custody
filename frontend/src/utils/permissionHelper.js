/**
 * =============================================================================
 * Role & Forensic Reports Permission Helpers
 * =============================================================================
 * Role Mapping:
 * - 1: System Administrator (View-only for reports/autopsies, full download)
 * - 2: Police Officer       (View-only for reports/autopsies, full download)
 * - 3: Case Manager         (View-only for reports/autopsies, full download)
 * - 4: Forensic Analyst     ("Forensic Officer" - full authoring, drafting, dispatch)
 */

/**
 * Checks if the user is authorized to create, draft, submit, or dispatch forensic and autopsy reports.
 * Exclusively restricted to role_id === 4 (Forensic Officer / Forensic Analyst).
 *
 * @param {Object|number|string} userOrRole User object or numeric role_id
 * @returns {boolean}
 */
export const canAuthorReports = (userOrRole) => {
  if (!userOrRole) return false;
  const roleId = typeof userOrRole === "object" ? userOrRole.role_id : Number(userOrRole);
  return Number(roleId) === 4;
};

/**
 * Checks if the user is authorized to view lists, examine records, and download reports.
 * Open to roles 1, 2, 3, and 4.
 *
 * @param {Object|number|string} userOrRole User object or numeric role_id
 * @returns {boolean}
 */
export const canViewReports = (userOrRole) => {
  if (!userOrRole) return false;
  const roleId = typeof userOrRole === "object" ? userOrRole.role_id : Number(userOrRole);
  return [1, 2, 3, 4].includes(Number(roleId));
};

/**
 * Checks if the user is authorized to decrypt or download raw/decrypted digital evidence.
 * Restricted strictly to System Administrator (role_id === 1) and Forensic Analyst (role_id === 4).
 * Roles 2 (Police Officer) and 3 (Case Manager) return false.
 *
 * @param {Object|number|string} userOrRole User object or numeric role_id
 * @returns {boolean}
 */
export const canDecryptEvidence = (userOrRole) => {
  if (!userOrRole) return false;
  const roleId = typeof userOrRole === "object" ? userOrRole.role_id : Number(userOrRole);
  return [1, 4].includes(Number(roleId));
};

/**
 * Checks if the user is authorized to verify cryptographic evidence hashes.
 * Open to all authenticated roles (1, 2, 3, 4).
 *
 * @param {Object|number|string} userOrRole User object or numeric role_id
 * @returns {boolean}
 */
export const canVerifyEvidence = (userOrRole) => {
  if (!userOrRole) return false;
  const roleId = typeof userOrRole === "object" ? userOrRole.role_id : Number(userOrRole);
  return [1, 2, 3, 4].includes(Number(roleId));
};

