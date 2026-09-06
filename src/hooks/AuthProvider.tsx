import { useContext, createContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AuthProvider as SsoSessionProvider,
  useAuth as useSsoSession,
  type ForestarRole,
} from '@forestar-be/core';
import {
  API_URL as SSO_API_URL,
  getSessionClient,
  SSO_ENABLED,
  SSO_SESSION_TOKEN,
} from './session';

interface AuthContextValue {
  /** Toujours vide en mode SSO : aucun jeton n'atteint le navigateur. */
  token: string;
  expiresAt: string;
  loginAction: (data: any) => Promise<{ success: boolean; message: string }>;
  logOut: () => void;
  /** Vrai tant que la première lecture de session n'a pas abouti (SSO). */
  isLoading: boolean;
  isAuthenticated: boolean;
  roles: readonly ForestarRole[];
  hasRole: (...roles: ForestarRole[]) => boolean;
  /** Permet aux écrans de savoir quel chemin est actif, sans relire l'env. */
  ssoEnabled: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  token: '',
  expiresAt: '',
  loginAction: async (
    data: any,
  ): Promise<{ success: boolean; message: string }> => {
    return { success: false, message: 'Impossible de vous authentifier' };
  },
  logOut: () => {},
  isLoading: false,
  isAuthenticated: false,
  roles: [],
  hasRole: () => false,
  ssoEnabled: false,
});
const API_URL = process.env.REACT_APP_API_URL;

const getTokenFromLocalStorage = () => {
  const token = localStorage.getItem('token');
  const expiresAt = localStorage.getItem('expires_at');

  if (token && expiresAt) {
    if (new Date().getTime() < Number(expiresAt)) {
      return token;
    }
  }
  localStorage.removeItem('token');
  localStorage.removeItem('expires_at');
  return '';
};

const LegacyAuthProvider = ({ children }: any) => {
  const [token, setToken] = useState(getTokenFromLocalStorage());
  const [expiresAt, setExpiresAt] = useState(
    localStorage.getItem('expires_at') || '',
  );

  const navigate = useNavigate();
  const loginAction = async (
    data: any,
  ): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_URL}/operator/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const res = await response.json();
          if (res.message) {
            return { success: false, message: res.message };
          }
        } else {
          const res = await response.text();
          if (res) {
            return { success: false, message: res };
          }
        }
      } catch (error) {
        console.log(error);
      }

      return {
        success: false,
        message:
          'Impossible de vous authentifier, veuillez réessayer plus tard',
      };
    }

    const res = await response.json();
    if (res.authentificated) {
      setExpiresAt(res.expiresAt);
      setToken(res.token);
      localStorage.setItem('token', String(res.token));
      localStorage.setItem('expires_at', String(res.expiresAt));
      navigate('/');
      return { success: true, message: 'Vous êtes connecté' };
    }
    return {
      success: false,
      message:
        "Impossible de vous authentifier, vérifiez vos informations d'identification et réessayez",
    };
  };

  const logOut = () => {
    console.log('logout');
    setExpiresAt('');
    setToken('');
    localStorage.removeItem('token');
    localStorage.removeItem('expires_at');
    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        expiresAt,
        loginAction,
        logOut,
        isLoading: false,
        isAuthenticated: Boolean(token),
        roles: [],
        // Le chemin historique n'a pas de rôles : cette application n'en admet
        // qu'un, et le serveur l'a déjà vérifié à la connexion.
        hasRole: () => Boolean(token),
        ssoEnabled: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Traduit la session SSO dans le contrat historique consommé par les écrans.
 * Aucun composant lisant `auth.token` n'a été réécrit : en mode SSO la valeur
 * est une sentinelle non vide, donc `authorizedFetch` n'émet pas d'en-tête `Authorization` et
 * s'authentifie par le cookie.
 */
const SsoAuthBridge = ({ children }: any) => {
  const session = useSsoSession();

  return (
    <AuthContext.Provider
      value={{
        // Sentinelle, pas un jeton : voir `SSO_SESSION_TOKEN`. Une chaîne vide
        // rendait faux les tests `if (!token)` du code hérité.
        token: SSO_SESSION_TOKEN,
        expiresAt: session.expiresAt ?? '',
        loginAction: async () => {
          session.login();
          return {
            success: true,
            message: "Redirection vers l'authentification Forestar",
          };
        },
        logOut: () => {
          void session.logout();
        },
        isLoading: session.isLoading,
        isAuthenticated: session.isAuthenticated,
        roles: session.roles,
        hasRole: session.hasRole,
        ssoEnabled: true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Le chemin est choisi au chargement du module, jamais au rendu : un `if` dans
 * le corps d'un composant ferait varier les hooks appelés d'un rendu à l'autre.
 */
const AuthProvider = ({ children }: any) => {
  if (!SSO_ENABLED) return <LegacyAuthProvider>{children}</LegacyAuthProvider>;
  return (
    <SsoSessionProvider client={getSessionClient()} baseUrl={SSO_API_URL}>
      <SsoAuthBridge>{children}</SsoAuthBridge>
    </SsoSessionProvider>
  );
};

export default AuthProvider;

export const useAuth = () => {
  return useContext(AuthContext);
};
