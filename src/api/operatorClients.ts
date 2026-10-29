/**
 * R008-S01 — Appels d'API du bloc Client de la tablette opérateur : recherche
 * d'un client existant, contrôle des doublons avant création (R007-S05), et
 * décodage propre du `409 client_conflict` (R007-AC-02), qu'il vienne du
 * contrôle ou de l'envoi lui-même (AC-05).
 */
import { authorizedFetch } from '../hooks/session';

/** Ids des champs du client dans la config `Formulaire Opérateur` (D-19). */
export const CLIENT_FIELD_IDS = [
  'last_name',
  'first_name',
  'address',
  'postal_code',
  'city',
  'phone',
  'email',
] as const;
export type ClientFieldId = (typeof CLIENT_FIELD_IDS)[number];
export const CLIENT_FIELD_ID_SET: ReadonlySet<string> = new Set(
  CLIENT_FIELD_IDS,
);

/** Coordonnées du client telles que le serveur les renvoie (R007, `CLIENT_SELECT`). */
export interface PublicClient {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  origin?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Résultat de `GET /operator/clients/search` : le client et ses passages. */
export interface ClientSearchResult extends PublicClient {
  repairCount: number;
  lastEntryDate: string | null;
}

export type ClientConflictField = 'phone' | 'email';

export interface ClientConflict {
  field: ClientConflictField;
  client: PublicClient;
}

/**
 * État de la fenêtre de conflit (AC-04) : le champ et le client à afficher en
 * premier, avec tous les conflits renvoyés (téléphone et email peuvent
 * chacun désigner un client).
 */
export interface ClientConflictState extends ClientConflict {
  conflicts: ClientConflict[];
}

/** Réponse de `POST /operator/clients/check` (toujours 200). */
export interface ClientCheckResult {
  conflicts: ClientConflict[];
  similar: ClientSearchResult[];
}

/** Coordonnées saisies pour un nouveau client, sous les ids du formulaire. */
export type ClientFormInput = Partial<Record<ClientFieldId, string>>;

/** Session expirée ou refusée : l'appelant déclenche `auth.logOut()`. */
export class UnauthorizedError extends Error {
  constructor() {
    super('Session expirée ou refusée.');
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/** A received HTTP refusal can be distinguished from a lost response. */
export class OperatorHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, OperatorHttpError.prototype);
  }
}

/**
 * `409 client_conflict` décodé, avec le champ en cause et le client existant
 * (voir `sendAtelierError` côté serveur). Remplace l'ancien `alert` générique.
 */
export class ClientConflictApiError extends Error {
  constructor(
    readonly field: ClientConflictField,
    readonly client: PublicClient,
    readonly conflicts: ClientConflict[],
  ) {
    super(
      field === 'phone'
        ? 'Un client a déjà ce téléphone.'
        : 'Un client a déjà cet email.',
    );
    this.name = 'ClientConflictApiError';
    Object.setPrototypeOf(this, ClientConflictApiError.prototype);
  }
}

export type StorageSize = 'STANDARD' | 'LARGE';

export interface SubmittedRepair {
  id: number;
  storageDepositedAt?: string | null;
  storageSize?: StorageSize;
  /** Code de la ou des places, produit par le serveur (`R1/2/A` ou `R1/2/A-B`). */
  storageCode?: string | null;
  storageSlot?: {
    id: number;
    level: number;
    position: string;
    rack: { id: number; number: number };
  } | null;
  storageSecondSlot?: { id: number; position: string } | null;
}

/** Le code serveur fait foi ; le repli sert à une réponse d'un ancien serveur. */
export function submittedStorageCode(repair: SubmittedRepair): string | null {
  if (repair.storageCode) return repair.storageCode;
  const slot = repair.storageSlot;
  if (!slot) return null;
  const code = `R${slot.rack.number}/${slot.level}/${slot.position}`;
  return repair.storageSecondSlot
    ? `${code}-${repair.storageSecondSlot.position}`
    : code;
}

