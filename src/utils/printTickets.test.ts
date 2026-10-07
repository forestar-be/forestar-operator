import {
  PRINT_GENERIC_FAILURE_MESSAGE,
  PRINT_SUCCESS_MESSAGE,
  PRINT_UNREACHABLE_MESSAGE,
  interpretPrintResponse,
  requestCounterPrint,
} from './printTickets';

const reponse = (status: number, body?: unknown) => ({
  status,
  json: async () => {
    if (body === undefined) throw new Error('pas de corps');
    return body;
  },
});

const message = (outcome: Awaited<ReturnType<typeof requestCounterPrint>>) =>
  outcome.kind === 'error' ? outcome.message : outcome.kind;

describe('requestCounterPrint', () => {
  it('200 : succès', async () => {
    const outcome = await requestCounterPrint(async () =>
      reponse(200, { printed: true, jobId: 'j', durationMs: 5 }),
    );
    expect(outcome).toEqual({ kind: 'success' });
    expect(PRINT_SUCCESS_MESSAGE).toBe(
      "Tickets envoyés à l'imprimante du comptoir",
    );
  });

  it('503 print_relay_unreachable et print_relay_not_configured : le PC ne répond pas', async () => {
    for (const code of [
      'print_relay_unreachable',
      'print_relay_not_configured',
    ]) {
      const outcome = await requestCounterPrint(async () =>
        reponse(503, { code }),
      );
      expect(message(outcome)).toBe(
        "Le PC du comptoir ne répond pas. Réessayez, ou imprimez depuis l'atelier.",
      );
    }
    expect(PRINT_UNREACHABLE_MESSAGE).toContain(
      'Le PC du comptoir ne répond pas',
    );
  });

  it('503 sans corps JSON (passerelle) : le PC ne répond pas', async () => {
    const outcome = await requestCounterPrint(async () => reponse(503));
    expect(message(outcome)).toBe(PRINT_UNREACHABLE_MESSAGE);
  });

  it('erreur réseau : le PC ne répond pas', async () => {
    const outcome = await requestCounterPrint(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(message(outcome)).toBe(PRINT_UNREACHABLE_MESSAGE);
  });

  it("502 : refus de l'imprimante avec le détail", async () => {
    const outcome = await requestCounterPrint(async () =>
      reponse(502, { code: 'print_failed', detail: 'imprimante hors ligne' }),
    );
    expect(message(outcome)).toBe(
      "L'imprimante du comptoir a refusé l'impression : imprimante hors ligne",
    );
  });

  it('502 sans détail : pas de « : » orphelin', async () => {
    const outcome = await requestCounterPrint(async () => reponse(502));
    expect(message(outcome)).toBe(
      "L'imprimante du comptoir a refusé l'impression",
    );
  });

  it('429, 422, 503 paused, 409', async () => {
    expect(
      message(
        await requestCounterPrint(async () =>
          reponse(429, { code: 'rate_limited' }),
        ),
      ),
    ).toBe("Trop d'impressions demandées, réessayez dans une minute");
    expect(
      message(
        await requestCounterPrint(async () =>
          reponse(422, { code: 'too_many_pages', pages: 6 }),
        ),
      ),
    ).toBe("Ticket trop long pour l'imprimante");
    expect(
      message(
        await requestCounterPrint(async () => reponse(503, { code: 'paused' })),
      ),
    ).toBe('Impression au comptoir suspendue');
    expect(
      message(
        await requestCounterPrint(async () =>
          reponse(409, { code: 'print_in_progress' }),
        ),
      ),
    ).toBe('Impression déjà en cours pour cette fiche');
  });

  it('401 et 403 : déconnexion, comme avant', async () => {
    expect(await requestCounterPrint(async () => reponse(401))).toEqual({
      kind: 'logout',
    });
    expect(await requestCounterPrint(async () => reponse(403, {}))).toEqual({
      kind: 'logout',
    });
  });

  it('404 et 500 : message générique', async () => {
    expect(
      message(
        await requestCounterPrint(async () =>
          reponse(404, { message: 'Réparation non trouvée.' }),
        ),
      ),
    ).toBe(PRINT_GENERIC_FAILURE_MESSAGE);
    expect(message(await requestCounterPrint(async () => reponse(500)))).toBe(
      PRINT_GENERIC_FAILURE_MESSAGE,
    );
  });
});

describe('interpretPrintResponse', () => {
  it('ignore un détail non textuel', () => {
    expect(
      interpretPrintResponse({ status: 502, body: { detail: { x: 1 } } }),
    ).toEqual({
      kind: 'error',
      message: "L'imprimante du comptoir a refusé l'impression",
    });
  });
});
