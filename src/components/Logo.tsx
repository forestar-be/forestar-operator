import { Box } from '@mui/material';

export const Logo = ({ isDark }: { isDark: boolean }): JSX.Element => {
  if (isDark) {
    return (
      <Box
        component="img"
        src="/images/logo/logo-dark-70x70.png"
        alt="Logo"
        sx={{
          height: 40,
          width: 40,
        }}
      />
    );
  }

  return (
    <Box
      component="img"
      src="/images/logo/logo-70x70.png"
      alt="Logo"
      sx={{
        height: 40,
        width: 40,
      }}
    />
  );
};
