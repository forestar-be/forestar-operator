/**
 * Impression au comptoir (R002-S03) — correspondance entre la réponse de
 * `POST /operator/machine-repairs/:id/ticket/print` et le message affiché.
 *
 * La logique est ici, hors du composant, pour être testée sans navigateur :
 * le composant n'a qu'à afficher le résultat. Le serveur ne renvoie jamais 401
 * pour un refus du relais : un 401/403 est donc bien une session perdue, que le
 * composant traite par `logOut`.
 */

export const PRINT_SUCCESS_MESSAGE =
  "Tickets envoyés à l'imprimante du comptoir";

export const PRINT_UNREACHABLE_MESSAGE =
  "Le PC du comptoir ne répond pas. Réessayez, ou imprimez depuis l'atelier.";

export const PRINT_GENERIC_FAILURE_MESSAGE =
  "Impossible d'imprimer les tickets. Réessayez, ou imprimez depuis l'atelier.";

export type PrintOutcome =
  | { kind: 'success' }
  | { kind: 'logout' }
  | { kind: 'error'; message: string };

/** Ce que l'on lit d'une réponse : le statut et son corps JSON déjà décodé (ou `null`). */
export interface PrintResponseLike {
  status: number;
  body: { code?: unknown; detail?: unknown } | null;
}

export function interpretPrintResponse({
  status,
  body,
}: PrintResponseLike): PrintOutcome {
  if (status === 200) return { kind: 'success' };
  if (status === 401 || status === 403) return { kind: 'logout' };

  const code = typeof body?.code === 'string' ? body.code : undefined;
  const error = (message: string): PrintOutcome => ({ kind: 'error', message });

  switch (status) {
    case 409:
      return error('Impression déjà en cours pour cette fiche');
    case 422:
      return error("Ticket trop long pour l'imprimante");
    case 429:
      return error("Trop d'impressions demandées, réessayez dans une minute");
    case 502: {
      const detail =
        typeof body?.detail === 'string' && body.detail.trim() !== ''
          ? body.detail.trim()
          : null;
      return error(
        detail
          ? `L'imprimante du comptoir a refusé l'impression : ${detail}`
          : "L'imprimante du comptoir a refusé l'impression",
      );
    }
    case 503:
      if (code === 'paused') return error('Impression au comptoir suspendue');
      // print_relay_unreachable, print_relay_not_configured, ou un 503 de passage.
      return error(PRINT_UNREACHABLE_MESSAGE);
    default:
      return error(PRINT_GENERIC_FAILURE_MESSAGE);
  }
}

/**
 * Appelle la route d'impression et traduit le résultat. Une erreur réseau (API
 * injoignable, coupure de la tablette) donne le message « le PC ne répond pas » :
 * l'utilisateur a la même issue, réessayer ou passer par l'atelier.
 */
export async function requestCounterPrint(
  send: () => Promise<{ status: number; json: () => Promise<unknown> }>,
): Promise<PrintOutcome> {
  let response: { status: number; json: () => Promise<unknown> };
  try {
    response = await send();
  } catch {
    return { kind: 'error', message: PRINT_UNREACHABLE_MESSAGE };
  }
  let body: PrintResponseLike['body'] = null;
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === 'object') {
      body = parsed as PrintResponseLike['body'];
    }
  } catch {
    // Corps absent ou non JSON : le statut suffit.
  }
  return interpretPrintResponse({ status: response.status, body });
}
