import React, { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import KeyIcon from '@mui/icons-material/Key';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import GroupIcon from '@mui/icons-material/Group';
import BusinessIcon from '@mui/icons-material/Business';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import LogoutIcon from '@mui/icons-material/Logout';
import {
  buildAccountMenu,
  displayNameOf,
  initialsOf,
  roleLabelsOf,
} from '@forestar-be/core';
import { useAuth } from '../hooks/AuthProvider';
import { SSO_ISSUER } from '../hooks/session';

const ICONS: Record<string, React.ReactElement> = {
  password: <KeyIcon fontSize="small" />,
  profile: <ManageAccountsIcon fontSize="small" />,
  'admin-users': <GroupIcon fontSize="small" />,
  'admin-org': <BusinessIcon fontSize="small" />,
};

interface Props {
  /**
   * Garde optionnelle jouée avant de quitter l'application. Elle renvoie `false`
   * pour annuler. `forestar-rental-management` s'en sert pour ne pas perdre une
   * saisie en cours; les autres applications n'en ont pas.
   */
  beforeLeave?: () => boolean;
}

/**
 * R028 — Bouton avatar et menu de compte.
 *
 * Remplace le bouton « Déconnexion » isolé : l'identité était invisible, et il
 * n'existait aucun chemin vers le changement de mot de passe ou la double
 * vérification autrement qu'en demandant à quelqu'un.
 *
 * Les entrées de compte ouvrent la console de l'IdP dans un nouvel onglet —
 * l'application n'est pas quittée. « Changer de compte » repart vers l'IdP avec
 * `prompt=select_account`; sans ce prompt la session en cours serait rouverte
 * en silence et le bouton paraîtrait inerte.
 */
const AccountMenu = ({ beforeLeave }: Props = {}): JSX.Element | null => {
  const auth = useAuth();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  // En mode historique il n'y a ni identité ni console : le bouton de
  // déconnexion d'origine reste le bon rendu.
  if (!auth.ssoEnabled) return null;

  const entries = buildAccountMenu({
    issuer: SSO_ISSUER,
    roles: auth.roles,
  });
  const accountEntries = entries.filter((e) => e.group === 'account');
  const adminEntries = entries.filter((e) => e.group === 'admin');
  const roles = roleLabelsOf(auth.roles);
  const close = () => setAnchor(null);
  const leave = (action: () => void) => () => {
    close();
    if (beforeLeave && !beforeLeave()) return;
    action();
  };

  return (
    <>
      <Tooltip title="Mon compte">
        <IconButton
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-label="Mon compte"
          aria-haspopup="menu"
          aria-expanded={anchor ? 'true' : undefined}
          size="small"
          sx={{ ml: 1 }}
        >
          <Avatar
            sx={{
              width: 34,
              height: 34,
              fontSize: 14,
              fontWeight: 600,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            {initialsOf(auth.user)}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 268, mt: 1 } } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle2" noWrap>
            {displayNameOf(auth.user)}
          </Typography>
          {auth.user?.email && (
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {auth.user.email}
            </Typography>
          )}
          {roles.length > 0 && (
            <Typography variant="caption" color="text.secondary" display="block">
              {roles.join(' · ')}
            </Typography>
          )}
        </Box>
        <Divider />

        {accountEntries.map((entry) => (
          <MenuItem
            key={entry.id}
            component="a"
            href={entry.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
          >
            <ListItemIcon>{ICONS[entry.id]}</ListItemIcon>
            <ListItemText primary={entry.label} />
            <OpenInNewIcon fontSize="inherit" sx={{ ml: 1, opacity: 0.5 }} />
          </MenuItem>
        ))}

        {adminEntries.length > 0 && <Divider />}
        {adminEntries.length > 0 && (
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ px: 2, lineHeight: 2 }}
          >
            Administration
          </Typography>
        )}
        {adminEntries.map((entry) => (
          <MenuItem
            key={entry.id}
            component="a"
            href={entry.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
          >
            <ListItemIcon>{ICONS[entry.id]}</ListItemIcon>
            <ListItemText primary={entry.label} />
            <OpenInNewIcon fontSize="inherit" sx={{ ml: 1, opacity: 0.5 }} />
          </MenuItem>
        ))}

        <Divider />
        <MenuItem onClick={leave(() => auth.switchAccount())}>
          <ListItemIcon>
            <SwapHorizIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Changer de compte" />
        </MenuItem>
        <MenuItem onClick={leave(() => auth.logOut())}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Se déconnecter" />
        </MenuItem>
      </Menu>
    </>
  );
};

export default AccountMenu;
