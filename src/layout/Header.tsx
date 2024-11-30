import { useContext, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useTheme } from '@mui/material/styles';
import LogoutIcon from '@mui/icons-material/Logout';
import ColorModeContext from '../utils/ColorModeContext';
import headerData from '../config/header.json';
import { Logo } from '../components/Logo';
import { useAuth } from '../hooks/AuthProvider';

interface Props {
  onSidebarOpen: () => void;
}

export interface HeaderProps {
  title: string;
}

const Header = ({ onSidebarOpen }: Props): JSX.Element => {
  const theme = useTheme();
  const auth = useAuth();
  const colorMode = useContext(ColorModeContext);
  const [header] = useState<HeaderProps>(headerData);

  return (
    <>
      <AppBar
        color="transparent"
        position="sticky"
        sx={{
          border: 0,
          // padding: '10px 0',
          top: 'auto',
          boxShadow:
            '0 4px 18px 0px rgba(0, 0, 0, 0.12), 0 7px 10px -5px rgba(0, 0, 0, 0.15)',
        }}
      >
        <Toolbar sx={{ minHeight: 70 }}>
          <Link href="/" sx={{ textDecoration: 'none' }}>
            <IconButton size="large" disabled>
              <Logo isDark={theme.palette.mode === 'dark'} />
              <Box sx={{ display: { md: 'inline', xs: 'none' } }}>
                <Typography
                  variant="h6"
                  sx={{
                    flexGrow: 1,
                    color: theme.palette.text.primary,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    marginLeft: '10px',
                  }}
                >
                  {header.title}
                </Typography>
              </Box>
            </IconButton>
          </Link>
          <Box sx={{ flexGrow: 1 }} />
          <Box
            sx={{
              alignItems: 'center',
              display: { lg: 'flex', md: 'none', xs: 'none' },
            }}
          ></Box>
          {auth.token && (
            <Box sx={{ display: 'flex' }}>
              <IconButton
                onClick={auth.logOut}
                aria-label="Déconnexion"
                color={theme.palette.mode === 'dark' ? 'warning' : 'inherit'}
              >
                <Tooltip title="Déconnexion">
                  <LogoutIcon fontSize="medium" />
                </Tooltip>
              </IconButton>
            </Box>
          )}
          <Divider
            orientation="vertical"
            sx={{
              height: 32,
              marginX: 2,
              display: { lg: 'flex', md: 'none', xs: 'none' },
            }}
          />
          <Box sx={{ display: 'flex' }}>
            <IconButton
              onClick={colorMode.toggleColorMode}
              aria-label="Theme Mode"
              color={theme.palette.mode === 'dark' ? 'warning' : 'inherit'}
            >
              {theme.palette.mode === 'dark' ? (
                <Tooltip title="Passer en mode clair">
                  <LightModeIcon fontSize="medium" />
                </Tooltip>
              ) : (
                <Tooltip title="Passer en mode sombre">
                  <DarkModeIcon fontSize="medium" />
                </Tooltip>
              )}
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
    </>
  );
};

export default Header;
