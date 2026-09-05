/**
 * R015 — Mode d'authentification, client de session partagé et transport HTTP.
 *
 * L'application embarque les deux chemins et n'en active qu'un, décidé par
 * `REACT_APP_AUTH_MODE`. C-06 impose que l'ancien login reste le seul visible
 * jusqu'à la fenêtre de bascule globale, et C-12 que chaque application soit
 * prête sans être activée : bascule et rollback sont un changement de variable,
 * pas un redéploiement de code différent.
 *
 * Les imports viennent de l'entrée racine de `@forestar-be/core`, jamais de son
 * sous-chemin `/auth` : celui-ci dépend de `next/navigation`, et ce bundle
 * react-scripts ne doit embarquer ni Next ni une seconde copie de React
 * (AC-01).
 */

import { createSessionClient, type SessionClient } from '@forestar-be/core';

export const API_URL = process.env.REACT_APP_API_URL ?? '';

/** Vrai quand l'application doit utiliser le SSO plutôt que l'ancien login. */
export const SSO_ENABLED = process.env.REACT_APP_AUTH_MODE === 'oidc';

/**
 * Rôles admis. Le serveur reste l'autorité — la matrice R005 protège
 * `/operator` — mais refuser ici évite d'afficher une interface complète à
 * quelqu'un dont chaque appel repartira en 403.
 */
export const ALLOWED_ROLES = ['forestar.operator', 'forestar.admin'] as const;

/** Méthodes sans effet de bord : elles ne portent pas de jeton CSRF. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

let client: SessionClient | null = null;

/**
 * `currentUrl` est fourni explicitement : le défaut de
 * `@forestar-be/core@0.2.0` est un chemin nu, et la redirection finale est
 * exécutée par `/auth/callback`, servi par l'API. Sans l'origine, l'utilisateur
 * atterrirait sur l'API. Correctif porté sur la branche
 * `fix/sso-r011-absolute-return-to` de forestar-frontend.
 */
export function getSessionClient(): SessionClient {
  if (!client) {
    client = createSessionClient({
      baseUrl: API_URL,
      currentUrl: () =>
        typeof window === 'undefined' ? '/' : window.location.href,
    });
  }
  return client;
}

/**
 * Appel authentifié, quel que soit le mode.
 *
 * En mode historique, l'en-tête `Authorization` porte le jeton, comme avant.
 * En mode SSO, `token` est vide : l'en-tête disparaît, le cookie `__Host-`
 * part avec la requête et les mutations portent le jeton CSRF.
 */
export function authorizedFetch(
  token: string,
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  if (SSO_ENABLED && !SAFE_METHODS.has(method.toUpperCase())) {
    const csrf = getSessionClient().getState().csrfToken;
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  return fetch(input, {
    ...init,
    headers,
    // Sans `credentials`, le navigateur n'envoie pas le cookie à une API d'une
    // autre origine, et toute requête revient 401.
    ...(SSO_ENABLED ? { credentials: 'include' as RequestCredentials } : {}),
  });
}
