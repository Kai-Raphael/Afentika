import { beforeEach, describe, expect, it } from 'vitest';
import * as admin from '../../functions/api/lustrum/admin.js';
import * as answer from '../../functions/api/lustrum/answer.js';
import * as me from '../../functions/api/lustrum/me.js';
import * as question from '../../functions/api/lustrum/question.js';
import * as scoreboard from '../../functions/api/lustrum/scoreboard.js';
import * as vote from '../../functions/api/lustrum/vote.js';
import { createTestDb, seedPlayer, seedQuestion } from './d1.js';

const SLUG = 'a'.repeat(24);
const ADMIN_PASSWORD = 'geheim-wachtwoord';

let env;
let ids;

beforeEach(() => {
  const db = createTestDb();
  env = { AFENTIKA_DB: db, LUSTRUM_ADMIN_PASSWORD: ADMIN_PASSWORD };
  ids = {
    kai: seedPlayer(db, { name: 'Kai', code: 'KAIKAI' }),
    liam: seedPlayer(db, { name: 'Liam', code: 'LIAMLI' }),
    duco: seedPlayer(db, { name: 'Duco', code: 'DUCODU', alive: 0 }),
    question: seedQuestion(db, { slug: SLUG, answers: ['handdoek'], points: 3 }),
  };
});

async function call(handler, { token, body, ip = '1.2.3.4' } = {}) {
  const headers = { 'CF-Connecting-IP': ip };
  if (token) headers.Authorization = `Bearer ${token}`;
  const request = new Request('https://afentika.nl/api', {
    method: body ? 'POST' : 'GET',
    headers,
    body: body && JSON.stringify(body),
  });
  const response = await handler({ request, env });
  return { status: response.status, data: await response.json() };
}

const asAdmin = (body) => call(body ? admin.onRequestPost : admin.onRequestGet, { token: ADMIN_PASSWORD, body });

describe('player login', () => {
  it('returns the overview for a valid code, case insensitive', async () => {
    const { status, data } = await call(me.onRequestGet, { token: 'kaikai' });
    expect(status).toBe(200);
    expect(data.player.name).toBe('Kai');
    expect(data.points).toBe(0);
    expect(data.round).toBeNull();
  });

  it('rejects unknown codes and throttles after too many failures', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await call(me.onRequestGet, { token: 'NOPE' })).status).toBe(401);
    }
    expect((await call(me.onRequestGet, { token: 'KAIKAI' })).status).toBe(429);
    expect((await call(me.onRequestGet, { token: 'KAIKAI', ip: '5.6.7.8' })).status).toBe(200);
  });
});

describe('questions', () => {
  it('requires the correct pin and does not reveal whether the slug exists', async () => {
    const wrongPin = await call(question.onRequestPost, { token: 'KAIKAI', body: { slug: SLUG, pin: '0000' } });
    const wrongSlug = await call(question.onRequestPost, { token: 'KAIKAI', body: { slug: 'b'.repeat(24), pin: '1234' } });
    expect(wrongPin).toEqual(wrongSlug);
    expect(wrongPin.status).toBe(404);

    const { status, data } = await call(question.onRequestPost, { token: 'KAIKAI', body: { slug: SLUG, pin: '1234' } });
    expect(status).toBe(200);
    expect(data).toMatchObject({ body: 'Vraagtekst', points: 3, solved: false, attemptsLeft: 3 });
    expect(data).not.toHaveProperty('answers');
  });

  it('awards points once for a correct answer', async () => {
    const body = { slug: SLUG, pin: '1234', answer: 'De handdoek' };
    expect((await call(answer.onRequestPost, { token: 'KAIKAI', body })).data).toMatchObject({ correct: true, solved: true });
    expect((await call(answer.onRequestPost, { token: 'KAIKAI', body })).data).toMatchObject({ correct: true, solved: true });

    const { data } = await call(me.onRequestGet, { token: 'KAIKAI' });
    expect(data.points).toBe(3);
    expect(data.solved).toEqual([{ number: 1, title: 'Titel' }]);
  });

  it('limits the number of attempts', async () => {
    const body = { slug: SLUG, pin: '1234', answer: 'fiets' };
    for (const left of [2, 1, 0]) {
      expect((await call(answer.onRequestPost, { token: 'KAIKAI', body })).data).toEqual({
        correct: false,
        solved: false,
        attemptsLeft: left,
      });
    }
    const blocked = await call(answer.onRequestPost, { token: 'KAIKAI', body: { ...body, answer: 'handdoek' } });
    expect(blocked.status).toBe(409);
  });

  it('does not let eliminated players score', async () => {
    const { status } = await call(answer.onRequestPost, {
      token: 'DUCODU',
      body: { slug: SLUG, pin: '1234', answer: 'handdoek' },
    });
    expect(status).toBe(403);
  });
});

describe('voting', () => {
  it('rejects votes when no round is open', async () => {
    expect((await call(vote.onRequestPost, { token: 'KAIKAI', body: { targetId: ids.liam } })).status).toBe(409);
  });

  it('lets alive players vote on other alive players and change their vote', async () => {
    await asAdmin({ action: 'openRound', label: 'Vrijdag 22:00' });

    const overview = await call(me.onRequestGet, { token: 'KAIKAI' });
    expect(overview.data.round.candidates.map((c) => c.name)).toEqual(['Liam']);

    expect((await call(vote.onRequestPost, { token: 'KAIKAI', body: { targetId: ids.kai } })).status).toBe(400);
    expect((await call(vote.onRequestPost, { token: 'KAIKAI', body: { targetId: ids.duco } })).status).toBe(400);
    expect((await call(vote.onRequestPost, { token: 'DUCODU', body: { targetId: ids.kai } })).status).toBe(403);

    expect((await call(vote.onRequestPost, { token: 'KAIKAI', body: { targetId: ids.liam } })).data.votedFor).toBe(ids.liam);
    await call(vote.onRequestPost, { token: 'LIAMLI', body: { targetId: ids.kai } });

    const { data } = await asAdmin();
    expect(data.openRound.tally).toEqual([
      { id: ids.kai, name: 'Kai', votes: 1 },
      { id: ids.liam, name: 'Liam', votes: 1 },
    ]);
    expect(data.openRound.notVoted).toEqual([]);

    const closed = await asAdmin({ action: 'closeRound' });
    expect(closed.data.openRound).toBeNull();
    expect(closed.data.lastClosedRound.votes).toHaveLength(2);
  });
});

describe('admin', () => {
  it('requires the admin password', async () => {
    expect((await call(admin.onRequestGet, { token: 'fout' })).status).toBe(401);
  });

  it('awards bonus points and eliminates players', async () => {
    await asAdmin({ action: 'award', playerId: ids.liam, amount: 5, reason: 'Geheime opdracht' });
    const { data } = await asAdmin({ action: 'setAlive', playerId: ids.kai, alive: false });

    expect(data.players.find((p) => p.name === 'Liam').points).toBe(5);
    expect(data.players.find((p) => p.name === 'Kai').alive).toBe(false);
    expect(data.ledger[0]).toMatchObject({ name: 'Liam', amount: 5, reason: 'Geheime opdracht' });

    const board = await call(scoreboard.onRequestGet);
    expect(board.data.players[0]).toEqual({ name: 'Liam', alive: true, points: 5 });
  });

  it('rejects invalid actions', async () => {
    expect((await asAdmin({ action: 'constructor' })).status).toBe(400);
    expect((await asAdmin({ action: 'award', playerId: ids.liam, amount: 1.5, reason: 'x' })).status).toBe(400);
    expect((await asAdmin({ action: 'closeRound' })).status).toBe(409);
  });
});
