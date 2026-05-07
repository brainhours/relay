/**
 * Uazapi Groups Manager
 *
 * Endpoints:
 *   POST /group/create               - create group with initial participants
 *   POST /group/info                 - detailed group info
 *   GET  /group/list                 - simple list (force/noparticipants flags)
 *   POST /group/list                 - paginated list with search filter
 *   POST /group/leave                - leave a group
 *   POST /group/updateParticipants   - add/remove/promote/demote/approve/reject
 *   POST /group/updateName
 *   POST /group/updateDescription
 */

function omitUndef(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

class UazapiGroupsManager {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Create a new group.
   * @param {Object} params
   * @param {string} params.name
   * @param {string[]} params.participants
   * @returns {Promise<Object>}
   */
  async create({ token, serverId, name, participants } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/group/create',
      token,
      serverId,
      data: { name, participants }
    });
  }

  /**
   * Detailed info about a group.
   * @param {Object} params
   * @param {string} params.groupjid
   * @param {boolean} [params.getInviteLink]
   * @param {boolean} [params.getRequestsParticipants]
   * @param {boolean} [params.force]
   * @returns {Promise<Object>}
   */
  async info({
    token,
    serverId,
    groupjid,
    getInviteLink,
    getRequestsParticipants,
    force
  } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/group/info',
      token,
      serverId,
      data: omitUndef({ groupjid, getInviteLink, getRequestsParticipants, force })
    });
  }

  /**
   * Simple list (GET).
   * @param {Object} [params]
   * @param {boolean} [params.force]
   * @param {boolean} [params.noparticipants]
   * @returns {Promise<Object>}
   */
  async list({ token, serverId, force, noparticipants } = {}) {
    return this.provider.request({
      method: 'GET',
      path: '/group/list',
      params: omitUndef({ force, noparticipants }),
      token,
      serverId
    });
  }

  /**
   * Paginated list with search filter (POST variant).
   * @param {Object} [params]
   * @param {number} [params.limit]
   * @param {number} [params.offset]
   * @param {string} [params.search]
   * @param {boolean} [params.force]
   * @param {boolean} [params.noParticipants]
   * @returns {Promise<Object>}
   */
  async listPaginated({
    token,
    serverId,
    limit,
    offset,
    search,
    force,
    noParticipants
  } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/group/list',
      token,
      serverId,
      data: omitUndef({ limit, offset, search, force, noParticipants })
    });
  }

  /**
   * Leave a group.
   * @param {Object} params
   * @param {string} params.groupjid
   * @returns {Promise<Object>}
   */
  async leave({ token, serverId, groupjid } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/group/leave',
      token,
      serverId,
      data: { groupjid }
    });
  }

  /**
   * Manage participants.
   * @param {Object} params
   * @param {string} params.groupjid
   * @param {'add'|'remove'|'promote'|'demote'|'approve'|'reject'} params.action
   * @param {string[]} params.participants
   * @returns {Promise<Object>}
   */
  async updateParticipants({ token, serverId, groupjid, action, participants } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/group/updateParticipants',
      token,
      serverId,
      data: { groupjid, action, participants }
    });
  }

  /**
   * Update group name.
   * @param {Object} params
   * @param {string} params.groupjid
   * @param {string} params.name
   * @returns {Promise<Object>}
   */
  async updateName({ token, serverId, groupjid, name } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/group/updateName',
      token,
      serverId,
      data: { groupjid, name }
    });
  }

  /**
   * Update group description / topic.
   * @param {Object} params
   * @param {string} params.groupjid
   * @param {string} params.description
   * @returns {Promise<Object>}
   */
  async updateDescription({ token, serverId, groupjid, description } = {}) {
    return this.provider.request({
      method: 'POST',
      path: '/group/updateDescription',
      token,
      serverId,
      data: { groupjid, description }
    });
  }
}

module.exports = { UazapiGroupsManager };
