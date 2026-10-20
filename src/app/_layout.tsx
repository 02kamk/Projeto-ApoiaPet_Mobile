import { Stack } from 'expo-router';
import { DemoProvider } from '../DemoScreen';
import { DonationsProvider } from '../donations/context';
export default function Layout() { return <DemoProvider><DonationsProvider><Stack screenOptions={{ headerShown: false }} /></DonationsProvider></DemoProvider>; }
