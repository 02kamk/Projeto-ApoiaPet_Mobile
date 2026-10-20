import { Stack } from 'expo-router';
import { DemoProvider } from '../DemoScreen';
export default function Layout() { return <DemoProvider><Stack screenOptions={{ headerShown: false }} /></DemoProvider>; }
