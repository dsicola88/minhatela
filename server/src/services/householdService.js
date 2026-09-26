'use strict';

const householdRepository = require('../repositories/householdRepository');
const userRepository = require('../repositories/userRepository');
const featureFlagService = require('./featureFlagService');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');
const { env } = require('../config/env');

function mapMember(row) {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    email: row.email || row.invite_email,
    fullName: row.full_name || null,
    inviteCode: row.status === 'pending' ? row.invite_code : undefined,
    invitedAt: row.invited_at,
    joinedAt: row.joined_at,
  };
}

async function assertPremiumOwner(userId) {
  const user = await userRepository.findById(userId);
  const ok =
    user?.subscription_status === 'premium_active' &&
    (!user.premium_expires_at || new Date(user.premium_expires_at) > new Date());
  if (!ok && !user?.is_admin) {
    throw createError(
      403,
      'Agregado familiar disponível para assinantes Premium',
      'HOUSEHOLD_PREMIUM_REQUIRED'
    );
  }
  return user;
}

async function getMine(userId) {
  await featureFlagService.assertEnabled(
    'household_enabled',
    'Agregado familiar temporariamente indisponível'
  );

  const membership = await householdRepository.getMembership(userId);
  let household = null;
  let isOwner = false;

  if (membership) {
    isOwner = membership.role === 'owner' || membership.owner_user_id === userId;
    household = {
      id: membership.household_id,
      ownerUserId: membership.owner_user_id,
      maxMembers: membership.max_members,
      status: membership.household_status,
    };
  } else {
    const owned = await householdRepository.getByOwner(userId);
    if (owned) {
      household = {
        id: owned.id,
        ownerUserId: owned.owner_user_id,
        maxMembers: owned.max_members,
        status: owned.status,
      };
      isOwner = true;
    }
  }

  if (!household) {
    return {
      household: null,
      isOwner: false,
      members: [],
      canInvite: false,
      message: 'Crie o agregado familiar para partilhar o Premium com um membro.',
    };
  }

  const members = await householdRepository.listMembers(household.id);
  const activeCount = members.filter((m) => m.status === 'active').length;

  return {
    household,
    isOwner,
    members: members.map(mapMember),
    canInvite: isOwner && activeCount < household.maxMembers,
    slotsUsed: activeCount,
    slotsMax: household.maxMembers,
  };
}

async function create(userId, meta = {}) {
  await featureFlagService.assertEnabled(
    'household_enabled',
    'Agregado familiar temporariamente indisponível'
  );
  await assertPremiumOwner(userId);

  const existingMembership = await householdRepository.getMembership(userId);
  if (existingMembership && existingMembership.role !== 'owner') {
    throw createError(
      409,
      'Já pertence a um agregado. Saia primeiro para criar o seu.',
      'HOUSEHOLD_ALREADY_MEMBER'
    );
  }

  const hh = await householdRepository.ensureHousehold(userId);
  await auditRepository.write({
    actorId: userId,
    action: 'household.created',
    entity: 'household',
    entityId: hh.id,
    ip: meta.ip,
  });

  return getMine(userId);
}

async function invite(userId, body, meta = {}) {
  await featureFlagService.assertEnabled(
    'household_enabled',
    'Agregado familiar temporariamente indisponível'
  );
  await assertPremiumOwner(userId);

  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    throw createError(400, 'Email inválido', 'VALIDATION');
  }

  const hh = await householdRepository.ensureHousehold(userId);
  const active = await householdRepository.countActive(hh.id);
  if (active >= hh.max_members) {
    throw createError(409, 'Agregado cheio', 'HOUSEHOLD_FULL');
  }

  const existingUser = await householdRepository.findUserByEmail(email);
  if (existingUser?.id === userId) {
    throw createError(400, 'Não pode convidar-se a si próprio', 'HOUSEHOLD_SELF');
  }
  if (existingUser) {
    const theirMembership = await householdRepository.getMembership(existingUser.id);
    if (theirMembership) {
      throw createError(409, 'Utilizador já está noutro agregado', 'HOUSEHOLD_BUSY');
    }
  }

  const row = await householdRepository.invite({
    householdId: hh.id,
    email,
    existingUserId: existingUser?.id || null,
  });

  await auditRepository.write({
    actorId: userId,
    action: 'household.invited',
    entity: 'household',
    entityId: hh.id,
    metadata: { email, inviteCode: row.invite_code },
    ip: meta.ip,
  });

  try {
    if (existingUser) {
      const notificationService = require('./notificationService');
      await notificationService.notify({
        userId: existingUser.id,
        type: 'system',
        title: 'Convite para agregado familiar',
        body: `Use o código ${row.invite_code} em Conta → Agregado familiar.`,
      });
    }
  } catch {
    /* optional */
  }

  return {
    invite: mapMember(row),
    shareMessage: `Junte-se ao meu agregado MinhaTela com o código ${row.invite_code}. ${env.appPublicUrl || ''}/account`,
  };
}

