import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import SvgIcon from '@mui/material/SvgIcon';
import Tooltip from '@mui/material/Tooltip';
import { alpha, useTheme } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { buildAppMenu, groupAppMenu } from '@forestar-be/core';
import type { AppId } from '@forestar-be/core';

/**
 * Grille 3×3 de points — l'icône `Grip` de lucide, que le sélecteur
 * d'applications utilise dans tous les sites Forestar.
 */
const GripIcon = (): JSX.Element => (
  <SvgIcon fontSize="medium">
    <g fill="currentColor">
      {[5, 12, 19].flatMap((cy) =>
        [5, 12, 19].map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1} />
        )),
      )}
    </g>
  </SvgIcon>
);

interface Props {
  /** Application qui affiche le menu : elle est marquée, et n'est pas un lien. */
  current: AppId;
}

/**
 * Bouton « Applications » : la liste de tous les sites Forestar, tirée du
 * catalogue de `@forestar-be/core`. Non filtrée par rôle; chaque lien s'ouvre
 * dans un nouvel onglet pour ne rien faire perdre de la page en cours (la garde
 * de saisie de l'application n'a donc pas à intervenir).
 */
const AppMenu = ({ current }: Props): JSX.Element => {
  const theme = useTheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const sections = groupAppMenu(buildAppMenu({ current }));
  const close = () => setAnchor(null);

  return (
    <>
      <Tooltip title="Applications">
        <IconButton
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-label="Applications"
          aria-haspopup="menu"
          aria-expanded={anchor ? 'true' : undefined}
          color={theme.palette.mode === 'dark' ? 'warning' : 'inherit'}
        >
          <GripIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: { sx: { width: 320, maxWidth: 'calc(100vw - 16px)', mt: 1 } },
        }}
      >
        {sections.map((section, index) => [
          index > 0 && <Divider key={`divider-${section.group}`} />,
          <ListSubheader
            key={`label-${section.group}`}
            disableSticky
            sx={{ lineHeight: '32px' }}
          >
            {section.label}
          </ListSubheader>,
          ...section.entries.map((entry) =>
            entry.current ? (
              <MenuItem
                key={entry.id}
                component="div"
                aria-current="page"
                disableRipple
                tabIndex={-1}
                sx={{
                  cursor: 'default',
                  alignItems: 'flex-start',
                  whiteSpace: 'normal',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                <ListItemText
                  primary={entry.label}
                  secondary={entry.description}
                  primaryTypographyProps={{ fontWeight: 500 }}
                  secondaryTypographyProps={{ fontSize: 12 }}
                />
                <Box
                  component="span"
                  sx={{
                    ml: 1,
                    mt: 0.25,
                    px: 1,
                    py: 0.25,
                    flexShrink: 0,
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'primary.main',
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                  }}
                >
                  Vous êtes ici
                </Box>
              </MenuItem>
            ) : (
              <MenuItem
                key={entry.id}
                component="a"
                href={entry.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                sx={{ alignItems: 'flex-start', whiteSpace: 'normal' }}
              >
                <ListItemText
                  primary={entry.label}
                  secondary={entry.description}
                  primaryTypographyProps={{ fontWeight: 500 }}
                  secondaryTypographyProps={{ fontSize: 12 }}
                />
                <OpenInNewIcon
                  fontSize="inherit"
                  sx={{ ml: 1, mt: 0.5, opacity: 0.4, flexShrink: 0 }}
                />
              </MenuItem>
            ),
          ),
        ])}
      </Menu>
    </>
  );
};

export default AppMenu;
