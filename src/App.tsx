import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import getTheme from './theme/theme';
import ColorModeContext from './utils/ColorModeContext';
import Layout from './layout/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import AuthRoute from './components/AuthRoute';
import AuthProvider from './hooks/AuthProvider';

const defaultTheme = 'light';

const App = (): JSX.Element => {
  const [mode, setMode] = useState('dark');
  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        window.localStorage.setItem(
          'themeMode',
          mode === 'dark' ? 'light' : 'dark',
        );
        setMode((prevMode) => (prevMode === 'dark' ? 'light' : 'dark'));
      },
    }),
    [mode],
  );

  useEffect(() => {
    try {
      const localTheme = window.localStorage.getItem('themeMode');
      localTheme ? setMode(localTheme) : setMode(defaultTheme);
    } catch {
      setMode(defaultTheme);
    }
  }, []);

  return (
    <HelmetProvider>
      <Helmet
        titleTemplate="%s | Forestar Opérateur"
        defaultTitle="Forestar Opérateur"
      />
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={getTheme(mode)}>
          <CssBaseline />
          <BrowserRouter>
            <AuthProvider>
              <Layout>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route element={<AuthRoute />}>
                    <Route path="/" element={<Home />} />
                  </Route>
                </Routes>
              </Layout>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </HelmetProvider>
  );
};

export default App;
