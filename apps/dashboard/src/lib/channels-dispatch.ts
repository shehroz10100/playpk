import {
  ensureChannelSchema,
  httpError,
  jsonErr,
  jsonOk,
  newId,
  requireUserId,
  withDb,
} from '@/lib/channel-server';
import type { Client } from 'pg';

export const runtime = 'nodejs';

type ChannelRow = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  visibility: string;
  sportId: string | null;
  branchId: string | null;
  city: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  sportName: string | null;
  venueName: string | null;
  venueCity: string | null;
  createdByName: string | null;
  memberCount: string | number;
  messageCount: string | number;
  myRole: string | null;
};

const channelSelect = `
  SELECT c.*,
    s.name AS "sportName",
    b.name AS "venueName",
    b.city AS "venueCity",
    u.name AS "createdByName",
    (SELECT COUNT(*) FROM "ChannelMember" cm WHERE cm."channelId" = c.id) AS "memberCount",
    (SELECT COUNT(*) FROM "ChannelMessage" msg WHERE msg."channelId" = c.id AND msg."deletedAt" IS NULL) AS "messageCount",
    (
      SELECT cm2.role::text FROM "ChannelMember" cm2
      WHERE cm2."channelId" = c.id AND cm2."userId" = $1
      LIMIT 1
    ) AS "myRole"
  FROM "ChatChannel" c
  LEFT JOIN "Sport" s ON s.id = c."sportId"
  LEFT JOIN "Branch" b ON b.id = c."branchId"
  LEFT JOIN "User" u ON u.id = c."createdById"
`;

