import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/AuthProvider';
import { ALLOWED_ROLES } from '../hooks/session';

/**
 * Garde des routes internes.
 *
 * En mode historique, l'absence de jeton renvoie vers `/login`. En mode SSO il
 * n'y a plus de formulaire local : l'absence de session part directement vers
 * `/auth/login`, une seule fois. Une session valide sans rôle admis n'y est pas
 * renvoyée — s'y reconnecter ne changerait rien et bouclerait.
 */
const AuthRoute = () => {
  const auth = useAuth();
  const redirected = useRef(false);

  useEffect(() => {
    if (!auth.ssoEnabled) return;
    if (auth.isLoading || auth.isAuthenticated || redirected.current) return;
    redirected.current = true;
    void auth.loginAction({});
  }, [auth]);

  if (!auth.ssoEnabled) {
    if (!auth.token) return <Navigate to="/login" />;
    return <Outlet />;
  }

  if (auth.isLoading || !auth.isAuthenticated) {
    return <p>Redirection vers l&apos;authentification Forestar…</p>;
  }

  if (!auth.hasRole(...ALLOWED_ROLES)) {
    return (
      <div>
        <p>
          <strong>Accès non autorisé.</strong> Votre compte est bien
          authentifié, mais il ne porte pas les droits nécessaires à Forestar
          Opérateur.
        </p>
        <button type="button" onClick={auth.logOut}>
          Se déconnecter
        </button>
      </div>
    );
  }

  return <Outlet />;
};

export default AuthRoute;
