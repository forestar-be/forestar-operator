import { PaletteMode } from '@mui/material';
import { green, orange } from '@mui/material/colors';

export const light = {
  mode: 'light' as PaletteMode,
  primary: {
    main: '#418e93',
    contrastText: 'rgb(255,255,255)',
  },
  secondary: {
    main: '#936a41',
  },
  success: {
    main: 'rgb(111, 214, 145)',
    light: 'rgb(131, 231, 168)',
    dark: green[600],
  },
  text: {
    primary: 'rgb(40, 40, 40)',
    secondary: 'rgb(103, 119, 136)',
  },
  background: {
    paper: 'rgb(242, 243, 245)',
    default: 'rgb(255, 255, 255)',
  },
  divider: 'rgba(0, 0, 0, 0.12)',
};

export const dark = {
  mode: 'dark' as PaletteMode,
  primary: {
    main: '#5f9598',
    contrastText: 'rgb(43,43,43)',
  },
  secondary: {
    main: '#a18970',
    contrastText: 'rgb(43,43,43)',
  },
  warning: {
    main: 'rgb(242, 175, 87)',
    light: 'rgb(245, 205, 130)',
    dark: orange[600],
  },
  text: {
    primary: 'rgb(255, 255, 255)',
    secondary: 'rgb(207, 207, 207)',
  },
  background: {
    default: 'rgb(0, 0, 0)',
    paper: 'rgb(15, 15, 15)',
    paperSeeThrough: 'rgba(15, 15, 15, 0.6)',
  },
  divider: 'rgba(145, 158, 171, 0.24)',
};
