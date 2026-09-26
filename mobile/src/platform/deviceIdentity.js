import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const DEVICE_KEY = 'minhatela.device.key';
const DEVICE_NAME_KEY = 'minhatela.device.name';

async function persist(key, value) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function read(key) {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

function randomKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultDeviceName() {
  if (Platform.OS === 'web') {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    if (/TV|SmartTV|Tizen|Web0S|BRAVIA/i.test(ua)) return 'Smart TV';
    if (/Mobile|Android|iPhone/i.test(ua)) return 'Browser móvel';
    return 'Browser';
  }
  if (Platform.OS === 'ios') return 'iPhone / iPad';
  if (Platform.OS === 'android') return 'Android';
  return 'Dispositivo MinhaTela';
}

export async function getDeviceIdentity() {
  let key = await read(DEVICE_KEY);
  if (!key) {
    key = randomKey();
    await persist(DEVICE_KEY, key);
  }

  let name = await read(DEVICE_NAME_KEY);
  if (!name) {
    name = defaultDeviceName();
    await persist(DEVICE_NAME_KEY, name);
  }

  return {
    deviceKey: key,
    deviceName: name,
    platform: Platform.OS === 'web' ? 'web' : Platform.OS,
  };
}

export async function setDeviceName(name) {
  await persist(DEVICE_NAME_KEY, name);
}
