import { Stack } from 'expo-router';
import { SessionProvider, useSession } from '../backend/session';
import { ThemeProvider, themes } from '../ui';
// Tema conforme a conta logada (login e cadastro continuam verdes).
function RoleTheme({ children }: React.PropsWithChildren) {
  const { profile } = useSession();
  return <ThemeProvider theme={profile?.role === 'ong' ? themes.ong : themes.donor}>{children}</ThemeProvider>;
}
export default function Layout() { return <SessionProvider><RoleTheme><Stack screenOptions={{ headerShown: false }} /></RoleTheme></SessionProvider>; }
