'use strict';

const { query } = require('../config/database');
const crypto = require('crypto');

function inviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function getByOwner(ownerUserId) {
  const result = await query(
    `SELECT * FROM households WHERE owner_user_id = $1`,
    [ownerUserId]
  );
  return result.rows[0] || null;
}

async function getMembership(userId) {
  const result = await query(
    `SELECT hm.*, h.owner_user_id, h.max_members, h.status AS household_status
     FROM household_members hm
     JOIN households h ON h.id = hm.household_id
     WHERE hm.user_id = $1 AND hm.status = 'active'
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function ensureHousehold(ownerUserId) {
  const existing = await getByOwner(ownerUserId);
  if (existing) {
    const ownerMember = await query(
      `SELECT id FROM household_members
       WHERE household_id = $1 AND user_id = $2 AND role = 'owner' AND status = 'active'`,
      [existing.id, ownerUserId]
    );
    if (!ownerMember.rowCount) {
      await query(
        `INSERT INTO household_members (household_id, user_id, role, status, joined_at)
         VALUES ($1, $2, 'owner', 'active', NOW())`,
        [existing.id, ownerUserId]
      );
    }
    return existing;
  }

  const created = await query(
    `INSERT INTO households (owner_user_id)
     VALUES ($1)
     ON CONFLICT (owner_user_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [ownerUserId]
  );
  const hh = created.rows[0];
  const ownerMember = await query(
    `SELECT id FROM household_members
     WHERE household_id = $1 AND user_id = $2 AND role = 'owner'`,
    [hh.id, ownerUserId]
  );
  if (!ownerMember.rowCount) {
    await query(
      `INSERT INTO household_members (household_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'owner', 'active', NOW())`,
      [hh.id, ownerUserId]
    );
  }
  return hh;
}

async function listMembers(householdId) {
  const result = await query(
    `SELECT hm.id, hm.user_id, hm.role, hm.status, hm.invite_email, hm.invite_code,
            hm.invited_at, hm.joined_at, u.email, u.full_name
     FROM household_members hm
     LEFT JOIN users u ON u.id = hm.user_id
     WHERE hm.household_id = $1
       AND hm.status IN ('pending', 'active')
     ORDER BY CASE hm.role WHEN 'owner' THEN 0 ELSE 1 END, hm.invited_at`,
    [householdId]
  );
  return result.rows;
}

async function countActive(householdId) {
  const result = await query(
    `SELECT COUNT(*)::int AS c FROM household_members
     WHERE household_id = $1 AND status = 'active'`,
    [householdId]
  );
  return result.rows[0].c;
}

async function invite({ householdId, email, existingUserId }) {
  const code = inviteCode();
  const result = await query(
    `INSERT INTO household_members
       (household_id, user_id, role, invite_email, invite_code, status)
     VALUES ($1, $2, 'member', $3, $4, 'pending')
     RETURNING *`,
    [
      householdId,
      existingUserId || null,
      String(email).toLowerCase().trim(),
      code,
    ]
  );
  return result.rows[0];
}

async function findInviteByCode(code) {
  const result = await query(
    `SELECT hm.*, h.owner_user_id, h.max_members, h.status AS household_status
     FROM household_members hm
     JOIN households h ON h.id = hm.household_id
     WHERE hm.invite_code = $1 AND hm.status = 'pending'`,
    [String(code || '').toUpperCase().trim()]
  );
  return result.rows[0] || null;
}

async function acceptInvite({ inviteRow, userId }) {
  const result = await query(
    `UPDATE household_members
     SET user_id = $2,
         status = 'active',
         joined_at = NOW(),
         invite_code = NULL
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [inviteRow.id, userId]
  );
  return result.rows[0] || null;
}

async function removeMember(householdId, userId) {
  const result = await query(
    `UPDATE household_members SET status = 'removed'
     WHERE household_id = $1 AND user_id = $2 AND role = 'member'
       AND status IN ('active', 'pending')
     RETURNING *`,
    [householdId, userId]
  );
  return result.rows[0] || null;
}

async function leave(householdId, userId) {
  const result = await query(
    `UPDATE household_members SET status = 'left'
     WHERE household_id = $1 AND user_id = $2 AND role = 'member'
     RETURNING *`,
    [householdId, userId]
  );
  return result.rows[0] || null;
}

async function cancelPending(householdId, memberId) {
  const result = await query(
    `DELETE FROM household_members
     WHERE household_id = $1 AND id = $2 AND status = 'pending'
     RETURNING *`,
    [householdId, memberId]
  );
  return result.rows[0] || null;
}

async function findUserByEmail(email) {
  const result = await query(
    `SELECT id, email FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL`,
    [email]
  );
  return result.rows[0] || null;
}

module.exports = {
  inviteCode,
  getByOwner,
  getMembership,
  ensureHousehold,
  listMembers,
  countActive,
  invite,
  findInviteByCode,
  acceptInvite,
  removeMember,
  leave,
  cancelPending,
  findUserByEmail,
};