export class StorageApiError extends Error {
  constructor(
    readonly code: 'storage_full_confirmation_required' | 'storage_full',
    message: string,
  ) {
    super(message);
    this.name = 'StorageApiError';
    Object.setPrototypeOf(this, StorageApiError.prototype);
  }
}

/**
 * Décode une réponse des routes clients de l'opérateur : redirige vers la
 * déconnexion sur 401/403, lève `ClientConflictApiError` sur un
 * `409 client_conflict`, sinon une erreur générique, sinon le JSON attendu.
 */
async function parseAtelierResponse<T>(
  response: Response,
  onUnauthorized: () => void,
): Promise<T> {
  if (response.status === 401 || response.status === 403) {
    onUnauthorized();
    throw new UnauthorizedError();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 409 && body?.code === 'client_conflict') {
      throw new ClientConflictApiError(
        body.field,
        body.client,
        body.conflicts ?? [],
      );
    }
    if (
      response.status === 409 &&
      ['storage_full_confirmation_required', 'storage_full'].includes(
        body?.code,
      )
    ) {
      throw new StorageApiError(
        body.code,
        body.message || 'Tous les emplacements sont occupés.',
      );
    }
    throw new OperatorHttpError(
      response.status,
      body?.message || `Réponse HTTP ${response.status}`,
    );
  }
  return response.json();
}

/**
 * R007-AC-04 / R008-AC-02 — recherche d'un client existant. Le serveur exige
 * 2 caractères au moins et renvoie 20 résultats au plus.
 */
export async function searchOperatorClients(
  apiUrl: string,
  token: string,
  query: string,
  onUnauthorized: () => void,
): Promise<ClientSearchResult[]> {
  const response = await authorizedFetch(
    token,
    `${apiUrl}/operator/clients/search?q=${encodeURIComponent(query)}`,
  );
  return parseAtelierResponse<ClientSearchResult[]>(response, onUnauthorized);
}

/**
 * R007-AC-03 / R008-AC-04 — contrôle des doublons avant la création d'un
 * nouveau client : `conflicts` bloque, `similar` suggère seulement.
 */
export async function checkOperatorClient(
  apiUrl: string,
  token: string,
  input: ClientFormInput,
  onUnauthorized: () => void,
): Promise<ClientCheckResult> {
  const response = await authorizedFetch(
    token,
    `${apiUrl}/operator/clients/check`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return parseAtelierResponse<ClientCheckResult>(response, onUnauthorized);
}

/**
 * R008 — modification du client choisi, depuis la tablette (décision du PO du
 * 2026-09-25 : remplace D-22, l'opérateur voit et peut corriger les
 * coordonnées du client, pas seulement les consulter). Même décodage de
 * conflit que `checkOperatorClient` (409 client_conflict).
 */
export async function updateOperatorClient(
  apiUrl: string,
  token: string,
  id: number,
  input: ClientFormInput,
  onUnauthorized: () => void,
): Promise<PublicClient> {
  const response = await authorizedFetch(
    token,
    `${apiUrl}/operator/clients/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return parseAtelierResponse<PublicClient>(response, onUnauthorized);
}

/**
 * R008-AC-05 — envoi de `POST /operator/submit`, avec décodage du
 * `409 client_conflict` que le serveur peut encore renvoyer entre le contrôle
 * et l'envoi.
 */
export async function submitOperatorForm(
  apiUrl: string,
  token: string,
  formData: FormData,
  onUnauthorized: () => void,
): Promise<{ message: string; newRepair: SubmittedRepair }> {
  const response = await authorizedFetch(token, `${apiUrl}/operator/submit`, {
    method: 'POST',
    body: formData,
  });
  return parseAtelierResponse<{ message: string; newRepair: SubmittedRepair }>(
    response,
    onUnauthorized,
  );
}
