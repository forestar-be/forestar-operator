import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LockPersonIcon from '@mui/icons-material/LockPerson';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import LogoutIcon from '@mui/icons-material/Logout';
import { ROLE_LABELS, roleLabelsOf } from '@forestar-be/core';
import type { ForestarRole } from '@forestar-be/core';
import { useAuth } from '../hooks/AuthProvider';

interface Props {
  /** Nom de l'application, tel qu'une personne la nomme. */
  application: string;
  /** Rôles qui ouvriraient cet écran. */
  allowedRoles: readonly ForestarRole[];
}

/**
 * R028 / R027 n° 14, 15 et 16 — Refus de rôle.
 *
 * L'écran d'origine était aligné à gauche, sans icône, avec un bouton brut, ne
 * nommait pas le rôle manquant, ne disait pas à qui s'adresser, et n'offrait
 * aucune sortie : la déconnexion était la seule issue. « Changer de compte »
 * est la sortie qui manquait — c'est le geste utile quand quelqu'un s'est
 * connecté avec le mauvais compte sur un poste partagé du magasin.
 */
const AccessDenied = ({ application, allowedRoles }: Props): JSX.Element => {
  const auth = useAuth();
  const required = roleLabelsOf(allowedRoles);
  const held = roleLabelsOf(auth.roles);

  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Paper
        elevation={0}
        variant="outlined"
        sx={{ maxWidth: 520, width: '100%', p: 4, textAlign: 'center' }}
      >
        <LockPersonIcon color="warning" sx={{ fontSize: 56, mb: 1.5 }} />
        <Typography variant="h6" component="h1" gutterBottom>
          Accès non autorisé
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Votre compte est bien authentifié, mais il ne porte pas les droits
          nécessaires à {application}.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {required.length === 1
            ? `Cet écran demande le rôle « ${required[0]} ».`
            : `Cet écran demande l'un des rôles suivants : ${required.join(', ')}.`}{' '}
          {held.length > 0
            ? `Votre compte porte ${held.join(', ')}.`
            : "Votre compte ne porte aucun rôle Forestar pour l'instant."}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Si vous pensez devoir y accéder, demandez ce rôle à l&apos;atelier —
          c&apos;est une autorisation à ajouter, pas un problème de mot de passe.
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          justifyContent="center"
          sx={{ mt: 3 }}
        >
          <Button
            variant="contained"
            startIcon={<SwapHorizIcon />}
            onClick={() => auth.switchAccount()}
          >
            Changer de compte
          </Button>
          <Button
            variant="outlined"
            startIcon={<LogoutIcon />}
            onClick={() => auth.logOut()}
          >
            Se déconnecter
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default AccessDenied;
export { ROLE_LABELS };