async function accept(userId, code, meta = {}) {
  await featureFlagService.assertEnabled(
    'household_enabled',
    'Agregado familiar temporariamente indisponível'
  );

  const myMembership = await householdRepository.getMembership(userId);
  if (myMembership) {
    throw createError(409, 'Já pertence a um agregado', 'HOUSEHOLD_ALREADY_MEMBER');
  }

  const inviteRow = await householdRepository.findInviteByCode(code);
  if (!inviteRow) {
    throw createError(404, 'Convite inválido ou expirado', 'HOUSEHOLD_INVITE_INVALID');
  }
  if (inviteRow.household_status !== 'active') {
    throw createError(410, 'Agregado suspenso', 'HOUSEHOLD_SUSPENDED');
  }
  if (inviteRow.owner_user_id === userId) {
    throw createError(400, 'Não pode aceitar o próprio convite', 'HOUSEHOLD_SELF');
  }

  const active = await householdRepository.countActive(inviteRow.household_id);
  if (active >= inviteRow.max_members) {
    throw createError(409, 'Agregado cheio', 'HOUSEHOLD_FULL');
  }

  const member = await householdRepository.acceptInvite({ inviteRow, userId });
  if (!member) {
    throw createError(410, 'Convite já usado', 'HOUSEHOLD_INVITE_INVALID');
  }

  await auditRepository.write({
    actorId: userId,
    action: 'household.joined',
    entity: 'household',
    entityId: inviteRow.household_id,
    ip: meta.ip,
  });

  return getMine(userId);
}

async function remove(userId, memberUserId, meta = {}) {
  const mine = await getMine(userId);
  if (!mine.isOwner || !mine.household) {
    throw createError(403, 'Apenas o titular pode remover membros', 'FORBIDDEN');
  }
  if (memberUserId === userId) {
    throw createError(400, 'Não pode remover o titular', 'VALIDATION');
  }
  const removed = await householdRepository.removeMember(mine.household.id, memberUserId);
  if (!removed) throw createError(404, 'Membro não encontrado', 'NOT_FOUND');

  await auditRepository.write({
    actorId: userId,
    action: 'household.removed',
    entity: 'household',
    entityId: mine.household.id,
    metadata: { memberUserId },
    ip: meta.ip,
  });
  return getMine(userId);
}

async function leaveHousehold(userId, meta = {}) {
  const membership = await householdRepository.getMembership(userId);
  if (!membership) throw createError(404, 'Não pertence a um agregado', 'NOT_FOUND');
  if (membership.role === 'owner') {
    throw createError(
      400,
      'O titular não pode sair. Remova membros ou contacte o suporte.',
      'HOUSEHOLD_OWNER'
    );
  }
  await householdRepository.leave(membership.household_id, userId);
  await auditRepository.write({
    actorId: userId,
    action: 'household.left',
    entity: 'household',
    entityId: membership.household_id,
    ip: meta.ip,
  });
  return { left: true };
}

/**
 * Benefício enterprise: membro activo herda Premium do titular se o titular estiver activo.
 */
async function resolveEffectiveSubscription(userId) {
  const user = await userRepository.findById(userId);
  const selfPremium =
    user?.subscription_status === 'premium_active' &&
    (!user.premium_expires_at || new Date(user.premium_expires_at) > new Date());

  if (selfPremium) {
    return {
      status: 'premium_active',
      expiresAt: user.premium_expires_at,
      source: 'self',
    };
  }

  try {
    await featureFlagService.assertEnabled('household_enabled');
  } catch {
    return { status: user?.subscription_status || 'free', expiresAt: null, source: 'self' };
  }

  const membership = await householdRepository.getMembership(userId);
  if (!membership || membership.role === 'owner') {
    return {
      status: user?.subscription_status || 'free',
      expiresAt: user?.premium_expires_at || null,
      source: 'self',
    };
  }

  const owner = await userRepository.findById(membership.owner_user_id);
  const ownerPremium =
    owner?.subscription_status === 'premium_active' &&
    (!owner.premium_expires_at || new Date(owner.premium_expires_at) > new Date());

  if (ownerPremium) {
    return {
      status: 'premium_active',
      expiresAt: owner.premium_expires_at,
      source: 'household',
      householdOwnerId: membership.owner_user_id,
    };
  }

  return {
    status: user?.subscription_status || 'free',
    expiresAt: user?.premium_expires_at || null,
    source: 'self',
  };
}

module.exports = {
  getMine,
  create,
  invite,
  accept,
  remove,
  leaveHousehold,
  resolveEffectiveSubscription,
};