async function mapChannel(client: Client, row: ChannelRow) {
  const last = await client.query<{
    body: string;
    createdAt: Date;
    senderName: string;
  }>(
    `SELECT m.body, m."createdAt", u.name AS "senderName"
     FROM "ChannelMessage" m
     JOIN "User" u ON u.id = m."senderId"
     WHERE m."channelId" = $1 AND m."deletedAt" IS NULL
     ORDER BY m."createdAt" DESC LIMIT 1`,
    [row.id],
  );
  const lastMessage = last.rows[0]
    ? {
        body: last.rows[0].body,
        createdAt: last.rows[0].createdAt,
        senderName: last.rows[0].senderName,
      }
    : null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    visibility: row.visibility,
    sportId: row.sportId,
    branchId: row.branchId,
    city: row.city,
    sportName: row.sportName,
    venueName: row.venueName,
    venueCity: row.venueCity,
    createdById: row.createdById,
    createdByName: row.createdByName,
    memberCount: Number(row.memberCount) || 0,
    messageCount: Number(row.messageCount) || 0,
    myRole: row.myRole,
    lastMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function requireMember(client: Client, channelId: string, userId: string) {
  const res = await client.query<{ role: string; mutedUntil: Date | null }>(
    `SELECT role::text AS role, "mutedUntil" FROM "ChannelMember"
     WHERE "channelId" = $1 AND "userId" = $2`,
    [channelId, userId],
  );
  const row = res.rows[0];
  if (!row) throw httpError('You are not a member of this channel', 403, 'NOT_A_MEMBER');
  return row;
}

async function requireStaff(client: Client, channelId: string, userId: string) {
  const m = await requireMember(client, channelId, userId);
  if (m.role !== 'ADMIN' && m.role !== 'MODERATOR') {
    throw httpError('Admin or moderator permission required', 403, 'FORBIDDEN');
  }
  return m;
}

async function requireAdmin(client: Client, channelId: string, userId: string) {
  const m = await requireMember(client, channelId, userId);
  if (m.role !== 'ADMIN') throw httpError('Channel admin permission required', 403, 'FORBIDDEN');
  return m;
}

async function getChannelDto(client: Client, channelId: string, userId: string) {
  const res = await client.query<ChannelRow>(
    `${channelSelect} WHERE c.id = $2 AND c."archivedAt" IS NULL`,
    [userId, channelId],
  );
  const row = res.rows[0];
  if (!row) throw httpError('Channel not found', 404, 'NOT_FOUND');
  if (row.visibility === 'INVITE' && !row.myRole) {
    throw httpError('This channel is invite-only', 403, 'INVITE_ONLY');
  }
  return mapChannel(client, row);
}

async function listMembersDto(client: Client, channelId: string, userId: string) {
  await requireMember(client, channelId, userId);
  const res = await client.query<{
    userId: string;
    name: string;
    role: string;
    joinedAt: Date;
    mutedUntil: Date | null;
  }>(
    `SELECT m."userId", u.name, m.role::text AS role, m."joinedAt", m."mutedUntil"
     FROM "ChannelMember" m
     JOIN "User" u ON u.id = m."userId"
     WHERE m."channelId" = $1
     ORDER BY m."joinedAt" ASC`,
    [channelId],
  );
  return res.rows.map((m) => ({
    userId: m.userId,
    name: m.name,
    role: m.role,
    joinedAt: m.joinedAt,
    muted: Boolean(m.mutedUntil && m.mutedUntil > new Date()),
  }));
}

/** Shared dispatcher used by /api/channels and /api/channels/[...path]. */
export async function dispatchChannels(req: Request, path: string[]): Promise<Response> {
  const userId = requireUserId(req);
  const method = req.method.toUpperCase();

  return withDb(async (client) => {
    await ensureChannelSchema(client);

    if (method === 'GET' && path[0] === 'mine' && path.length === 1) {
      const res = await client.query<ChannelRow>(
        `${channelSelect}
         WHERE c."archivedAt" IS NULL
           AND EXISTS (
             SELECT 1 FROM "ChannelMember" cm
             WHERE cm."channelId" = c.id AND cm."userId" = $1
           )
         ORDER BY c."updatedAt" DESC`,
        [userId],
      );
      const data = [];
      for (const row of res.rows) data.push(await mapChannel(client, row));
      return jsonOk(data);
    }

    if (method === 'GET' && path[0] === 'discover' && path.length === 1) {
      const url = new URL(req.url);
      const q = url.searchParams.get('q')?.trim() || '';
      const params: unknown[] = [userId];
      let where = `c."archivedAt" IS NULL AND c.visibility = 'PUBLIC'
        AND NOT EXISTS (
          SELECT 1 FROM "ChannelMember" cm
          WHERE cm."channelId" = c.id AND cm."userId" = $1
        )`;
      if (q) {
        params.push(`%${q}%`);
        where += ` AND (c.name ILIKE $2 OR c.description ILIKE $2)`;
      }
      const res = await client.query<ChannelRow>(
        `${channelSelect} WHERE ${where} ORDER BY c."updatedAt" DESC LIMIT 50`,
        params,
      );
      const data = [];
      for (const row of res.rows) data.push(await mapChannel(client, row));
      return jsonOk(data);
    }

    if (method === 'POST' && path.length === 0) {
      const body = (await req.json()) as {
        name?: string;
        description?: string;
        kind?: string;
        visibility?: string;
        sportId?: string;
        branchId?: string;
        city?: string;
      };
      const name = String(body.name ?? '')
        .trim()
        .replace(/\s+/g, ' ');
      if (name.length < 2 || name.length > 64) {
        throw httpError('Name must be 2–64 characters', 400, 'VALIDATION_ERROR');
      }
      const kind = body.kind || 'GENERAL';
      const visibility = body.visibility || 'PUBLIC';
      if (kind === 'SPORT' && !body.sportId) {
        throw httpError('Sport channels require a sport', 400, 'VALIDATION_ERROR');
      }
      if (kind === 'VENUE' && !body.branchId) {
        throw httpError('Venue channels require a venue', 400, 'VALIDATION_ERROR');
      }
      if (kind === 'AREA' && !String(body.city ?? '').trim()) {
        throw httpError('Area channels require a city', 400, 'VALIDATION_ERROR');
      }
      if (body.sportId) {
        const sport = await client.query(`SELECT id FROM "Sport" WHERE id = $1`, [body.sportId]);
        if (!sport.rows[0]) throw httpError('Sport not found', 404, 'NOT_FOUND');
      }
      if (body.branchId) {
        const branch = await client.query(
          `SELECT id FROM "Branch" WHERE id = $1 AND "approvalStatus" = 'APPROVED'`,
          [body.branchId],
        );
        if (!branch.rows[0]) throw httpError('Venue not found', 404, 'NOT_FOUND');
      }

      const id = newId();
      await client.query('BEGIN');
      try {
        await client.query(
          `INSERT INTO "ChatChannel"
            (id, name, description, kind, visibility, "sportId", "branchId", city, "createdById", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4::"ChannelKind",$5::"ChannelVisibility",$6,$7,$8,$9,NOW(),NOW())`,
          [
            id,
            name,
            body.description?.trim() || null,
            kind,
            visibility,
            body.sportId || null,
            body.branchId || null,
            body.city?.trim() || null,
            userId,
          ],
        );
        await client.query(
          `INSERT INTO "ChannelMember" (id, "channelId", "userId", role, "joinedAt")
           VALUES ($1,$2,$3,'ADMIN',NOW())`,
          [newId(), id, userId],
        );
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
      return jsonOk(await getChannelDto(client, id, userId), 201);
    }

    if (path.length === 0) throw httpError('Resource not found', 404, 'NOT_FOUND');

    const channelId = path[0];

    if (method === 'GET' && path.length === 1) {
      return jsonOk(await getChannelDto(client, channelId, userId));
    }

    if (method === 'PATCH' && path.length === 1) {
      await requireAdmin(client, channelId, userId);
      const body = (await req.json()) as {
        name?: string;
        description?: string | null;
        visibility?: string;
      };
      if (body.name !== undefined) {
        const name = body.name.trim().replace(/\s+/g, ' ');
        if (name.length < 2 || name.length > 64) {
          throw httpError('Name must be 2–64 characters', 400, 'VALIDATION_ERROR');
        }
        await client.query(
          `UPDATE "ChatChannel" SET name = $1, "updatedAt" = NOW() WHERE id = $2`,
          [name, channelId],
        );
      }
      if (body.description !== undefined) {
        await client.query(
          `UPDATE "ChatChannel" SET description = $1, "updatedAt" = NOW() WHERE id = $2`,
          [body.description?.trim() || null, channelId],
        );
      }
      if (body.visibility !== undefined) {
        await client.query(
          `UPDATE "ChatChannel" SET visibility = $1::"ChannelVisibility", "updatedAt" = NOW() WHERE id = $2`,
          [body.visibility, channelId],
        );
      }
      return jsonOk(await getChannelDto(client, channelId, userId));
    }

    if (method === 'DELETE' && path.length === 1) {
      await requireAdmin(client, channelId, userId);
      await client.query(
        `UPDATE "ChatChannel" SET "archivedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
        [channelId],
      );
      return jsonOk({ archived: true });
    }

    if (method === 'POST' && path[1] === 'join' && path.length === 2) {
      const ch = await client.query<{ visibility: string }>(
        `SELECT visibility::text AS visibility FROM "ChatChannel" WHERE id = $1 AND "archivedAt" IS NULL`,
        [channelId],
      );
      if (!ch.rows[0]) throw httpError('Channel not found', 404, 'NOT_FOUND');
      if (ch.rows[0].visibility !== 'PUBLIC') {
        throw httpError('This channel is invite-only. Ask an admin to add you.', 403, 'INVITE_ONLY');
      }
      await client.query(
        `INSERT INTO "ChannelMember" (id, "channelId", "userId", role, "joinedAt")
         VALUES ($1,$2,$3,'MEMBER',NOW())
         ON CONFLICT ("channelId", "userId") DO NOTHING`,
        [newId(), channelId, userId],
      );
      return jsonOk(await getChannelDto(client, channelId, userId));
    }

    if (method === 'POST' && path[1] === 'leave' && path.length === 2) {
      const member = await requireMember(client, channelId, userId);
      if (member.role === 'ADMIN') {
        const admins = await client.query(
          `SELECT COUNT(*)::int AS n FROM "ChannelMember" WHERE "channelId" = $1 AND role = 'ADMIN'`,
          [channelId],
        );
        if ((admins.rows[0] as { n: number }).n <= 1) {
          const other = await client.query<{ id: string }>(
            `SELECT id FROM "ChannelMember" WHERE "channelId" = $1 AND "userId" <> $2
             ORDER BY "joinedAt" ASC LIMIT 1`,
            [channelId, userId],
          );
          if (other.rows[0]) {
            await client.query(`UPDATE "ChannelMember" SET role = 'ADMIN' WHERE id = $1`, [
              other.rows[0].id,
            ]);
          } else {
            await client.query(`UPDATE "ChatChannel" SET "archivedAt" = NOW() WHERE id = $1`, [
              channelId,
            ]);
          }
        }
      }
      await client.query(`DELETE FROM "ChannelMember" WHERE "channelId" = $1 AND "userId" = $2`, [
        channelId,
        userId,
      ]);
      return jsonOk({ left: true });
    }

    if (path[1] === 'members') {
      if (method === 'GET' && path.length === 2) {
        return jsonOk(await listMembersDto(client, channelId, userId));
      }
      if (method === 'GET' && path[2] === 'search' && path.length === 3) {
        await requireStaff(client, channelId, userId);
        const q = new URL(req.url).searchParams.get('q')?.trim() || '';
        if (q.length < 2) return jsonOk([]);
        const res = await client.query<{ userId: string; name: string; email: string | null }>(
          `SELECT id AS "userId", name, email FROM "User"
           WHERE "suspendedAt" IS NULL
             AND (name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
             AND NOT EXISTS (
               SELECT 1 FROM "ChannelMember" cm
               WHERE cm."channelId" = $2 AND cm."userId" = "User".id
             )
           LIMIT 20`,
          [`%${q}%`, channelId],
        );
        return jsonOk(res.rows);
      }
      if (method === 'POST' && path.length === 2) {
        await requireStaff(client, channelId, userId);
        const body = (await req.json()) as { userId?: string };
        const target = String(body.userId || '');
        if (!target) throw httpError('userId required', 400, 'VALIDATION_ERROR');
        const user = await client.query(
          `SELECT id FROM "User" WHERE id = $1 AND "suspendedAt" IS NULL`,
          [target],
        );
        if (!user.rows[0]) throw httpError('User not found', 404, 'NOT_FOUND');
        await client.query(
          `INSERT INTO "ChannelMember" (id, "channelId", "userId", role, "joinedAt")
           VALUES ($1,$2,$3,'MEMBER',NOW())
           ON CONFLICT ("channelId", "userId") DO NOTHING`,
          [newId(), channelId, target],
        );
        return jsonOk(await listMembersDto(client, channelId, userId));
      }
      if ((method === 'DELETE' || method === 'PATCH') && path.length === 3) {
        const targetUserId = path[2];
        if (method === 'DELETE') {
          if (targetUserId === userId) {
            const member = await requireMember(client, channelId, userId);
            if (member.role === 'ADMIN') {
              const admins = await client.query(
                `SELECT COUNT(*)::int AS n FROM "ChannelMember" WHERE "channelId" = $1 AND role = 'ADMIN'`,
                [channelId],
              );
              if ((admins.rows[0] as { n: number }).n <= 1) {
                const other = await client.query<{ id: string }>(
                  `SELECT id FROM "ChannelMember" WHERE "channelId" = $1 AND "userId" <> $2
                   ORDER BY "joinedAt" ASC LIMIT 1`,
                  [channelId, userId],
                );
                if (other.rows[0]) {
                  await client.query(`UPDATE "ChannelMember" SET role = 'ADMIN' WHERE id = $1`, [
                    other.rows[0].id,
                  ]);
                } else {
                  await client.query(`UPDATE "ChatChannel" SET "archivedAt" = NOW() WHERE id = $1`, [
                    channelId,
                  ]);
                }
              }
            }
            await client.query(
              `DELETE FROM "ChannelMember" WHERE "channelId" = $1 AND "userId" = $2`,
              [channelId, userId],
            );
            return jsonOk({ left: true });
          }
          const actor = await requireStaff(client, channelId, userId);
          const target = await client.query<{ role: string }>(
            `SELECT role::text AS role FROM "ChannelMember" WHERE "channelId" = $1 AND "userId" = $2`,
            [channelId, targetUserId],
          );
          if (!target.rows[0]) throw httpError('Member not found', 404, 'NOT_FOUND');
          if (target.rows[0].role === 'ADMIN' && actor.role !== 'ADMIN') {
            throw httpError('Moderators cannot remove admins', 403, 'FORBIDDEN');
          }
          await client.query(
            `DELETE FROM "ChannelMember" WHERE "channelId" = $1 AND "userId" = $2`,
            [channelId, targetUserId],
          );
          return jsonOk(await listMembersDto(client, channelId, userId));
        }
        await requireAdmin(client, channelId, userId);
        const body = (await req.json()) as { role?: string };
        const role = body.role;
        if (!role || !['ADMIN', 'MODERATOR', 'MEMBER'].includes(role)) {
          throw httpError('Invalid role', 400, 'VALIDATION_ERROR');
        }
        const target = await client.query(
          `SELECT id FROM "ChannelMember" WHERE "channelId" = $1 AND "userId" = $2`,
          [channelId, targetUserId],
        );
        if (!target.rows[0]) throw httpError('Member not found', 404, 'NOT_FOUND');
        await client.query(
          `UPDATE "ChannelMember" SET role = $1::"ChannelMemberRole"
           WHERE "channelId" = $2 AND "userId" = $3`,
          [role, channelId, targetUserId],
        );
        return jsonOk(await listMembersDto(client, channelId, userId));
      }
    }

    if (path[1] === 'messages') {
      if (method === 'GET' && path.length === 2) {
        await requireMember(client, channelId, userId);
        const after = new URL(req.url).searchParams.get('after');
        if (after) {
          const res = await client.query<{
            id: string;
            channelId: string;
            senderId: string;
            senderName: string;
            body: string;
            createdAt: Date;
          }>(
            `SELECT m.id, m."channelId", m."senderId", u.name AS "senderName", m.body, m."createdAt"
             FROM "ChannelMessage" m
             JOIN "User" u ON u.id = m."senderId"
             WHERE m."channelId" = $1 AND m."deletedAt" IS NULL AND m."createdAt" > $2
             ORDER BY m."createdAt" ASC LIMIT 100`,
            [channelId, new Date(after)],
          );
          return jsonOk(res.rows.map((m) => ({ ...m, mine: m.senderId === userId })));
        }
        const res = await client.query<{
          id: string;
          channelId: string;
          senderId: string;
          senderName: string;
          body: string;
          createdAt: Date;
        }>(
          `SELECT m.id, m."channelId", m."senderId", u.name AS "senderName", m.body, m."createdAt"
           FROM "ChannelMessage" m
           JOIN "User" u ON u.id = m."senderId"
           WHERE m."channelId" = $1 AND m."deletedAt" IS NULL
           ORDER BY m."createdAt" DESC LIMIT 100`,
          [channelId],
        );
        return jsonOk(res.rows.reverse().map((m) => ({ ...m, mine: m.senderId === userId })));
      }

      if (method === 'POST' && path.length === 2) {
        const member = await requireMember(client, channelId, userId);
        if (member.mutedUntil && member.mutedUntil > new Date()) {
          throw httpError('You are muted in this channel', 403, 'MUTED');
        }
        const body = (await req.json()) as { body?: string };
        const text = String(body.body ?? '').trim();
        if (!text) throw httpError('Message cannot be empty', 400, 'BAD_REQUEST');
        if (text.length > 2000) {
          throw httpError('Message must be at most 2000 characters', 400, 'VALIDATION_ERROR');
        }
        const id = newId();
        const nameRes = await client.query<{ name: string }>(`SELECT name FROM "User" WHERE id = $1`, [
          userId,
        ]);
        await client.query(
          `INSERT INTO "ChannelMessage" (id, "channelId", "senderId", body, "createdAt")
           VALUES ($1,$2,$3,$4,NOW())`,
          [id, channelId, userId, text],
        );
        await client.query(`UPDATE "ChatChannel" SET "updatedAt" = NOW() WHERE id = $1`, [channelId]);
        return jsonOk(
          {
            id,
            channelId,
            senderId: userId,
            senderName: nameRes.rows[0]?.name || 'Player',
            body: text,
            createdAt: new Date(),
            mine: true,
          },
          201,
        );
      }

      if (method === 'DELETE' && path.length === 3) {
        const messageId = path[2];
        const member = await requireMember(client, channelId, userId);
        const msg = await client.query<{ senderId: string }>(
          `SELECT "senderId" FROM "ChannelMessage"
           WHERE id = $1 AND "channelId" = $2 AND "deletedAt" IS NULL`,
          [messageId, channelId],
        );
        if (!msg.rows[0]) throw httpError('Message not found', 404, 'NOT_FOUND');
        const canMod = member.role === 'ADMIN' || member.role === 'MODERATOR';
        if (msg.rows[0].senderId !== userId && !canMod) {
          throw httpError('You can only delete your own messages', 403, 'FORBIDDEN');
        }
        await client.query(`UPDATE "ChannelMessage" SET "deletedAt" = NOW() WHERE id = $1`, [
          messageId,
        ]);
        return jsonOk({ deleted: true });
      }
    }

    throw httpError('Resource not found', 404, 'NOT_FOUND');
  });
}

export async function runChannels(req: Request, path: string[]) {
  try {
    return await dispatchChannels(req, path);
  } catch (err) {
    return jsonErr(err);
  }
}
