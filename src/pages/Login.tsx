import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/AuthProvider';
import {
  TextField,
  Button,
  Container,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

/**
 * En mode SSO, cette page n'affiche plus de formulaire : les identifiants sont
 * saisis chez Zitadel. La route reste valide — d'anciens liens et favoris y
 * mènent — et repart aussitôt vers l'IdP.
 */
const SsoLoginRedirect = (): JSX.Element => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, loginAction } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      navigate('/');
      return;
    }
    if (started.current) return;
    started.current = true;
    void loginAction({});
  }, [isAuthenticated, isLoading, loginAction, navigate]);

  return <p>Redirection vers l&apos;authentification Forestar…</p>;
};

const Login = (): JSX.Element => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { token, loginAction, ssoEnabled } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      navigate('/');
    }
  }, [token, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username !== '' && password !== '') {
      setLoading(true);
      try {
        const { success, message } = await loginAction({ username, password });
        if (!success) {
          alert(message || 'Impossible de vous authentifier');
        }
      } catch (e) {
        alert((e as Error).message);
      }
      setLoading(false);
      return;
    }
    alert('please provide a valid input');
  };

  // Après les hooks : leur ordre doit rester identique d'un rendu à l'autre.
  if (ssoEnabled) return <SsoLoginRedirect />;

  return (
    <Box
      sx={{
        paddingTop: 2,
        paddingBottom: 10,
        paddingX: 2,
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ mt: 8 }}>
          <Typography
            variant="h4"
            component="h2"
            gutterBottom
            sx={{ marginBottom: 5 }}
          >
            Connexion
          </Typography>
          <form onSubmit={handleLogin}>
            <Box sx={{ mb: 2 }}>
              <TextField
                label="Identifiant"
                variant="outlined"
                fullWidth
                value={username}
                disabled={loading}
                required
                autoComplete={'username'}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Box>
            <Box sx={{ mb: 2 }}>
              <TextField
                label="Mot de passe"
                type="password"
                variant="outlined"
                fullWidth
                value={password}
                required
                disabled={loading}
                autoComplete={'current-password'}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Box>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Login'
              )}
            </Button>
          </form>
        </Box>
      </Container>
    </Box>
  );
};

export default Login;
